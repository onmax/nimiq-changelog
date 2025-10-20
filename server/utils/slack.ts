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

export async function sendSlackNotification(
  options: SlackNotificationOptions
): Promise<string | undefined> {
  // Only send notifications in production unless explicitly testing
  if (!isProduction && !process.env.NUXT_SLACK_WEBHOOK_URL_FORCE_DEV) {
    consola.info('Skipping Slack notification in development')
    return
  }

  const runtimeConfig = useRuntimeConfig()
  const slackBotToken = runtimeConfig.slackBotToken
  const channelId = runtimeConfig.slackChannelId

  if (!slackBotToken || !channelId) {
    consola.error(
      'NUXT_SLACK_BOT_TOKEN and NUXT_SLACK_CHANNEL_ID are required'
    )
    return
  }

  try {
    const response = await $fetch<{ ok: boolean, ts: string, error?: string }>(
      'https://slack.com/api/chat.postMessage',
      {
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
      }
    )

    if (!response.ok) {
      consola.error('Failed to send Slack notification:', response.error)
      return
    }

    consola.success('Slack notification sent successfully')

    // Upload file attachment if provided
    if (options.fileAttachment) {
      await uploadFileToSlack(
        options.fileAttachment,
        slackBotToken,
        options.threadTs || response.ts
      )
    }

    return response.ts
  } catch (error) {
    consola.error('Failed to send Slack notification:', error)
    return undefined
  }
}

async function uploadFileToSlack(
  fileAttachment: NonNullable<SlackNotificationOptions['fileAttachment']>,
  botToken: string,
  threadTs?: string
): Promise<void> {
  try {
    const runtimeConfig = useRuntimeConfig()
    const channelId = runtimeConfig.slackChannelId

    if (!channelId) {
      consola.error('NUXT_SLACK_CHANNEL_ID not configured, cannot upload file')
      return
    }

    // Step 1: Get upload URL using files.getUploadURLExternal
    const contentBytes = new TextEncoder().encode(fileAttachment.content)

    consola.info('Requesting upload URL for file:', {
      filename: fileAttachment.filename,
      length: contentBytes.length
    })

    // Use form-urlencoded format as required by Slack API
    const params = new URLSearchParams()
    params.append('filename', fileAttachment.filename)
    params.append('length', contentBytes.length.toString())

    const uploadUrlResponse = await $fetch<{
      ok: boolean
      upload_url?: string
      file_id?: string
      error?: string
    }>('https://slack.com/api/files.getUploadURLExternal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    consola.info('Upload URL response:', uploadUrlResponse)

    if (
      !uploadUrlResponse.ok
      || !uploadUrlResponse.upload_url
      || !uploadUrlResponse.file_id
    ) {
      consola.error('Failed to get upload URL:', uploadUrlResponse.error)
      return
    }

    // Step 2: Upload file content to the URL
    await $fetch(uploadUrlResponse.upload_url, {
      method: 'POST',
      body: contentBytes
    })

    // Step 3: Complete the upload and share to channel
    const completeResponse = await $fetch<{ ok: boolean, error?: string }>(
      'https://slack.com/api/files.completeUploadExternal',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: [
            {
              id: uploadUrlResponse.file_id,
              title: fileAttachment.title || fileAttachment.filename
            }
          ],
          channel_id: channelId,
          ...(threadTs && { thread_ts: threadTs })
        })
      }
    )

    if (completeResponse.ok) {
      consola.success('File uploaded to Slack successfully')
    } else {
      consola.error('Failed to complete file upload:', completeResponse.error)
    }
  } catch (error) {
    consola.error('Failed to upload file to Slack:', error)
  }
}
