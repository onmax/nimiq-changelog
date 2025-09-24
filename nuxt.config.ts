// https://nuxt.com/docs/api/configuration/nuxt-config
import process from 'node:process'
import { icons as nimiqIcons } from 'nimiq-icons'
import * as v from 'valibot'
import { sourcesConfig } from './sources.config'

export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/mdc',
    '@vueuse/nuxt',
    '@nuxt/fonts',
    '@nuxt/icon',
    'nuxt-safe-runtime-config',
    '@nuxthub/core'
  ],
  devtools: {
    enabled: true
  },

  app: {
    head: {
      title: 'Nimiq Changelog',
      meta: [
        { name: 'description', content: 'Stay up to date with the latest changes and releases from Nimiq projects' },
        { property: 'og:title', content: 'Nimiq Changelog' },
        { property: 'og:description', content: 'Stay up to date with the latest changes and releases from Nimiq projects' },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: '/og.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '600' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: '/og.png' },
        { name: 'theme-color', content: '#1f2348' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  mdc: {
    highlight: {
      langs: ['diff', 'ts', 'vue', 'css', 'sh', 'js']
    }
  },

  runtimeConfig: {
    webhookSecret: process.env.NUXT_WEBHOOK_SECRET || '',
    slackWebhookUrl: process.env.NUXT_SLACK_WEBHOOK_URL,
    sources: sourcesConfig
  },

  routeRules: {
    '/': { cache: { maxAge: 60 * 10, swr: true } },
    '/api/releases': { cache: { maxAge: 60 * 10, swr: true } },
    '/_nuxt/**': { headers: { 'cache-control': 'max-age=31536000' } }
  },

  compatibilityDate: '2025-06-01',
  hub: {
    cache: true,
    kv: true,
    ai: false
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  fonts: {
    families: [
      {
        name: 'Mulish',
        provider: 'google',
        weights: [400, 500, 600, 700],
        styles: ['normal', 'italic']
      },
      {
        name: 'Fira Code',
        provider: 'google',
        weights: [400, 500, 600],
        styles: ['normal']
      }
    ]
  },
  icon: {
    // Helps resolve ambiguous CSS class names (runtime hint)
    collections: ['lucide', 'simple-icons'],
    // Register the custom Iconify collection provided by `nimiq-icons`
    customCollections: [nimiqIcons]
  },
  safeRuntimeConfig: {
    $schema: v.object({
      webhookSecret: v.string(),
      slackWebhookUrl: v.pipe(v.string(), v.minLength(1, 'NUXT_SLACK_WEBHOOK_URL is required'), v.url()),
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
    })
  }
})
