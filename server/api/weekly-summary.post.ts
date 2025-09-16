import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { consola } from 'consola'
import { sendWeeklySummarySuccessNotification, sendWeeklySummaryFailureNotification } from '../utils/slack'
import { SYSTEM_PROMPT } from '../utils/systemPrompt'

interface Release {
  url: string
  repo: string
  tag: string
  title: string
  date: string
  body: any
}

function formatReleaseForAI(release: Release): string {
  // Extract text content from MDC body structure
  const extractText = (node: any): string => {
    if (!node) return ''
    if (typeof node === 'string') return node
    if (node.type === 'text') return node.value || ''
    if (node.children && Array.isArray(node.children)) {
      return node.children.map(extractText).join(' ')
    }
    return ''
  }

  const bodyText = extractText(release.body)
  return `${release.repo} ${release.tag}: ${bodyText.substring(0, 300)}...`
}

function getDateSevenDaysAgo(): string {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return date.toISOString()
}

export default defineEventHandler(async (event) => {
  const startTime = Date.now()

  try {
    consola.info('Starting weekly summary generation...')

    // Verify webhook authentication (basic security)
    const { webhookSecret } = useRuntimeConfig()
    if (webhookSecret) {
      const authHeader = getHeader(event, 'authorization')
      if (!authHeader || !authHeader.includes(webhookSecret)) {
        consola.warn('Invalid or missing webhook authentication')
        const error = createError({
          statusCode: 401,
          statusMessage: 'Unauthorized'
        })
        await sendWeeklySummaryFailureNotification(error, 'authentication')
        throw error
      }
    }

    // Fetch releases from the last 7 days
    consola.info('Fetching releases from the last 7 days...')
    const sevenDaysAgo = getDateSevenDaysAgo()
    let recentReleases: Release[] = []

    try {
      const allReleases = await $fetch<Release[]>('/api/releases')

      if (!Array.isArray(allReleases)) {
        throw new Error('Invalid releases data format received')
      }

      // Filter releases from the last 7 days and exclude onmax repositories
      recentReleases = allReleases.filter((release) => {
        try {
          const releaseDate = new Date(release.date)
          const cutoffDate = new Date(sevenDaysAgo)
          const isInTimeRange = releaseDate >= cutoffDate && !isNaN(releaseDate.getTime())
          const isNotOnmaxRepo = !release.repo.includes('onmax/')
          return isInTimeRange && isNotOnmaxRepo
        } catch {
          consola.warn(`Invalid date format for release: ${release.tag}`)
          return false
        }
      })

      consola.info(`Found ${recentReleases.length} releases from the last 7 days`)
    } catch (fetchError) {
      consola.error('Error fetching releases:', fetchError)
      await sendWeeklySummaryFailureNotification(fetchError, 'fetching releases')
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch releases'
      })
    }

    // Handle case with no releases
    if (recentReleases.length === 0) {
      const message = 'This week in Nimiq: Crickets. Not even the bugs bothered showing up. Everyone\'s apparently taking a well-deserved break from shipping. The calm before the storm, or just peak efficiency? You decide.'

      try {
        await sendWeeklySummarySuccessNotification(0, message)

        // Still send to Slack even with no releases
        const { slackWebhookUrl } = useRuntimeConfig()
        if (slackWebhookUrl) {
          await $fetch(slackWebhookUrl, {
            method: 'POST',
            body: {
              text: message,
              username: 'Nimiq Weekly Recap',
              icon_emoji: ':cricket:'
            },
            headers: {
              'Content-Type': 'application/json'
            }
          })
          consola.success('Empty week message sent to Slack')
        }

        return { success: true, releaseCount: 0, message, executionTime: Date.now() - startTime }
      } catch (slackError) {
        consola.error('Error sending empty week message to Slack:', slackError)
        await sendWeeklySummaryFailureNotification(slackError, 'Slack notification')
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to send Slack notification'
        })
      }
    }

    // Format releases for AI
    const formattedReleases = recentReleases
      .map(formatReleaseForAI)
      .join('\n\n')

    // Generate AI summary with retry logic
    let summary: string
    try {
      consola.info('Generating AI summary...')
      const response = await generateText({
        model: openai('gpt-4-turbo'),
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Here are the releases from this week:\n\n${formattedReleases}`
          }
        ]
      })

      summary = response.text.trim()

      if (!summary || summary.length < 20) {
        throw new Error('AI generated summary is too short or empty')
      }

      consola.success('AI summary generated successfully')
    } catch (aiError) {
      consola.error('Error generating AI summary:', aiError)

      // Fallback to simple summary
      consola.info('Attempting fallback summary generation...')
      const repoNames = [...new Set(recentReleases.map(r => r.repo.split('/').pop()))]
      summary = `This week in Nimiq: ${recentReleases.length} releases across ${repoNames.join(', ')}. The team's been busy shipping updates while I was having technical difficulties crafting witty commentary. Sometimes the robots need a coffee break too.`

      await sendWeeklySummaryFailureNotification(aiError, 'AI generation (used fallback)')
    }

    // Send success notification and summary to Slack
    try {
      await sendWeeklySummarySuccessNotification(recentReleases.length, summary)

      const { slackWebhookUrl } = useRuntimeConfig()
      if (slackWebhookUrl) {
        await $fetch(slackWebhookUrl, {
          method: 'POST',
          body: {
            text: summary,
            username: 'Nimiq Weekly Recap',
            icon_emoji: ':rocket:'
          },
          headers: {
            'Content-Type': 'application/json'
          }
        })
        consola.success('Summary sent to Slack successfully')
      } else {
        consola.warn('Slack webhook URL not configured, summary not sent to main channel')
      }

      return {
        success: true,
        releaseCount: recentReleases.length,
        message: summary,
        executionTime: Date.now() - startTime
      }
    } catch (slackError) {
      consola.error('Error sending summary to Slack:', slackError)
      await sendWeeklySummaryFailureNotification(slackError, 'Slack delivery')
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to send summary to Slack'
      })
    }
  } catch (error) {
    // Final catch-all error handler
    const executionTime = Date.now() - startTime
    consola.error('Unexpected error in weekly summary generation:', error)

    // Only send failure notification if it hasn't been sent already
    if (!(error as any)?.statusMessage?.includes('SLACK_NOTIFIED')) {
      await sendWeeklySummaryFailureNotification(error, 'unexpected error')
    }

    throw createError({
      statusCode: (error as any)?.statusCode || 500,
      statusMessage: (error as any)?.statusMessage || 'Internal server error',
      data: { executionTime }
    })
  }
})
