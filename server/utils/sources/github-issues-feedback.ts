import type { Release } from '../../../shared/types/releases'
import type { SourceConfig } from './types'
import { universalFetch } from '../fetch'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'

interface GitHubIssue {
  number: number
  title: string
  body: string | null
  state: string
  labels: Array<{ name: string }>
  html_url: string
  created_at: string
  updated_at: string
}

/**
 * Build GitHub Issues API URL with query parameters
 */
function buildIssuesApiUrl(repo: string, options: {
  state?: string
  since?: string
  page?: number
  per_page?: number
}): string {
  const baseUrl = `https://api.github.com/repos/${repo}/issues`
  const params = new URLSearchParams()

  // Fetch all issues (both open and closed)
  params.set('state', options.state || 'all')

  // Add since parameter for date filtering
  if (options.since) {
    params.set('since', options.since)
  }

  // Add pagination
  if (options.page) {
    params.set('page', options.page.toString())
  }
  params.set('per_page', (options.per_page || 100).toString())

  // Sort by updated time
  params.set('sort', 'updated')
  params.set('direction', 'desc')

  return `${baseUrl}?${params.toString()}`
}

/**
 * Build headers for GitHub API calls
 */
function buildGitHubHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Nimiq-Changelog'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

/**
 * Remove images from markdown content
 */
function stripImages(markdown: string): string {
  if (!markdown) return ''

  // Remove markdown image syntax: ![alt](url)
  let cleaned = markdown.replace(/!\[.*?\]\(.*?\)/g, '')

  // Remove HTML img tags
  cleaned = cleaned.replace(/<img[^>]*>/gi, '')

  // Remove standalone image URLs (common patterns)
  cleaned = cleaned.replace(/https?:\/\/.*?\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s]*)?/gi, '')

  return cleaned.trim()
}

/**
 * Transform GitHub Issue data to Release format
 */
async function transformIssueToRelease(issue: GitHubIssue, repo: string): Promise<Release> {
  // Strip images from body
  const cleanBody = stripImages(issue.body || '')

  // Include labels in the body content
  const labelsText = issue.labels.length > 0
    ? `\n\n**Labels:** ${issue.labels.map(l => l.name).join(', ')}`
    : ''

  const fullBody = cleanBody + labelsText

  // Parse the markdown content
  const body = fullBody
    ? (await parseMarkdown(fullBody)).body
    : {
        type: 'root' as const,
        children: [{
          type: 'element' as const,
          tag: 'p',
          props: {},
          children: [{ type: 'text' as const, value: issue.title }]
        }]
      }

  return {
    url: issue.html_url,
    repo,
    tag: `#${issue.number}`,
    title: issue.title,
    date: issue.created_at,
    body
  }
}

/**
 * Fetch GitHub Issues for a specific repository
 */
async function fetchRepositoryIssues(
  repo: string,
  token?: string,
  since?: string
): Promise<Release[]> {
  const releases: Release[] = []
  let page = 1
  let hasMore = true

  // Calculate default since date (7 days ago) if not provided
  const sinceDate = since || (() => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return sevenDaysAgo.toISOString()
  })()

  while (hasMore) {
    try {
      const url = buildIssuesApiUrl(repo, {
        state: 'all',
        since: sinceDate,
        page,
        per_page: 100
      })

      const headers = buildGitHubHeaders(token)
      const issues = await universalFetch<GitHubIssue[]>(url, { headers })

      if (issues.length === 0) {
        hasMore = false
        break
      }

      // Filter out pull requests (GitHub API returns both issues and PRs in /issues endpoint)
      let actualIssues = issues.filter(issue => !issue.html_url.includes('/pull/'))

      // Filter out test issues in production
      // In development/test mode (NODE_ENV !== 'production'), include test issues
      const isProduction = process.env.NODE_ENV === 'production'
      if (isProduction) {
        actualIssues = actualIssues.filter((issue) => {
          const hasTestLabel = issue.labels.some(label => label.name === 'test')
          return !hasTestLabel
        })
      }

      for (const issue of actualIssues) {
        // Transform and add to releases
        const release = await transformIssueToRelease(issue, repo)
        if (release.date) {
          releases.push(release)
        }
      }

      // Check if we should continue pagination
      if (issues.length < 100) {
        hasMore = false
      } else {
        page++
      }
    } catch (error) {
      console.error(`Failed to fetch issues for ${repo}:`, error)
      hasMore = false
    }
  }

  return releases
}

/**
 * Main function to fetch GitHub Issues Feedback
 */
export async function fetchGitHubIssuesFeedback(
  config: SourceConfig,
  repoFilter?: string
): Promise<Release[]> {
  if (!config.enabled || !config.repos || config.repos.length === 0) {
    return []
  }

  // Filter repositories if repoFilter is provided
  const repos = repoFilter
    ? config.repos.filter(r => r.includes(repoFilter))
    : config.repos

  if (repos.length === 0) {
    return []
  }

  // Fetch issues for all repositories
  const allReleases = await Promise.all(
    repos.map(repo => fetchRepositoryIssues(repo, config.token, config.since))
  )

  // Flatten and return
  return allReleases.flat()
}
