import { describe, it, expect } from 'vitest'
import { fetchNimiqWalletReleases } from './nimiq-wallet'

describe('Nimiq Frontend Source - Real Data', () => {
  it('should fetch real Nimiq frontend releases', async () => {
    const config = {
      enabled: true
    }

    const releases = await fetchNimiqWalletReleases(config)

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

      expect(release.repo).toMatch(/^nimiq\//)
      expect(release.url).toBe('#') // Nimiq frontend releases don't have direct URLs
      expect(new Date(release.date)).toBeInstanceOf(Date)
    }
  }, 10000)

  it('should return empty array when disabled', async () => {
    const config = {
      enabled: false
    }

    const releases = await fetchNimiqWalletReleases(config)
    expect(releases).toEqual([])
  })

  it('should filter by repo when repoFilter is provided', async () => {
    const config = {
      enabled: true
    }

    const releases = await fetchNimiqWalletReleases(config, 'wallet')

    expect(releases).toBeDefined()
    expect(Array.isArray(releases)).toBe(true)

    if (releases.length > 0) {
      releases.forEach((release) => {
        expect(release.repo).toContain('wallet')
      })
    }
  }, 10000)
})
