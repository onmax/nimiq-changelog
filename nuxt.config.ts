// https://nuxt.com/docs/api/configuration/nuxt-config
import process from 'node:process'
import { icons as nimiqIcons } from 'nimiq-icons'
import * as v from 'valibot'

export default defineNuxtConfig({
  devtools: {
    enabled: true
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/mdc',
    '@vueuse/nuxt',
    '@nuxt/fonts',
    '@nuxt/icon',
    'nuxt-safe-runtime-config'
  ],

  css: ['~/assets/css/main.css'],

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


  runtimeConfig: {
    gitlab: {
      token: process.env.NUXT_GITLAB_TOKEN || '',
      projects: process.env.NUXT_GITLAB_PROJECTS || '',
      baseUrl: process.env.NUXT_GITLAB_BASE_URL || 'https://scm.nim.team'
    },
  },
  safeRuntimeConfig: {
    $schema: v.object({
      gitlab: v.object({
        token: v.string(),
        projects: v.string(),
        baseUrl: v.pipe(v.string(), v.url())
      })
    })
  },
  icon: {
    // Helps resolve ambiguous CSS class names (runtime hint)
    collections: ['lucide', 'simple-icons'],
    // Register the custom Iconify collection provided by `nimiq-icons`
    customCollections: [nimiqIcons]
  },

  mdc: {
    highlight: {
      langs: ['diff', 'ts', 'vue', 'css', 'sh', 'js']
    }
  },

  routeRules: {
    '/': { isr: 60 }
  },

  compatibilityDate: '2025-06-01',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
