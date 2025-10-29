import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { sendSlackNotification } from '../utils/slack'
import { SYSTEM_PROMPT } from '../utils/systemPrompt'
import { fetchReleasesFromGroups } from '../utils/sources'
import type { SourcesConfig } from '../utils/sources/types'
import type { MDCRoot, MDCNode } from '@nuxtjs/mdc'

/**
 * Convert MDCRoot to plain text
 */
function mdcToText(mdc: MDCRoot): string {
  if (!mdc || !mdc.children) return ''

  function extractText(nodes: MDCNode[]): string[] {
    const texts: string[] = []

    for (const node of nodes) {
      if (node.type === 'text' && 'value' in node && node.value) {
        texts.push(node.value.trim())
      } else if (node.type === 'element' && 'children' in node && node.children) {
        texts.push(...extractText(node.children))
      }
    }

    return texts.filter(text => text.length > 0)
  }

  return extractText(mdc.children).join(' ').trim()
}

/**
 * Convert releases to formatted markdown text for Slack attachment
 */
function formatReleasesForSlack(releases: any[]): string {
  if (releases.length === 0) {
    return 'No releases found for this week.'
  }

  let markdown = `# Weekly Changelog\n\n`
  markdown += `*Generated on ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}*\n\n`

  // Group releases by repository
  const releasesByRepo: Record<string, any[]> = {}
  releases.forEach((release) => {
    if (!releasesByRepo[release.repo]) {
      releasesByRepo[release.repo] = []
    }
    releasesByRepo[release.repo]!.push(release)
  })

  // Generate content for each repository
  Object.keys(releasesByRepo).sort().forEach((repo) => {
    const repoReleases = releasesByRepo[repo]!
    markdown += `## ${repo}\n\n`

    // Sort releases by date (newest first)
    repoReleases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    repoReleases.forEach((release) => {
      const date = new Date(release.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })

      markdown += `### ${release.tag} (${date})\n\n`

      if (release.url && release.url !== '#') {
        markdown += `[View Release](${release.url})\n\n`
      }

      // Add release body content
      const bodyText = mdcToText(release.body)
      if (bodyText && bodyText.length > 0) {
        // Truncate if too long (Slack has limits)
        const truncatedText = bodyText.length > 500
          ? bodyText.substring(0, 500) + '...'
          : bodyText
        markdown += `${truncatedText}\n\n`
      }

      markdown += `---\n\n`
    })
  })

  return markdown
}

