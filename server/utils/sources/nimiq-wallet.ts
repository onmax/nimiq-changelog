import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import type { Release } from '../../../shared/types/releases'
import type { SourceConfig } from './types'
import { parseCommitMessage } from '../parseCommitMessage'
import { groupCommits, groupedCommitsToMarkdown } from '../groupCommits'
import { extractCommitMessages } from '../extractCommitMessages'
import { universalFetch } from '../fetch'

interface nimiqWalletRelease {
  version: string
  date: string
  message: string
  app: string
}

async function processReleaseBody(bodyContent: string, repo: string) {
  const body = (await parseMarkdown(bodyContent)).body

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

export async function fetchNimiqWalletReleases(config: SourceConfig, repoFilter?: string): Promise<Release[]> {
  if (!config.enabled) {
    return []
  }

  const NIMIQ_FRONTEND_URL = 'https://nimiq-frontend-release-notes.netlify.app/mainnet_releases.json'

  try {
    // Fetch Nimiq frontend releases
    const nimiqReleases: nimiqWalletRelease[] = await universalFetch<nimiqWalletRelease[]>(NIMIQ_FRONTEND_URL)

    const formattedNimiqReleases: Release[] = []

    for (const release of nimiqReleases) {
      const repoName = `nimiq/${release.app.toLowerCase()}`

      // Apply repo filter if specified
      if (repoFilter && !repoName.includes(repoFilter)) {
        continue
      }

      const body = await processReleaseBody(release.message, repoName)
      formattedNimiqReleases.push({
        url: '#', // No direct URL available for these releases
        repo: repoName,
        tag: release.version,
        title: release.version,
        date: release.date,
        body
      })
    }

    return formattedNimiqReleases
  } catch (error) {
    console.warn('Failed to fetch Nimiq frontend releases:', error)
    return []
  }
}
