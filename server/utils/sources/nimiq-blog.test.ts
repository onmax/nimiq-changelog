import { describe, it, expect } from 'vitest'
import { fetchNimiqBlogReleases } from './nimiq-blog'

describe('Nimiq Blog Source - Real Data', () => {
  it('should fetch real Nimiq blog posts', async () => {
    const config = {
      enabled: true
    }

    const releases = await fetchNimiqBlogReleases(config)

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

      expect(release.repo).toBe('nimiq/blog')
      expect(release.url).toMatch(/https?:\/\//)
      expect(release.tag).toMatch(/^blog-\d{4}-\d{2}-\d{2}$/)
      expect(new Date(release.date)).toBeInstanceOf(Date)
      expect(release.title).toBeTruthy()
    }

    // Should fetch up to 8 posts
    expect(releases.length).toBeLessThanOrEqual(8)
  }, 30000) // Increased timeout for web scraping

  it('should return empty array when disabled', async () => {
    const config = {
      enabled: false
    }

    const releases = await fetchNimiqBlogReleases(config)
    expect(releases).toEqual([])
  })

  it('should parse specific blog post correctly', async () => {
    const config = {
      enabled: true
    }

    const releases = await fetchNimiqBlogReleases(config)

    if (releases.length > 0) {
      // Look for the treasury accumulation plan post or any post
      const testPost = releases.find(r =>
        r.title.toLowerCase().includes('treasury')
        || r.url.includes('announcing-the-nim-treasury-accumulation-plan')
      ) || releases[0]

      expect(testPost.title).toBeTruthy()
      expect(testPost.body).toBeDefined()

      // The body should be a parsed MDC structure
      if (testPost.body) {
        expect(testPost.body).toHaveProperty('type')
        expect(testPost.body.type).toBe('root')
        expect(testPost.body).toHaveProperty('children')
        expect(Array.isArray(testPost.body.children)).toBe(true)
      }
    }
  }, 30000)
})
