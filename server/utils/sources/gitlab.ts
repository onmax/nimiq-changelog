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

export async function fetchGitLabReleases(config: SourceConfig, repoFilter?: string): Promise<Release[]> {
  if (!config.enabled || !config.token || !config.projects || !config.baseUrl) {
    if (!config.token) console.warn('GitLab token not configured, skipping GitLab releases')
    if (!config.projects) console.warn('No GitLab projects configured, skipping GitLab releases')
    return []
  }

  // Parse GitLab projects from config (handle both string and array formats)
  const projects = typeof config.projects === 'string'
    ? config.projects.split(',').map((project) => {
        const [id, name] = project.split(':')
        return { id: id || '', name: name || '' }
      }).filter(p => p.id && p.name)
    : config.projects

  if (!projects.length) {
    console.warn('No valid GitLab projects found after parsing')
    return []
  }

  try {
    const releases: Release[] = await Promise.all(
      projects.map(async (project) => {
        const releases = await universalFetch<any[]>(`${config.baseUrl}/api/v4/projects/${project.id}/releases`, {
          headers: {
            Authorization: `Bearer ${config.token}`
          }
        })
        return Promise.all(
          releases.map(async (release) => {
            if (release.description) {
              const body = await processReleaseBody(release.description, project.name || 'unknown')
              return {
                url: `${config.baseUrl}/${project.name}/-/releases/${release.tag_name}`,
                repo: project.name || 'unknown',
                tag: release.tag_name,
                title: release.name || release.tag_name,
                date: release.released_at,
                body
              }
            } else {
              return {
                url: `${config.baseUrl}/${project.name}/-/releases/${release.tag_name}`,
                repo: project.name || 'unknown',
                tag: release.tag_name,
                title: release.name || release.tag_name,
                date: release.released_at,
                body: { type: 'root' as const, children: [] }
              }
            }
          })
        )
      })
    ).then(results => results.flat())

    // Apply repo filter if specified
    return repoFilter
      ? releases.filter(release => release.repo.includes(repoFilter))
      : releases
  } catch (error) {
    console.warn('Failed to fetch GitLab releases:', error)
    return []
  }
}
