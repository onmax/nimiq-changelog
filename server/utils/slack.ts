import process from 'node:process'
import { consola } from 'consola'
import { isProduction } from 'std-env'

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
  fileAttachment?: {
    content: string
    filename: string
    filetype: string
    title?: string
  }
}

export async function sendSlackNotification(options: SlackNotificationOptions): Promise<void> {
  // Only send notifications in production unless explicitly testing
  if (!isProduction && !process.env.NUXT_SLACK_WEBHOOK_URL_FORCE_DEV) {
    consola.info('Skipping Slack notification in development:', options.message)
    return
  }

  const runtimeConfig = useRuntimeConfig()
  const { slackWebhookUrl } = runtimeConfig
  const slackBotToken = process.env.NUXT_SLACK_BOT_TOKEN

  if (!slackWebhookUrl) {
    consola.warn('NUXT_SLACK_WEBHOOK_URL not configured, skipping Slack notification')
    return
  }

  // Send the main message via webhook
  const slackMessage: SlackMessage = {
    text: options.message,
    ...(options.attachments && { attachments: options.attachments })
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

    // If there's a file attachment and we have a bot token, upload the file
    if (options.fileAttachment && slackBotToken) {
      await uploadFileToSlack(options.fileAttachment, slackBotToken)
    } else if (options.fileAttachment && !slackBotToken) {
      consola.warn('File attachment requested but NUXT_SLACK_BOT_TOKEN not configured')
    }

  } catch (error) {
    consola.error('Failed to send Slack notification:', error)
  }
}

async function uploadFileToSlack(fileAttachment: NonNullable<SlackNotificationOptions['fileAttachment']>, botToken: string): Promise<void> {
  try {
    // Get the channel ID from the webhook URL (extract from URL pattern)
    const channelId = process.env.NUXT_SLACK_CHANNEL_ID

    if (!channelId) {
      consola.warn('NUXT_SLACK_CHANNEL_ID not configured, cannot upload file')
      return
    }

    // Create form data for file upload
    const formData = new FormData()
    const fileBlob = new Blob([fileAttachment.content], { type: 'text/markdown' })

    formData.append('file', fileBlob, fileAttachment.filename)
    formData.append('channels', channelId)
    formData.append('filetype', fileAttachment.filetype)

    if (fileAttachment.title) {
      formData.append('title', fileAttachment.title)
    }

    const response = await $fetch('https://slack.com/api/files.upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`
      },
      body: formData
    })

    if (response.ok) {
      consola.success('File uploaded to Slack successfully')
    } else {
      consola.error('Failed to upload file to Slack:', response.error)
    }

  } catch (error) {
    consola.error('Failed to upload file to Slack:', error)
  }
}
