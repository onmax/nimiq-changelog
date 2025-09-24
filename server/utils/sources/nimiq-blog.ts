import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { JSDOM } from 'jsdom'
import type { Release } from '../../../shared/types/releases'
import type { SourceConfig } from './types'

// Universal fetch for HTML content
async function fetchHtml(url: string, options?: any): Promise<string> {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.text()
}

function extractBlogContent(html: string): { title?: string, content?: string, publishDate?: string } {
  const dom = new JSDOM(html)
  const document = dom.window.document

  // Extract title from h1 element
  const h1Element = document.querySelector('h1')
  const title = h1Element?.textContent?.trim()

  // Extract publication date from <time> element
  const timeElement = document.querySelector('time')
  const publishDate = timeElement?.getAttribute('datetime') || timeElement?.textContent?.trim()

  // Extract content: h1 text + first paragraph of article
  const contentParts: string[] = []

  // Add h1 content
  if (title) {
    contentParts.push(title)
  }

  // Get first paragraph from article
  const articleFirstP = document.querySelector('article p:first-child')
  if (articleFirstP?.textContent?.trim()) {
    contentParts.push(articleFirstP.textContent.trim())
  }

  const content = contentParts.join(' ')

  return { title, content, publishDate }
}

export async function fetchNimiqBlogReleases(config: SourceConfig, repoFilter?: string): Promise<Release[]> {
  if (!config.enabled) {
    return []
  }

  try {
    // Fetch the blog page HTML
    const blogHtml = await fetchHtml('https://www.nimiq.com/blog', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    // Parse HTML to extract blog posts
    const blogReleases: Release[] = []

    // Extract blog post links from the page
    const linkMatches = blogHtml.match(/<a[^>]*href="([^"]*\/blog\/[^"]*)"[^>]*>/gi) || []
    const uniqueUrls = new Set<string>()

    // Create a map to track order (first link found = most recent)
    let count = 0
    const blogPostsWithOrder: Array<{ url: string, order: number }> = []

    for (const match of linkMatches) {
      if (count >= 8) break

      const urlMatch = match.match(/href="([^"]*)"/i)
      if (!urlMatch) continue

      let url = urlMatch[1]

      // Skip if it's just the blog root or already processed
      if (url === '/blog' || url === '/blog/' || uniqueUrls.has(url)) continue

      // Convert relative URLs to absolute
      if (url.startsWith('/')) url = `https://www.nimiq.com${url}`

      uniqueUrls.add(url)
      blogPostsWithOrder.push({ url, order: count })
      count++
    }

    // Process posts and extract their actual publish dates from HTML

    for (const { url, order } of blogPostsWithOrder) {

      try {
        // Fetch individual blog post to extract content
        const postHtml = await fetchHtml(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })

        // Extract content using our parsing function
        const { title, content, publishDate } = extractBlogContent(postHtml)

        // Generate title from URL if no h1 found
        const urlTitle = url.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Untitled'
        const finalTitle = title || urlTitle

        // Parse the content as markdown to create the MDCRoot structure
        const body = content ? (await parseMarkdown(content)).body : undefined

        // Use extracted publish date or fallback to default date
        let postDate: Date
        if (publishDate) {
          // Parse various date formats from the <time> element
          // Handle formats like "Aug 28", "Aug 25", etc.
          const dateStr = publishDate.trim()

          // Map month abbreviations to numbers
          const monthMap: Record<string, number> = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          }

          // Try to parse "Month Day" or "Month Day, Year" format (e.g., "Aug 28", "Aug 28, 2024")
          const monthDayMatch = dateStr.match(/^(\w{3})\s+(\d{1,2})(?:,\s*(\d{4}))?$/)
          if (monthDayMatch) {
            const [, monthStr, dayStr, yearStr] = monthDayMatch
            const month = monthMap[monthStr]
            const day = parseInt(dayStr, 10)
            const year = yearStr ? parseInt(yearStr, 10) : 2025 // Default to current year 2025

            if (month !== undefined && day >= 1 && day <= 31) {
              postDate = new Date(year, month, day)
            } else {
              postDate = new Date('2025-01-01') // fallback to 2025
            }
          } else {
            // Try to parse as full date string
            try {
              const parsed = new Date(dateStr)
              if (!isNaN(parsed.getTime())) {
                postDate = parsed
              } else {
                postDate = new Date('2025-01-01') // fallback to 2025
              }
            } catch {
              postDate = new Date('2025-01-01') // fallback to 2025
            }
          }
        } else {
          postDate = new Date('2025-01-01') // fallback to 2025
        }
        const date = postDate.toISOString()

        blogReleases.push({
          url,
          repo: 'Nimiq Blog',
          tag: `blog-${postDate.toISOString().split('T')[0]}`,
          title: finalTitle,
          date,
          body
        })

      } catch (postError) {
        console.warn(`Failed to fetch blog post ${url}:`, postError)
        continue
      }
    }

    return blogReleases
  } catch (error) {
    console.warn('Failed to fetch Nimiq blog posts:', error)
    return []
  }
}
