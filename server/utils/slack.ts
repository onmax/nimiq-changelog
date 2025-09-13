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
  title?: string
  color?: 'good' | 'warning' | 'danger'
  fields?: Array<{
    title: string
    value: string
    short?: boolean
  }>
  tagMaxi?: boolean
  context?: Record<string, any>
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

  // Prepare the message
  let messageText = options.message
  if (options.tagMaxi && isProduction) {
    messageText = `<@maxi> ${messageText}`
  }

  const slackMessage: SlackMessage = {
    text: messageText,
    username: 'Nimiq Changelog Bot',
    icon_emoji: ':rocket:',
    attachments: [
      {
        color: options.color || 'good',
        title: options.title,
        fields: [
          {
            title: 'Environment',
            value: isDevelopment ? 'Development' : 'Production',
            short: true
          },
          {
            title: 'Timestamp',
            value: new Date().toISOString(),
            short: true
          },
          ...(options.fields || [])
        ],
        footer: 'Nimiq Changelog',
        ts: Math.floor(Date.now() / 1000)
      }
    ]
  }

  // Add context if provided
  if (options.context && slackMessage.attachments?.[0]?.fields) {
    slackMessage.attachments[0].fields.push({
      title: 'Context',
      value: `\`\`\`${JSON.stringify(options.context, null, 2)}\`\`\``,
      short: false
    })
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
    message: `📝 Weekly changelog summary generated successfully`,
    title: `${releaseCount} releases summarized`,
    color: 'good',
    tagMaxi: false,
    fields: [
      {
        title: 'Release Count',
        value: releaseCount.toString(),
        short: true
      },
      {
        title: 'Preview',
        value: summaryPreview.substring(0, 200) + (summaryPreview.length > 200 ? '...' : ''),
        short: false
      }
    ]
  })
}

export async function sendWeeklySummaryFailureNotification(
  error: any,
  step?: string
): Promise<void> {
  await sendSlackNotification({
    message: `🚨 Weekly changelog summary generation failed`,
    title: `Summary generation error${step ? ` during ${step}` : ''}`,
    color: 'danger',
    tagMaxi: true,
    fields: [
      ...(step
        ? [{
            title: 'Failed Step',
            value: step,
            short: true
          }]
        : [])
    ],
    context: {
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    }
  })
}
