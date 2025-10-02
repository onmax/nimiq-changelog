import type { SourceMetadata, SourcesConfig, SourceGroup, SourceItem, SourceConfig } from './sources/types'
import { fetchGitHubReleases } from './sources/github'
import { fetchGitHubPullRequests } from './sources/github-pull-requests'
import { fetchGitHubIssuesFeedback } from './sources/github-issues-feedback'
import { fetchGitLabReleases } from './sources/gitlab'
import { fetchNpmReleases } from './sources/npm'
import { fetchNimiqWalletReleases } from './sources/nimiq-wallet'
import { fetchNimiqBlogReleases } from './sources/nimiq-blog'

// Source registry
export const sources: Record<string, SourceMetadata> = {
  'github': {
    name: 'GitHub',
    description: 'Fetch releases and tags from GitHub repositories',
    fetcher: fetchGitHubReleases
  },
  'gh_pr': {
    name: 'GitHub PRs',
    description: 'Fetch pull requests from GitHub repositories',
    fetcher: fetchGitHubPullRequests
  },
  'github-pull-requests': {
    name: 'GitHub Pull Requests',
    description: 'Fetch merged pull requests from GitHub repositories',
    fetcher: fetchGitHubPullRequests
  },
  'gitlab': {
    name: 'GitLab',
    description: 'Fetch releases from GitLab projects',
    fetcher: fetchGitLabReleases
  },
  'npm': {
    name: 'NPM',
    description: 'Fetch package versions from NPM registry',
    fetcher: fetchNpmReleases
  },
  'nimiq-wallet': {
    name: 'Nimiq Wallet',
    description: 'Fetch releases from Nimiq wallet applications',
    fetcher: fetchNimiqWalletReleases
  },
  'nimiq-blog': {
    name: 'Nimiq Blog',
    description: 'Fetch latest blog posts from nimiq.com/blog',
    fetcher: fetchNimiqBlogReleases
  },
  'github-issues-feedback': {
    name: 'GitHub Issues Feedback',
    description: 'Fetch open issues from nimiq/feedback repository for user feedback tracking',
    fetcher: fetchGitHubIssuesFeedback
  }
}

/**
 * Helper function to get all enabled source groups for releases
 */
export function getEnabledSourceGroupsForReleases(sourcesConfig: SourcesConfig): SourceGroup[] {
  return sourcesConfig.filter(group => group.showInReleases !== false)
}

/**
 * Helper function to get all enabled source groups for weekly summary
 */
export function getEnabledSourceGroupsForSummary(sourcesConfig: SourcesConfig): SourceGroup[] {
  return sourcesConfig.filter(group => group.showInSummary !== false)
}

/**
 * Helper function to normalize a source item to a source configuration
 */
export function normalizeSourceItem(item: SourceItem, groupToken?: string): { kind: string, config: SourceConfig } {
  if (typeof item === 'string') {
    // Handle prefixed strings
    if (item.startsWith('gh:')) {
      const repo = item.slice(3) // Remove 'gh:' prefix
      return {
        kind: 'github',
        config: {
          enabled: true,
          token: groupToken,
          repos: [repo]
        }
      }
    }

    if (item.startsWith('gh_pr:')) {
      const repo = item.slice(6) // Remove 'gh_pr:' prefix
      return {
        kind: 'gh_pr',
        config: {
          enabled: true,
          token: groupToken,
          repos: [repo]
        }
      }
    }

    if (item.startsWith('npm:')) {
      const packageName = item.slice(4) // Remove 'npm:' prefix
      return {
        kind: 'npm',
        config: {
          enabled: true,
          packages: [packageName]
        }
      }
    }

    if (item.startsWith('gh_issues_feedback:')) {
      const repo = item.slice(19) // Remove 'gh_issues_feedback:' prefix
      return {
        kind: 'github-issues-feedback',
        config: {
          enabled: true,
          token: groupToken,
          repos: [repo]
        }
      }
    }

    // Default behavior for unprefixed strings
    return {
      kind: item,
      config: {
        enabled: true,
        token: groupToken
      }
    }
  }

  // For gh_pr type, automatically set up PRs and issues
  if (item.kind === 'gh_pr') {
    return {
      kind: 'gh_pr',
      config: {
        enabled: true,
        token: groupToken,
        ...item.config
      }
    }
  }

  return {
    kind: item.kind,
    config: {
      enabled: true,
      token: groupToken,
      ...item.config
    }
  }
}

/**
 * Helper function to get all source configurations from grouped sources
 */
export function flattenSourceGroups(sourcesConfig: SourcesConfig, filterFn?: (group: SourceGroup) => boolean): Array<{ kind: string, config: SourceConfig, groupLabel: string }> {
  const filteredGroups = filterFn ? sourcesConfig.filter(filterFn) : sourcesConfig

  return filteredGroups.map((group) => {
    const normalized = normalizeSourceItem(group.source, group.token)
    return {
      ...normalized,
      groupLabel: group.label
    }
  })
}
