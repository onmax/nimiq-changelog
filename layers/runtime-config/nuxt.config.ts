import { toStandardJsonSchema } from '@valibot/to-json-schema'
import * as v from 'valibot'

export default defineNuxtConfig({
  runtimeConfig: toStandardJsonSchema(v.object({
    webhookSecret: v.string(),
    slackBotToken: v.optional(v.string()),
    slackChannelId: v.optional(v.string()),
    googleApiKey: v.optional(v.string()),
    linearApiKey: v.optional(v.string()),
    sources: v.array(
      v.object({
        label: v.string(),
        source: v.union([
          v.string(),
          v.object({
            kind: v.string(),
            config: v.optional(v.record(v.string(), v.any()))
          })
        ]),
        token: v.optional(v.string()),
        showInReleases: v.optional(v.boolean()),
        showInSummary: v.optional(v.boolean())
      })
    )
  })),
})
