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
      previousSummaries.push(`Week ${prevWeek}: ${prevSummary}`)
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
    { name: 'GPT-4o', model: openai('gpt-4o') }
  ]

  const summaryPromises = models.map(async ({ name, model }) => {
    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }]
    })
    return { name, text }
  })

  const summaries = await Promise.all(summaryPromises)

  // Store this week's summary (use the first model's summary for storage/backwards compatibility)
  const currentKey = `weekly-summary-${now.getFullYear()}-${weekNumber}`
  await hubKV().set(currentKey, summaries[0]?.text || '')

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

  // Send first model response with changelog attachment
  const firstSummary = summaries[0]
  if (!firstSummary) {
    throw new Error('No summaries generated')
  }
  const initialMessage = `🤖 **${firstSummary.name}**\n\n${firstSummary.text}`

  const messageTs = await sendSlackNotification({
    message: initialMessage,
    fileAttachment: {
      content: changelogText,
      filename: filename,
      filetype: 'markdown',
      title: `📄 Weekly Changelog (${recentReleases.length} release${recentReleases.length !== 1 ? 's' : ''})`
    }
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

  return {
    success: true,
    releaseCount: recentReleases.length,
    summaries: summaries.map(s => ({ model: s.name, message: s.text }))
  }
})
