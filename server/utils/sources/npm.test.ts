import { describe, it, expect } from 'vitest'
import { fetchNpmReleases } from './npm'

describe('NPM Source - Real Data', () => {
  it('should fetch real NPM package releases for @nimiq/utils', async () => {
    const config = {
      enabled: true,
      packages: ['@nimiq/utils']
    }

    const releases = await fetchNpmReleases(config)

    expect(releases).toBeDefined()
    expect(Array.isArray(releases)).toBe(true)
    expect(releases.length).toBeGreaterThan(0)

    const release = releases[0]
    expect(release).toHaveProperty('url')
    expect(release).toHaveProperty('repo')
    expect(release).toHaveProperty('tag')
    expect(release).toHaveProperty('title')
    expect(release).toHaveProperty('date')
    expect(release).toHaveProperty('body')

    expect(release.repo).toBe('npm/@nimiq/utils')
    expect(release.url).toContain('npmjs.com')
    expect(release.url).toContain('@nimiq/utils')
    expect(release.title).toContain('@nimiq/utils@')
    expect(new Date(release.date)).toBeInstanceOf(Date)
  })

  it('should return empty array when disabled', async () => {
    const config = {
      enabled: false,
      packages: ['@nimiq/utils']
    }

    const releases = await fetchNpmReleases(config)
    expect(releases).toEqual([])
  })

  it('should filter by package name when repoFilter is provided', async () => {
    const config = {
      enabled: true,
      packages: ['@nimiq/utils']
    }

    const releases = await fetchNpmReleases(config, 'nimiq')

    expect(releases).toBeDefined()
    expect(Array.isArray(releases)).toBe(true)

    if (releases.length > 0) {
      releases.forEach((release) => {
        expect(release.repo).toContain('nimiq')
      })
    }
  })
})
