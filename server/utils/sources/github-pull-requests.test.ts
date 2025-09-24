import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchGitHubPullRequests } from './github-pull-requests'
import type { GitHubPullRequestsConfig } from './types'

// Mock the fetch utility
vi.mock('../fetch', () => ({
  universalFetch: vi.fn()
}))

describe('fetchGitHubPullRequests', () => {
  // Create test data with dates within the last 7 days
  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()

  const mockPullRequest = {
    number: 123,
    title: 'feat: Add new feature',
    merged_at: twoDaysAgo,
    html_url: 'https://github.com/owner/repo/pull/123'
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return empty array when disabled', async () => {
    const config: GitHubPullRequestsConfig = {
      enabled: false,
      repos: ['owner/repo']
    }

    const result = await fetchGitHubPullRequests(config)
    expect(result).toEqual([])
  })

  it('should return empty array when no repos configured', async () => {
    const config: GitHubPullRequestsConfig = {
      enabled: true,
      repos: []
    }

    const result = await fetchGitHubPullRequests(config)
    expect(result).toEqual([])
  })

  it('should fetch and transform pull requests', async () => {
    const { universalFetch } = await import('../fetch')
    const mockFetch = vi.mocked(universalFetch)

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({
          'X-RateLimit-Remaining': '100'
        }),
        json: () => Promise.resolve([mockPullRequest])
      } as Response)
    )

    const config: GitHubPullRequestsConfig = {
      enabled: true,
      repos: ['owner/repo']
    }

    const result = await fetchGitHubPullRequests(config)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('feat: Add new feature')
    expect(result[0].repo).toBe('owner/repo')
    expect(result[0].url).toBe('https://github.com/owner/repo/pull/123')
  })

  it('should filter by date (last 7 days)', async () => {
    const { universalFetch } = await import('../fetch')
    const mockFetch = vi.mocked(universalFetch)

    const recentPR = { ...mockPullRequest, number: 101 }

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve([recentPR])
      } as Response)
    )

    const config: GitHubPullRequestsConfig = {
      enabled: true,
      repos: ['owner/repo']
    }

    const result = await fetchGitHubPullRequests(config)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('feat: Add new feature')
  })

  it('should call API with correct parameters', async () => {
    const { universalFetch } = await import('../fetch')
    const mockFetch = vi.mocked(universalFetch)

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve([])
      } as Response)
    )

    const config: GitHubPullRequestsConfig = {
      enabled: true,
      repos: ['owner/repo']
    }

    await fetchGitHubPullRequests(config)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('state=closed'),
      expect.any(Object)
    )
  })

  it('should handle multiple repositories', async () => {
    const { universalFetch } = await import('../fetch')
    const mockFetch = vi.mocked(universalFetch)

    // Create PRs from different repositories with different titles to distinguish them
    mockFetch
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve([{ ...mockPullRequest, number: 1, title: 'feat: Repo1 feature' }])
        } as Response)
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve([{ ...mockPullRequest, number: 2, title: 'feat: Repo2 feature' }])
        } as Response)
      )

    const config: GitHubPullRequestsConfig = {
      enabled: true,
      repos: ['owner/repo1', 'owner/repo2']
    }

    const result = await fetchGitHubPullRequests(config)

    // Since they are from the same week, they should be grouped into a single release
    expect(result).toHaveLength(1)
    expect(result[0].title).toContain('feat: Repo1 feature; feat: Repo2 feature')
  })

  it('should handle API rate limit errors', async () => {
    const { universalFetch } = await import('../fetch')
    const mockFetch = vi.mocked(universalFetch)

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '1710500000'
        })
      } as Response)
    )

    const config: GitHubPullRequestsConfig = {
      enabled: true,
      repos: ['owner/repo']
    }

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await fetchGitHubPullRequests(config)

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch pull requests'),
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  it('should use authentication token when provided', async () => {
    const { universalFetch } = await import('../fetch')
    const mockFetch = vi.mocked(universalFetch)

    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve([])
      } as Response)
    )

    const config: GitHubPullRequestsConfig = {
      enabled: true,
      repos: ['owner/repo'],
      token: 'test-token-123'
    }

    await fetchGitHubPullRequests(config)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-123'
        })
      })
    )
  })

  it('should use PR title directly', async () => {
    const { universalFetch } = await import('../fetch')
    const mockFetch = vi.mocked(universalFetch)

    const conventionalPR = {
      ...mockPullRequest,
      title: 'fix: Resolve critical bug in authentication'
    }

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve([conventionalPR])
      } as Response)
    )

    const config: GitHubPullRequestsConfig = {
      enabled: true,
      repos: ['owner/repo']
    }

    const result = await fetchGitHubPullRequests(config)

    expect(result[0].title).toBe('fix: Resolve critical bug in authentication')
  })

  it('should filter by repository when repoFilter is provided', async () => {
    const config: GitHubPullRequestsConfig = {
      enabled: true,
      repos: ['owner/repo1', 'owner/repo2', 'owner/repo3']
    }

    const { universalFetch } = await import('../fetch')
    const mockFetch = vi.mocked(universalFetch)

    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve([])
      } as Response)
    )

    await fetchGitHubPullRequests(config, 'owner/repo2')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('owner/repo2'),
      expect.any(Object)
    )
  })
})
