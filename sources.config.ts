import process from 'node:process'
import type { SourcesConfig } from './server/utils/sources/types'

export const sourcesConfig: SourcesConfig = [
  {
    label: 'Nimiq Core',
    token: process.env.NUXT_GITHUB_TOKEN || '',
    source: 'gh:nimiq/core-rs-albatross'
  },
  ...(process.env.NUXT_INTERNAL_PROJECT_SOURCE
    ? [{
        label: process.env.NUXT_INTERNAL_PROJECT_LABEL || 'Internal Project',
        token: process.env.NUXT_INTERNAL_PROJECT_SOURCE?.includes('bug-bounty-dashboard')
          ? (process.env.NUXT_PRIVATE_GITHUB_TOKEN || process.env.NUXT_GITHUB_TOKEN || '')
          : (process.env.NUXT_GITHUB_TOKEN || ''),
        source: process.env.NUXT_INTERNAL_PROJECT_SOURCE,
        showInReleases: false,
        showInSummary: true
      }]
    : []),
  {
    label: 'Nimiq MCP',
    token: process.env.NUXT_GITHUB_TOKEN || '',
    source: 'gh:onmax/nimiq-mcp'
  },
  {
    label: 'Albatross RPC Client',
    token: process.env.NUXT_GITHUB_TOKEN || '',
    source: 'gh:onmax/albatross-rpc-client-ts'
  },
  {
    label: 'Developer Center',
    token: process.env.NUXT_GITHUB_TOKEN || '',
    source: {
      kind: 'gh_pr',
      config: {
        repos: ['nimiq/developer-center'],
        since: '2024-01-01T00:00:00Z',
        state: 'closed'
      }
    }
  },
  {
    label: 'Nimiq Pay',
    token: process.env.NUXT_GITLAB_TOKEN || '',
    showInReleases: !!(process.env.NUXT_GITLAB_TOKEN && process.env.NUXT_GITLAB_PROJECTS),
    source: {
      kind: 'gitlab',
      config: {
        projects: process.env.NUXT_GITLAB_PROJECTS || '',
        baseUrl: process.env.NUXT_GITLAB_BASE_URL || ''
      }
    }
  },
  { label: 'Nimiq Utils', source: 'npm:@nimiq/utils' },
  { label: 'Nimiq Wallet', source: 'nimiq-wallet' },
  { label: 'Nimiq Blog', source: 'nimiq-blog' },
  ...(process.env.NUXT_FEEDBACK_GITHUB_TOKEN
    ? [{
        label: 'Nimiq Feedback',
        token: process.env.NUXT_FEEDBACK_GITHUB_TOKEN,
        source: `gh_issues_feedback:${process.env.NUXT_FEEDBACK_REPO || 'nimiq/feedback'}`,
        showInReleases: false,
        showInSummary: true
      }]
    : [])
]
