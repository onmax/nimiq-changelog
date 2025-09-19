import { describe, it, expect } from 'vitest'
import { fetchGitLabReleases } from './gitlab'

describe('GitLab Source - Real Data', () => {
  it('should fetch real GitLab releases', async () => {
    const config = {
      enabled: true,
      projects: [{ id: 'apps%2Fpay%2Fnimiq-pay-app', name: 'nimiq/pay-app' }],
      baseUrl: process.env.NUXT_GITLAB_BASE_URL || 'https://scm.nim.team',
      token: process.env.NUXT_GITLAB_TOKEN || ''
    }

    // Skip test if no token is available
    if (!config.token) {
      console.warn('GitLab token not available, skipping real data test')
      return
    }

    const releases = await fetchGitLabReleases(config)

    expect(releases).toBeDefined()
    expect(Array.isArray(releases)).toBe(true)

    if (releases.length > 0) {
      const release = releases[0]
      expect(release).toHaveProperty('url')
      expect(release).toHaveProperty('repo')
      expect(release).toHaveProperty('tag')
      expect(release).toHaveProperty('title')
      expect(release).toHaveProperty('date')
      expect(release).toHaveProperty('body')

      expect(release.repo).toBe('nimiq/pay-app')
      expect(release.url).toContain('scm.nim.team')
      expect(release.url).toContain('releases')
      expect(new Date(release.date)).toBeInstanceOf(Date)
    }
  }, 15000) // 15 second timeout for GitLab API calls

  it('should return empty array when disabled', async () => {
    const config = {
      enabled: false,
      projects: [{ id: 'apps%2Fpay%2Fnimiq-pay-app', name: 'nimiq/pay-app' }],
      baseUrl: process.env.NUXT_GITLAB_BASE_URL || 'https://scm.nim.team',
      token: process.env.NUXT_GITLAB_TOKEN || 'test-token'
    }

    const releases = await fetchGitLabReleases(config)
    expect(releases).toEqual([])
  })

  it('should return empty array when no token provided', async () => {
    const config = {
      enabled: true,
      projects: [{ id: 'apps%2Fpay%2Fnimiq-pay-app', name: 'nimiq/pay-app' }],
      baseUrl: process.env.NUXT_GITLAB_BASE_URL || 'https://scm.nim.team',
      token: ''
    }

    const releases = await fetchGitLabReleases(config)
    expect(releases).toEqual([])
  })

  it('should return empty array when no projects provided', async () => {
    const config = {
      enabled: true,
      projects: [],
      baseUrl: process.env.NUXT_GITLAB_BASE_URL || 'https://scm.nim.team',
      token: process.env.NUXT_GITLAB_TOKEN || 'test-token'
    }

    const releases = await fetchGitLabReleases(config)
    expect(releases).toEqual([])
  })

  it('should return empty array when no baseUrl provided', async () => {
    const config = {
      enabled: true,
      projects: [{ id: 'apps%2Fpay%2Fnimiq-pay-app', name: 'nimiq/pay-app' }],
      baseUrl: '',
      token: process.env.NUXT_GITLAB_TOKEN || 'test-token'
    }

    const releases = await fetchGitLabReleases(config)
    expect(releases).toEqual([])
  })

  it('should filter by repo when repoFilter is provided', async () => {
    const config = {
      enabled: true,
      projects: [{ id: 'apps%2Fpay%2Fnimiq-pay-app', name: 'nimiq/pay-app' }],
      baseUrl: process.env.NUXT_GITLAB_BASE_URL || 'https://scm.nim.team',
      token: process.env.NUXT_GITLAB_TOKEN || ''
    }

    // Skip test if no token is available
    if (!config.token) {
      console.warn('GitLab token not available, skipping real data test')
      return
    }

    const releases = await fetchGitLabReleases(config, 'pay')

    expect(releases).toBeDefined()
    expect(Array.isArray(releases)).toBe(true)

    if (releases.length > 0) {
      releases.forEach((release) => {
        expect(release.repo).toContain('pay')
      })
    }
  }, 15000)
})
