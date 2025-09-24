import type { Release } from '../../../shared/types/releases'

export interface SourceConfig {
  enabled: boolean
  repos?: string[]
  projects?: string | Array<{ id: string, name: string }>
  packages?: string[]
  baseUrl?: string
  token?: string
  /**
   * ISO 8601 date string for filtering issues/PRs created after this date.
   * @example "2024-01-01T00:00:00Z"
   */
  since?: string
  /**
   * Array of GitHub label names to filter issues by.
   * @example ["bug", "enhancement", "documentation"]
   */
  labels?: string[]
  /**
   * State filter for issues/PRs.
   * For issues: 'open', 'closed', 'all'
   * For pull requests: 'open', 'closed', 'merged', 'all'
   * @example "open"
   */
  state?: string
  /**
   * Repository-specific branch filtering for pull requests.
   * Maps repository names to arrays of branch names to filter by.
   * @example { "owner/repo": ["main", "develop"], "other/repo": ["feature-branch"] }
   */
  branches?: Record<string, string[]>
  /**
   * Whether to include GitHub issues in the GitHub source
   */
  includeIssues?: boolean
  /**
   * Whether to include GitHub pull requests in the GitHub source
   */
  includePullRequests?: boolean
}

/**
 * Source item - can be a string for simple sources or an object for sources that need configuration
 */
export type SourceItem = string | {
  kind: string
  config?: Record<string, any>
}

/**
 * Grouped sources configuration
 */
export interface SourceGroup {
  /** Display label for the project, mostly for UI */
  label: string
  /** Single source for this group */
  source: SourceItem
  /** Access token if required for this group */
  token?: string
  /** Whether to show in releases page (defaults to true) */
  showInReleases?: boolean
  /** Whether to show in weekly summary (defaults to true) */
  showInSummary?: boolean
}

/**
 * Main sources configuration - array of source groups
 */
export type SourcesConfig = SourceGroup[]

export type SourceFetcher = (config: SourceConfig, repoFilter?: string) => Promise<Release[]>

export interface SourceMetadata {
  name: string
  description: string
  fetcher: SourceFetcher
}

/**
 * Configuration type for GitHub Pull Requests sources
 */
export interface GitHubPullRequestsConfig extends SourceConfig {
  repos: string[]
  since?: string
  state?: 'open' | 'closed' | 'merged' | 'all'
  branches?: Record<string, string[]>
}
