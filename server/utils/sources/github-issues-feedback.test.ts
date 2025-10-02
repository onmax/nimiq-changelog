import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchGitHubIssuesFeedback } from './github-issues-feedback'
import type { SourceConfig } from './types'
import * as fetchUtils from '../fetch'

describe('GitHub Issues Feedback Source', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return empty array when disabled', async () => {
    const config: SourceConfig = {
      enabled: false,
      repos: ['nimiq/feedback']
    }

    const releases = await fetchGitHubIssuesFeedback(config)
    expect(releases).toEqual([])
  })

  it('should return empty array when repos is empty', async () => {
    const config: SourceConfig = {
      enabled: true,
      repos: []
    }

    const releases = await fetchGitHubIssuesFeedback(config)
    expect(releases).toEqual([])
  })

  it('should return empty array when repos is undefined', async () => {
    const config: SourceConfig = {
      enabled: true
    }

    const releases = await fetchGitHubIssuesFeedback(config)
    expect(releases).toEqual([])
  })

  it('should fetch issues from nimiq/feedback repository', async () => {
    const config: SourceConfig = {
      enabled: true,
      repos: ['nimiq/feedback'],
      token: process.env.NUXT_GITHUB_TOKEN
    }

    const releases = await fetchGitHubIssuesFeedback(config)

    // Should return an array (may be empty if no issues in last 7 days)
    expect(Array.isArray(releases)).toBe(true)

    // If there are releases, validate structure
    if (releases.length > 0) {
      const release = releases[0]!
      expect(release).toHaveProperty('url')
      expect(release).toHaveProperty('repo')
      expect(release).toHaveProperty('tag')
      expect(release).toHaveProperty('title')
      expect(release).toHaveProperty('date')
      expect(release).toHaveProperty('body')

      // Verify repo is correct
      expect(release.repo).toBe('nimiq/feedback')

      // Verify tag format (#123)
      expect(release.tag).toMatch(/^#\d+$/)

      // URL should be a GitHub issue URL
      expect(release.url).toContain('github.com/nimiq/feedback/issues/')

      // Body should not contain images
      const bodyString = JSON.stringify(release.body)
      expect(bodyString).not.toMatch(/!\[.*?\]\(.*?\)/) // No markdown images
      expect(bodyString).not.toMatch(/<img[^>]*>/i) // No HTML img tags
    }
  }, 15000) // Longer timeout for API call

  it('should filter by repoFilter', async () => {
    const config: SourceConfig = {
      enabled: true,
      repos: ['nimiq/feedback', 'nimiq/core'],
      token: process.env.NUXT_GITHUB_TOKEN
    }

    const releases = await fetchGitHubIssuesFeedback(config, 'feedback')

    // All releases should be from feedback repo only
    releases.forEach((release) => {
      expect(release.repo).toContain('feedback')
    })
  }, 15000)

  it('should fetch and process mocked GitHub issues correctly', async () => {
    const originalEnv = process.env.NODE_ENV

    try {
      // Ensure we're in development mode for this test
      process.env.NODE_ENV = 'development'

      // Mock GitHub API response
      const mockIssues = [
        {
          number: 75,
          title: '[TEST] Verifying Slack integration',
          body: 'This is a test issue.\n\n![test image](https://example.com/image.png)\n\nSome more text.',
          state: 'open',
          labels: [
            { name: 'test' },
            { name: 'kind/feedback' }
          ],
          html_url: 'https://github.com/nimiq/feedback/issues/75',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          number: 76,
          title: 'Real feedback issue',
          body: 'User feedback without images.',
          state: 'open',
          labels: [
            { name: 'kind/feedback' }
          ],
          html_url: 'https://github.com/nimiq/feedback/issues/76',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]

      // Mock the fetch call (first call returns issues, second call returns empty for pagination end)
      vi.spyOn(fetchUtils, 'universalFetch')
        .mockResolvedValueOnce(mockIssues)
        .mockResolvedValueOnce([])

      const config: SourceConfig = {
        enabled: true,
        repos: ['nimiq/feedback'],
        token: 'test-token'
      }

      const releases = await fetchGitHubIssuesFeedback(config)

      console.log('Mock test - releases found:', releases.length)
      releases.forEach(r => console.log(`  - ${r.tag}: ${r.title}, labels in body: ${JSON.stringify(r.body).includes('Labels')}`))

      expect(releases).toHaveLength(2)

      // Check first issue (with test label and image)
      const testIssue = releases.find(r => r.tag === '#75')
      expect(testIssue).toBeDefined()
      expect(testIssue!.title).toBe('[TEST] Verifying Slack integration')
      expect(testIssue!.repo).toBe('nimiq/feedback')

      // Verify images were stripped
      const bodyString = JSON.stringify(testIssue!.body)
      expect(bodyString).not.toContain('![test image]')
      expect(bodyString).not.toContain('https://example.com/image.png')

      // Verify labels are included
      expect(bodyString).toContain('Labels:')
      expect(bodyString).toContain('test')
      expect(bodyString).toContain('kind/feedback')

      // Check second issue
      const realIssue = releases.find(r => r.tag === '#76')
      expect(realIssue).toBeDefined()
      expect(realIssue!.title).toBe('Real feedback issue')
    } finally {
      // Restore original env
      process.env.NODE_ENV = originalEnv
    }
  })

  it('should filter out test issues in production mode', async () => {
    const originalEnv = process.env.NODE_ENV

    try {
      // Mock production environment
      process.env.NODE_ENV = 'production'

      const mockIssues = [
        {
          number: 75,
          title: '[TEST] Test issue',
          body: 'Test content',
          state: 'open',
          labels: [{ name: 'test' }],
          html_url: 'https://github.com/nimiq/feedback/issues/75',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          number: 76,
          title: 'Real issue',
          body: 'Real content',
          state: 'open',
          labels: [{ name: 'kind/feedback' }],
          html_url: 'https://github.com/nimiq/feedback/issues/76',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]

      vi.spyOn(fetchUtils, 'universalFetch')
        .mockResolvedValueOnce(mockIssues)
        .mockResolvedValueOnce([])

      const config: SourceConfig = {
        enabled: true,
        repos: ['nimiq/feedback'],
        token: 'test-token'
      }

      const releases = await fetchGitHubIssuesFeedback(config)

      // In production, test issues should be filtered out
      expect(releases).toHaveLength(1)
      expect(releases[0]!.tag).toBe('#76')
      expect(releases[0]!.title).toBe('Real issue')

      // Test issue should not be present
      const testIssue = releases.find(r => r.tag === '#75')
      expect(testIssue).toBeUndefined()
    } finally {
      // Restore original env
      process.env.NODE_ENV = originalEnv
    }
  })
})
