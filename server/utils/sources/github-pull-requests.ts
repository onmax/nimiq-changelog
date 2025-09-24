import type { Release } from '../../../shared/types/releases'
import type { SourceConfig, GitHubPullRequestsConfig } from './types'
import { universalFetch } from '../fetch'

interface GitHubPullRequest {
  number: number
  title: string
  merged_at: string | null
  html_url: string
}

/**
 * Build GitHub Pull Requests API URL with query parameters
 */
function buildPullRequestsApiUrl(repo: string, options: {
  state?: string
  page?: number
  per_page?: number
}): string {
  const baseUrl = `https://api.github.com/repos/${repo}/pulls`
  const params = new URLSearchParams()

  // Only fetch merged PRs
  params.set('state', 'closed')

  // Add pagination
  if (options.page) {
    params.set('page', options.page.toString())
  }
  params.set('per_page', (options.per_page || 30).toString())

  // Sort by updated time
  params.set('sort', 'updated')
  params.set('direction', 'desc')

  return `${baseUrl}?${params.toString()}`
}

/**
 * Handle GitHub API errors with rate limiting support
 */
async function handleGitHubApiCall<T>(url: string, token?: string): Promise<T> {
  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Nimiq-Changelog'
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await universalFetch(url, { headers })

    if (!response.ok) {
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
        const rateLimitReset = response.headers.get('X-RateLimit-Reset')

        if (rateLimitRemaining === '0') {
          const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toISOString() : 'unknown'
          throw new Error(`GitHub API rate limit exceeded. Resets at: ${resetTime}`)
        }
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`GitHub API call failed for URL: ${url}`, error)
    throw error
  }
}

/**
 * Transform GitHub PR data to Release format
 */
function transformPullRequestToRelease(pr: GitHubPullRequest, repo: string): Release {
  return {
    url: pr.html_url,
    repo,
    tag: `#${pr.number}`,
    title: pr.title,
    date: pr.merged_at || '',
    body: {
      type: 'root',
      children: [{
        type: 'element',
        tag: 'p',
        props: {},
        children: [{ type: 'text', value: pr.title }]
      }]
    }
  }
}

/**
 * Filter pull request by date (last 7 days)
 */
function filterPullRequestByDate(pr: GitHubPullRequest): boolean {
  if (!pr.merged_at) {
    return false // Only merged PRs
  }

  const prDate = new Date(pr.merged_at)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  return prDate >= sevenDaysAgo
}

/**
 * Fetch GitHub Pull Requests for a specific repository
 */
async function fetchRepositoryPullRequests(
  repo: string,
  token?: string
): Promise<Release[]> {
  const releases: Release[] = []
  let page = 1
  let hasMore = true
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  while (hasMore) {
    try {
      const url = buildPullRequestsApiUrl(repo, {
        page,
        per_page: 100
      })

      const pullRequests = await handleGitHubApiCall<GitHubPullRequest[]>(url, token)

      if (pullRequests.length === 0) {
        hasMore = false
        break
      }

      for (const pr of pullRequests) {
        // Only process merged PRs from the last 7 days
        if (!filterPullRequestByDate(pr)) {
          // Since results are sorted by updated time, we can stop here
          if (pr.merged_at && new Date(pr.merged_at) < sevenDaysAgo) {
            hasMore = false
            break
          }
          continue
        }

        // Transform and add to releases
        const release = transformPullRequestToRelease(pr, repo)
        if (release.date) {
          releases.push(release)
        }
      }

      // Check if we should continue pagination
      if (pullRequests.length < 100) {
        hasMore = false
      } else {
        page++
      }
    } catch (error) {
      console.error(`Failed to fetch pull requests for ${repo}:`, error)
      hasMore = false
    }
  }

  return releases
}

/**
 * Group PRs into weekly releases with up to 3 items each
 */
function groupIntoWeeklyReleases(releases: Release[]): Release[] {
  if (releases.length === 0) return []

  // Sort by date (newest first)
  const sorted = releases.sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime()
    const dateB = new Date(b.date || 0).getTime()
    return dateB - dateA
  })

  const weeklyReleases: Release[] = []
  let currentGroup: Release[] = []
  let currentWeekStart: Date | null = null

  for (const release of sorted) {
    const releaseDate = new Date(release.date)
    const weekStart = new Date(releaseDate)
    weekStart.setDate(releaseDate.getDate() - releaseDate.getDay()) // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0)

    // If it's a new week or current group has 3 items, create a new release
    if (!currentWeekStart
      || weekStart.getTime() !== currentWeekStart.getTime()
      || currentGroup.length >= 3) {
      // Save previous group if it has items
      if (currentGroup.length > 0) {
        const groupTitle = currentGroup.map(r => r.title).join('; ')
        const groupBody = {
          type: 'root' as const,
          children: currentGroup.map(r => ({
            type: 'element' as const,
            tag: 'li',
            props: {},
            children: [{ type: 'text' as const, value: r.title }]
          }))
        }

        const firstRelease = currentGroup[0]
        if (firstRelease) {
          weeklyReleases.push({
            url: firstRelease.url,
            repo: firstRelease.repo,
            tag: `Week of ${currentWeekStart!.toISOString().split('T')[0]}`,
            title: groupTitle.length > 100 ? groupTitle.substring(0, 97) + '...' : groupTitle,
            date: firstRelease.date,
            body: groupBody
          })
        }
      }

      // Start new group
      currentGroup = [release]
      currentWeekStart = weekStart
    } else {
      // Add to current group
      currentGroup.push(release)
    }
  }

  // Handle the last group
  if (currentGroup.length > 0 && currentWeekStart) {
    const groupTitle = currentGroup.map(r => r.title).join('; ')
    const groupBody = {
      type: 'root' as const,
      children: currentGroup.map(r => ({
        type: 'element' as const,
        tag: 'li',
        props: {},
        children: [{ type: 'text' as const, value: r.title }]
      }))
    }

    const firstRelease = currentGroup[0]
    if (firstRelease) {
      weeklyReleases.push({
        url: firstRelease.url,
        repo: firstRelease.repo,
        tag: `Week of ${currentWeekStart.toISOString().split('T')[0]}`,
        title: groupTitle.length > 100 ? groupTitle.substring(0, 97) + '...' : groupTitle,
        date: firstRelease.date,
        body: groupBody
      })
    }
  }

  return weeklyReleases
}

/**
 * Main function to fetch GitHub Pull Requests
 */
export async function fetchGitHubPullRequests(
  config: SourceConfig,
  repoFilter?: string
): Promise<Release[]> {
  const githubConfig = config as GitHubPullRequestsConfig

  if (!githubConfig.enabled || !githubConfig.repos || githubConfig.repos.length === 0) {
    return []
  }

  // Filter repositories if repoFilter is provided
  const repos = repoFilter
    ? githubConfig.repos.filter(r => r.includes(repoFilter))
    : githubConfig.repos

  if (repos.length === 0) {
    return []
  }

  // Fetch pull requests for all repositories
  const allReleases = await Promise.all(
    repos.map(repo => fetchRepositoryPullRequests(repo, githubConfig.token))
  )

  // Flatten all releases
  const flatReleases = allReleases.flat()

  // Group into weekly releases
  return groupIntoWeeklyReleases(flatReleases)
}
