import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { consola } from 'consola'
import { isProduction } from 'std-env'
import { sendSlackNotification } from '../utils/slack'
import { LINEAR_SYSTEM_PROMPT } from '../utils/systemPromptLinear'
import { fetchLinearDoneIssues, groupIssuesByProject } from '../utils/linear'

/**
 * Format Linear issues by team for display
 */
function formatIssuesByTeam(groupedByProject: Record<string, { team: string, issues: any[] }>): string {
  const byTeam: Record<string, { projects: Record<string, any[]> }> = {}

  // Group by team first, then by project
  Object.entries(groupedByProject).forEach(([projectName, { team, issues }]) => {
    if (!byTeam[team]) {
      byTeam[team] = { projects: {} }
    }
    byTeam[team]!.projects[projectName] = issues
  })

  let output = ''
  Object.entries(byTeam).forEach(([teamName, { projects }]) => {
    const totalIssues = Object.values(projects).reduce((sum, issues) => sum + issues.length, 0)
    output += `**${teamName}** (${totalIssues} issues)\n`

    Object.entries(projects).forEach(([projectName, issues]) => {
      output += `  ${projectName}: ${issues.length} issues\n`
      issues.forEach((issue) => {
        output += `    - ${issue.identifier}: ${issue.title}\n`
      })
    })
    output += '\n'
  })

  return output
}

/**
 * Format issues for Slack markdown file
 */
function formatIssuesForSlackFile(groupedByProject: Record<string, { team: string, issues: any[] }>): string {
  if (Object.keys(groupedByProject).length === 0) {
    return 'No issues completed this week.'
  }

  const byTeam: Record<string, { projects: Record<string, any[]>, total: number }> = {}

  // Group by team
  Object.entries(groupedByProject).forEach(([projectName, { team, issues }]) => {
    if (!byTeam[team]) {
      byTeam[team] = { projects: {}, total: 0 }
    }
    byTeam[team]!.projects[projectName] = issues
    byTeam[team]!.total += issues.length
  })

  let markdown = `# Weekly Linear Issues Report\n\n`
  markdown += `*Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*\n\n`

  // Sort teams by issue count
  const sortedTeams = Object.entries(byTeam).sort(([, a], [, b]) => b.total - a.total)

  sortedTeams.forEach(([teamName, { projects, total }]) => {
    markdown += `## ${teamName} (${total} issues)\n\n`

    Object.entries(projects).forEach(([projectName, issues]) => {
      markdown += `### ${projectName}\n\n`
      issues.forEach((issue) => {
        markdown += `- [${issue.identifier}](${issue.url}): ${issue.title}\n`
      })
      markdown += '\n'
    })
  })

  return markdown
}

/**
 * Format issues for LLM context in XML format with descriptions
 */
function formatIssuesForLLM(groupedByProject: Record<string, { team: string, issues: any[] }>): string {
  const byTeam: Record<string, { projects: Record<string, any[]> }> = {}

  Object.entries(groupedByProject).forEach(([projectName, { team, issues }]) => {
    if (!byTeam[team]) {
      byTeam[team] = { projects: {} }
    }
    byTeam[team]!.projects[projectName] = issues
  })

  let output = '<teams>\n'
  Object.entries(byTeam).forEach(([teamName, { projects }]) => {
    output += `  <team name="${teamName}">\n`
    Object.entries(projects).forEach(([projectName, issues]) => {
      output += `    <project name="${projectName}">\n`
      issues.forEach((issue) => {
        output += `      <issue>\n`
        output += `        <identifier>${issue.identifier}</identifier>\n`
        output += `        <title>${issue.title}</title>\n`
        if (issue.description) {
          output += `        <description>${issue.description}</description>\n`
        }
        output += `      </issue>\n`
      })
      output += `    </project>\n`
    })
    output += `  </team>\n`
  })
  output += '</teams>'

  return output
}

