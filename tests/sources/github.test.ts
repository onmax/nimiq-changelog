import { describe, it, expect } from 'vitest'
import { fetchGitHubReleases } from '../../server/utils/sources/github'

describe('GitHub Source - Real Data', () => {
  it('should fetch real GitHub releases', async () => {
    const config = {
      enabled: true,
      repos: ['nimiq/core-rs-albatross']
    }

    const releases = await fetchGitHubReleases(config)

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

      expect(release.repo).toBe('nimiq/core-rs-albatross')
      expect(release.url).toContain('github.com')
      expect(new Date(release.date)).toBeInstanceOf(Date)
    }
  }, 10000) // 10 second timeout for API calls

  it('should return empty array when disabled', async () => {
    const config = {
      enabled: false,
      repos: ['nimiq/core-rs-albatross']
    }

    const releases = await fetchGitHubReleases(config)
    expect(releases).toEqual([])
  })

  it('should filter by repo when repoFilter is provided', async () => {
    const config = {
      enabled: true,
      repos: ['nimiq/core-rs-albatross', 'onmax/nimiq-mcp']
    }

    const releases = await fetchGitHubReleases(config, 'core-rs')

    expect(releases).toBeDefined()
    expect(Array.isArray(releases)).toBe(true)

    if (releases.length > 0) {
      releases.forEach((release) => {
        expect(release.repo).toContain('core-rs')
      })
    }
  }, 10000)
})