export default defineEventHandler(async () => {
  // Get releases from last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const runtimeConfig = useRuntimeConfig()
  const sourcesConfig = runtimeConfig.sources as SourcesConfig

  // Fetch releases using slack-specific filtering (excludes @onmax repos)
  const allReleases = await fetchReleasesFromGroups(sourcesConfig, undefined, 'slack')
  const recentReleases = allReleases.filter(release =>
    new Date(release.date) >= sevenDaysAgo
  )

  // Get current week number
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  const weekNumber = Math.ceil((days + start.getDay() + 1) / 7)

  // Get previous weeks' summaries for context (last 4 weeks)
  const previousSummaries = []
  for (let i = 1; i <= 4; i++) {
    const prevWeek = weekNumber - i
    const key = `weekly-summary-${now.getFullYear()}-${prevWeek}`
    const prevSummary = await hubKV().get(key)
    if (prevSummary) {
      try {
        // Try to parse as JSON (new format)
        const summaryStr = typeof prevSummary === 'string' ? prevSummary : JSON.stringify(prevSummary)
        const parsed = JSON.parse(summaryStr)
        const firstSummaryText = parsed.summaries?.[0]?.text || summaryStr
        previousSummaries.push(`Week ${prevWeek}: ${firstSummaryText}`)
      } catch {
        // Fallback to old format (plain string)
        const summaryStr = typeof prevSummary === 'string' ? prevSummary : JSON.stringify(prevSummary)
        previousSummaries.push(`Week ${prevWeek}: ${summaryStr}`)
      }
    }
  }

  // Format releases for LLM
  const formattedReleases = recentReleases
    .map(release => `${release.repo} ${release.tag}: ${mdcToText(release.body)}`)
    .join('\n\n')

  // Build context with previous weeks
  let context = `Current week: ${weekNumber} of ${now.getFullYear()}\n\nReleases:\n\n${formattedReleases}`
  if (previousSummaries.length > 0) {
    context += `\n\nPrevious weeks for context (use for running jokes and references):\n\n${previousSummaries.join('\n\n')}`
  }

  // Generate summaries with multiple LLMs in parallel
  const models = [
    { name: 'GPT-5 Nano', model: openai('gpt-5-nano') },
    { name: 'GPT-4.1', model: openai('gpt-4.1') }
  ]

  const summaryPromises = models.map(async ({ name, model }) => {
    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
      // GPT-5 optimizations: minimal reasoning for speed, low verbosity for conciseness
      ...(name.includes('GPT-5') && {
        experimental_providerMetadata: {
          openai: {
            reasoning_effort: 'minimal',
            verbosity: 'low'
          }
        }
      })
    })
    return { name, text }
  })

  const summaries = await Promise.all(summaryPromises)

  // Store all summaries in KV for backup (in case Slack fails)
  const currentKey = `weekly-summary-${now.getFullYear()}-${weekNumber}`
  const summaryData = {
    week: weekNumber,
    year: now.getFullYear(),
    date: now.toISOString(),
    releaseCount: recentReleases.length,
    summaries: summaries.map(s => ({ model: s.name, text: s.text })),
    changelog: formatReleasesForSlack(recentReleases)
  }

  await hubKV().set(currentKey, JSON.stringify(summaryData))

  // Clean up summaries older than 4 weeks
  for (let i = 5; i <= 8; i++) {
    const oldWeek = weekNumber - i
    const oldKey = `weekly-summary-${now.getFullYear()}-${oldWeek}`
    await hubKV().del(oldKey)
  }

  // Format the releases for the file attachment
  const changelogText = formatReleasesForSlack(recentReleases)

  // Generate filename with week info
  const currentDate = new Date()
  const filename = `nimiq-changelog-week-${weekNumber}-${currentDate.getFullYear()}.md`

  // Try to send to Slack, but don't fail if it doesn't work
  let slackSuccess = false
  try {
    // Send first model response
    const firstSummary = summaries[0]
    if (!firstSummary) {
      throw new Error('No summaries generated')
    }
    const initialMessage = `🤖 **${firstSummary.name}**\n\n${firstSummary.text}`

    const messageTs = await sendSlackNotification({
      message: initialMessage
    })

    // Send remaining model responses as threaded replies
    for (let i = 1; i < summaries.length; i++) {
      const summary = summaries[i]
      if (summary) {
        const threadMessage = `🤖 **${summary.name}**\n\n${summary.text}`

        await sendSlackNotification({
          message: threadMessage,
          threadTs: messageTs
        })
      }
    }

    // Send file attachment as final threaded reply
    if (messageTs) {
      await sendSlackNotification({
        message: `📄 Weekly Changelog (${recentReleases.length} release${recentReleases.length !== 1 ? 's' : ''})`,
        threadTs: messageTs,
        fileAttachment: {
          content: changelogText,
          filename: filename,
          filetype: 'markdown',
          title: `📄 Weekly Changelog (${recentReleases.length} release${recentReleases.length !== 1 ? 's' : ''})`
        }
      })
    }

    slackSuccess = !!messageTs
  } catch (error) {
    console.error('Failed to send Slack notification, but summaries are stored in KV:', error)
  }

  return {
    success: true,
    slackSent: slackSuccess,
    releaseCount: recentReleases.length,
    summaries: summaries.map(s => ({ model: s.name, summary: '[hidden for security]' })),
    kvKey: currentKey
  }
})
