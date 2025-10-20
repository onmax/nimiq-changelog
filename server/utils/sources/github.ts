import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import type { Release } from '../../../shared/types/releases'
import type { SourceConfig } from './types'
import { parseCommitMessage } from '../parseCommitMessage'
import { groupCommits, groupedCommitsToMarkdown } from '../groupCommits'
import { extractCommitMessages } from '../extractCommitMessages'
import { universalFetch } from '../fetch'

async function processReleaseBody(bodyContent: string, repo: string) {
  const body = (await parseMarkdown(bodyContent)).body

  // Check if the release body has headers (h2, h3, etc.) - if so, it's already well-formatted
  const hasHeaders = body.children?.some((child: any) =>
    child.type === 'element' && ['h1', 'h2', 'h3', 'h4'].includes(child.tag)
  )

  // If the release has headers, preserve the original formatting
  if (hasHeaders) {
    return body
  }

  // Extract commit messages from the structured body
  const commitMessages = extractCommitMessages(body)

  if (commitMessages.length > 0) {
    // Parse and group the commit messages
    const parsedMessages = commitMessages.map(msg => parseCommitMessage(msg, repo))
    const grouped = groupCommits(parsedMessages)

    // Generate grouped markdown if we have content
    if (grouped.ungrouped.length > 0 || grouped.groups.length > 0) {
      const groupedMarkdown = groupedCommitsToMarkdown(grouped)
      // Parse the grouped markdown back to MDCRoot
      return (await parseMarkdown(groupedMarkdown)).body
    }
  }

  return body
}

function removeDuplicateWhatsSections(body: any) {
  const children = body.children.filter((child: any, index: number) => {
    if (child.type === 'element' && child.tag === 'h2'
      && child.children?.[0]?.type === 'text' && child.children[0].value === 'What\'s Changed') {
      // Check if the next element is an h3 with "What's changed"
      const nextChild = body.children[index + 1]
      if (nextChild?.type === 'element' && nextChild.tag === 'h3'
        && nextChild.children?.[0]?.type === 'text'
        && nextChild.children[0].value.toLowerCase() === 'what\'s changed') {
        return false // Remove the duplicate h2
      }
    }
    return true
  })

  return { ...body, children }
}

export async function fetchGitHubReleases(config: SourceConfig, repoFilter?: string): Promise<Release[]> {
  if (!config.enabled || !config.repos) {
    return []
  }

  // Filter repos if specified
  const filteredRepos = repoFilter ? config.repos.filter(repo => repo.includes(repoFilter)) : config.repos

  const allReleases = await fetchGitHubReleasesAndTags(config, filteredRepos)

  return allReleases
}

async function fetchGitHubReleasesAndTags(config: SourceConfig, filteredRepos: string[]): Promise<Release[]> {
  const releases: Release[] = await Promise.all(
    filteredRepos.map(async (repo) => {
      try {
        // First try to fetch releases (existing method)
        const { releases } = await universalFetch<{ releases: any[] }>(`https://ungh.cc/repos/${repo}/releases`)

        if (releases && releases.length > 0) {
          // Use existing releases method but also parse the content for links
          return Promise.all(
            releases
              .filter(r => r.draft === false)
              .map(async (release) => {
                // Parse the markdown content to enhance with links
                const parsedMarkdown = parseCommitMessage(release.markdown, repo)
                const body = await processReleaseBody(parsedMarkdown, repo)
                return {
                  url: `https://github.com/${repo}/releases/tag/${release.tag}`,
                  repo,
                  tag: release.tag,
                  title: release.name || release.tag,
                  date: release.publishedAt,
                  body: removeDuplicateWhatsSections(body)
                }
              })
          )
        }

        // Fallback: generate releases from tags
        console.log(`No releases found for ${repo}, generating from tags`)
        const tags = await universalFetch<any[]>(`https://api.github.com/repos/${repo}/tags`)
        if (!tags.length) return []

        const tagReleases: Release[] = []

        for (let i = 0; i < Math.min(tags.length, 5); i++) { // Limit to 5 most recent tags
          const currentTag = tags[i]
          const previousTag = tags[i + 1]

          let commits: any[] = []
          const tagDate = currentTag.commit?.author?.date || new Date().toISOString()

          if (previousTag) {
            // Get commits between previous tag and current tag
            try {
              const comparison = await universalFetch<any>(`https://api.github.com/repos/${repo}/compare/${previousTag.name}...${currentTag.name}`)
              commits = comparison.commits || []
            } catch (error) {
              console.warn(`Failed to fetch commits for ${repo} ${currentTag.name}:`, error)
            }
          } else {
            // For the first tag, get recent commits
            try {
              const recentCommits = await universalFetch<any[]>(`https://api.github.com/repos/${repo}/commits?sha=${currentTag.commit.sha}&per_page=10`)
              commits = recentCommits || []
            } catch (error) {
              console.warn(`Failed to fetch recent commits for ${repo} ${currentTag.name}:`, error)
            }
          }

          // Generate changelog from commit messages
          const commitMessages = commits
            .filter(commit => !commit.commit.message.startsWith('chore: release'))
            .map((commit) => {
              const firstLine = commit.commit.message.split('\n')[0]
              return parseCommitMessage(firstLine, repo)
            })

          // Group commits by conventional prefixes
          const grouped = groupCommits(commitMessages)
          const changelogMarkdown = grouped.ungrouped.length > 0 || grouped.groups.length > 0
            ? groupedCommitsToMarkdown(grouped)
            : '- Initial release'

          const body = await processReleaseBody(changelogMarkdown, repo)
          tagReleases.push({
            url: `https://github.com/${repo}/releases/tag/${currentTag.name}`,
            repo,
            tag: currentTag.name,
            title: currentTag.name,
            date: tagDate,
            body
          })
        }

        return tagReleases
      } catch (error) {
        console.warn(`Failed to fetch releases/tags for ${repo}:`, error)
        return []
      }
    })
  ).then(results => results.flat())

  return releases
}
