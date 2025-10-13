import process from 'node:process'
import { consola } from 'consola'
import { isProduction } from 'std-env'

interface SlackNotificationOptions {
  message: string
  threadTs?: string
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

export async function sendSlackNotification(options: SlackNotificationOptions): Promise<string | undefined> {
  // Only send notifications in production unless explicitly testing
  if (!isProduction && !process.env.NUXT_SLACK_WEBHOOK_URL_FORCE_DEV) {
    consola.info('Skipping Slack notification in development')
    return
  }

  consola.info('Attempting to send Slack notification...')
  consola.info('isProduction:', isProduction)

  const runtimeConfig = useRuntimeConfig()
  const slackBotToken = runtimeConfig.slackBotToken
  const channelId = runtimeConfig.slackChannelId

  consola.info('Bot token exists:', !!slackBotToken)
  consola.info('Channel ID:', channelId)

  if (!slackBotToken || !channelId) {
    consola.error('NUXT_SLACK_BOT_TOKEN and NUXT_SLACK_CHANNEL_ID are required')
    return
  }

  try {
    consola.info('Calling Slack API...')
    const response = await $fetch<{ ok: boolean, ts: string, error?: string }>('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackBotToken}`,
        'Content-Type': 'application/json'
      },
      body: {
        channel: channelId,
        text: options.message,
        ...(options.threadTs && { thread_ts: options.threadTs }),
        ...(options.attachments && { attachments: options.attachments })
      }
    })

    consola.info('Slack API response:', { ok: response.ok, error: response.error })

    if (!response.ok) {
      consola.error('Failed to send Slack notification:', response.error)
      return
    }

    consola.success('Slack notification sent successfully (message hidden for security)')

    // Upload file attachment if provided
    if (options.fileAttachment) {
      await uploadFileToSlack(options.fileAttachment, slackBotToken)
    }

    return response.ts
  } catch (error) {
    consola.error('Failed to send Slack notification:', error)
    return undefined
  }
}

async function uploadFileToSlack(fileAttachment: NonNullable<SlackNotificationOptions['fileAttachment']>, botToken: string): Promise<void> {
  try {
    const runtimeConfig = useRuntimeConfig()
    const channelId = runtimeConfig.slackChannelId

    if (!channelId) {
      consola.error('NUXT_SLACK_CHANNEL_ID not configured, cannot upload file')
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

    const response = await $fetch<{ ok: boolean, error?: string }>('https://slack.com/api/files.upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`
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