export default defineEventHandler(async () => {
  // Fetch issues from last 7 days
  const issues = await fetchLinearDoneIssues(7)

  if (issues.length === 0) {
    consola.warn('No Linear issues found for the past week')
    return {
      success: true,
      slackSent: false,
      issueCount: 0,
      message: 'No issues to report'
    }
  }

  // Group issues
  const groupedByProject = groupIssuesByProject(issues)

  // Get current week number
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  const weekNumber = Math.ceil((days + start.getDay() + 1) / 7)

  // Get previous weeks' summaries for context (last 4 weeks)
  const previousSummaries = []
  for (let i = 1; i <= 4; i++) {
    const prevWeek = weekNumber - i
    const key = `weekly-linear-summary-${now.getFullYear()}-${prevWeek}`
    const prevSummary = await hubKV().get(key)
    if (prevSummary) {
      try {
        const summaryStr = typeof prevSummary === 'string' ? prevSummary : JSON.stringify(prevSummary)
        const parsed = JSON.parse(summaryStr)
        // Use first summary text from array (new format) or fallback to old format
        const summaryText = parsed.summaries?.[0]?.text || parsed.summary || summaryStr
        previousSummaries.push(`Week ${prevWeek}: ${summaryText}`)
      } catch {
        const summaryStr = typeof prevSummary === 'string' ? prevSummary : JSON.stringify(prevSummary)
        previousSummaries.push(`Week ${prevWeek}: ${summaryStr}`)
      }
    }
  }

  // Format for LLM
  const formattedIssues = formatIssuesForLLM(groupedByProject)

  // Build context
  let context = `Current week: ${weekNumber} of ${now.getFullYear()}\n\nCompleted Issues:\n\n${formattedIssues}`
  if (previousSummaries.length > 0) {
    context += `\n\nPrevious weeks for context (use for running jokes and references):\n\n${previousSummaries.join('\n\n')}`
  }

  // Generate summary with GPT-4.1
  const models = [
    { name: 'GPT-4.1', model: openai('gpt-4.1') }
  ]

  const summaryPromises = models.map(async ({ name, model }) => {
    const { text } = await generateText({
      model,
      system: LINEAR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }]
    })
    return { name, text }
  })

  const summaries = await Promise.all(summaryPromises)

  // Store all summaries in KV
  const currentKey = `weekly-linear-summary-${now.getFullYear()}-${weekNumber}`
  const summaryData = {
    week: weekNumber,
    year: now.getFullYear(),
    date: now.toISOString(),
    issueCount: issues.length,
    summaries: summaries.map(s => ({ model: s.name, text: s.text })),
    issues: formatIssuesForSlackFile(groupedByProject)
  }

  await hubKV().set(currentKey, JSON.stringify(summaryData))

  // Clean up old summaries
  for (let i = 5; i <= 8; i++) {
    const oldWeek = weekNumber - i
    const oldKey = `weekly-linear-summary-${now.getFullYear()}-${oldWeek}`
    await hubKV().del(oldKey)
  }

  // Log in development, send to Slack in production
  if (!isProduction) {
    summaries.forEach((summary, i) => {
      consola.box(`📊 Weekly Linear Summary - Week ${weekNumber} - ${summary.name}\n\n${summary.text}\n\n📈 ${issues.length} issues completed`)
      if (i < summaries.length - 1) consola.info('') // Spacing between summaries
    })
    consola.info('\n' + formatIssuesByTeam(groupedByProject))
    return {
      success: true,
      slackSent: false,
      issueCount: issues.length,
      summaries: summaries.map(s => ({ model: s.name, summary: s.text })),
      kvKey: currentKey
    }
  }

  // Send to Slack in production
  let slackSuccess = false
  try {
    const issuesSummary = formatIssuesForSlackFile(groupedByProject)
    const filename = `linear-issues-week-${weekNumber}-${now.getFullYear()}.md`

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
        message: `📊 Linear Issues Report (${issues.length} issue${issues.length !== 1 ? 's' : ''})`,
        threadTs: messageTs,
        fileAttachment: {
          content: issuesSummary,
          filename,
          filetype: 'markdown',
          title: `📊 Linear Issues Report (${issues.length} issue${issues.length !== 1 ? 's' : ''})`
        }
      })
    }

    slackSuccess = !!messageTs
  } catch (error) {
    consola.error('Failed to send Slack notification:', error)
  }

  return {
    success: true,
    slackSent: slackSuccess,
    issueCount: issues.length,
    summaries: summaries.map(s => ({ model: s.name, summary: '[hidden for security]' })),
    kvKey: currentKey
  }
})
