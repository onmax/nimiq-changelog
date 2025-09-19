import process from 'node:process'
import { consola } from 'consola'
import { isDevelopment, isProduction } from 'std-env'

interface SlackMessage {
  text: string
  username?: string
  icon_emoji?: string
  attachments?: Array<{
    color?: string
    fields?: Array<{
      title: string
      value: string
      short?: boolean
    }>
    text?: string
    title?: string
    title_link?: string
    footer?: string
    ts?: number
  }>
}

interface SlackNotificationOptions {
  message: string
}

export async function sendSlackNotification(options: SlackNotificationOptions): Promise<void> {
  // Only send notifications in production unless explicitly testing
  if (!isProduction && !process.env.NUXT_SLACK_WEBHOOK_URL_FORCE_DEV) {
    consola.info('Skipping Slack notification in development:', options.message)
    return
  }

  const { slackWebhookUrl } = useRuntimeConfig()

  if (!slackWebhookUrl) {
    consola.warn('NUXT_SLACK_WEBHOOK_URL not configured, skipping Slack notification')
    return
  }

  const slackMessage: SlackMessage = {
    text: options.message
  }

  try {
    await $fetch(slackWebhookUrl, {
      method: 'POST',
      body: slackMessage,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    consola.success('Slack notification sent successfully')
  } catch (error) {
    consola.error('Failed to send Slack notification:', error)
  }
}

// Specific notification functions for weekly summary scenarios
export async function sendWeeklySummarySuccessNotification(
  releaseCount: number,
  summaryPreview: string
): Promise<void> {
  await sendSlackNotification({
    message: `📝 Weekly changelog summary generated successfully with ${releaseCount} releases`
  })
}

export async function sendWeeklySummaryFailureNotification(
  error: any,
  step?: string
): Promise<void> {
  await sendSlackNotification({
    message: `🚨 Weekly changelog summary generation failed${step ? ` during ${step}` : ''}: ${error?.message || error}`
  })
}
