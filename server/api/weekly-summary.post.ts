import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { sendSlackNotification } from '../utils/slack'
import { SYSTEM_PROMPT } from '../utils/systemPrompt'

export default defineEventHandler(async () => {
  // Get releases from last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const allReleases = await $fetch('/api/releases')
  const recentReleases = allReleases.filter(release =>
    new Date(release.date) >= sevenDaysAgo && !release.repo.includes('onmax/')
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
    .map(release => `${release.repo} ${release.tag}: ${release.body}`)
    .join('\n\n')

  // Build context with previous weeks
  let context = `Current week: ${weekNumber} of ${now.getFullYear()}\n\nReleases:\n\n${formattedReleases}`
  if (previousSummaries.length > 0) {
    context += `\n\nPrevious weeks for context (use for running jokes and references):\n\n${previousSummaries.join('\n\n')}`
  }

  // Generate summary with LLM
  const { text: summary } = await generateText({
    model: openai('gpt-5-nano'),
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: context }]
  })

  // Store this week's summary
  const currentKey = `weekly-summary-${now.getFullYear()}-${weekNumber}`
  await hubKV().set(currentKey, summary)

  // Clean up summaries older than 4 weeks
  for (let i = 5; i <= 8; i++) {
    const oldWeek = weekNumber - i
    const oldKey = `weekly-summary-${now.getFullYear()}-${oldWeek}`
    await hubKV().del(oldKey)
  }

  // Send to Slack
  await sendSlackNotification({ message: summary })

  return { success: true, releaseCount: recentReleases.length, message: summary }
})
