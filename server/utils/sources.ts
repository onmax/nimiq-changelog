import type { Release } from '../../shared/types/releases'
import type { SourceConfig, SourceMetadata } from './sources/types'
import { fetchGitHubReleases } from './sources/github'
import { fetchGitLabReleases } from './sources/gitlab'
import { fetchNpmReleases } from './sources/npm'
import { fetchNimiqFrontendReleases } from './sources/nimiq-frontend'

// Source registry
export const sources: Record<string, SourceMetadata> = {
  'github': {
    name: 'GitHub',
    description: 'Fetch releases and tags from GitHub repositories',
    fetcher: fetchGitHubReleases
  },
  'gitlab': {
    name: 'GitLab',
    description: 'Fetch releases from GitLab projects',
    fetcher: fetchGitLabReleases
  },
  'npm': {
    name: 'NPM',
    description: 'Fetch package versions from NPM registry',
    fetcher: fetchNpmReleases
  },
  'nimiq-frontend': {
    name: 'Nimiq Frontend',
    description: 'Fetch releases from Nimiq frontend applications',
    fetcher: fetchNimiqFrontendReleases
  }
}

export interface AllSourcesConfig {
  'github': SourceConfig
  'gitlab': SourceConfig
  'npm': SourceConfig
  'nimiq-frontend': SourceConfig
}

export async function fetchAllReleases(
  configs: AllSourcesConfig,
  repoFilter?: string
): Promise<Release[]> {
  const allReleases: Release[] = []

  // Fetch from all enabled sources in parallel
  const sourcePromises = Object.entries(sources).map(async ([sourceKey, sourceMeta]) => {
    const config = configs[sourceKey as keyof AllSourcesConfig]
    if (config?.enabled) {
      try {
        const releases = await sourceMeta.fetcher(config, repoFilter)
        return releases
      } catch (error) {
        console.warn(`Failed to fetch releases from ${sourceMeta.name}:`, error)
        return []
      }
    }
    return []
  })

  const results = await Promise.all(sourcePromises)
  allReleases.push(...results.flat())

  // Apply repo filter to final results if specified
  const finalResults = repoFilter
    ? allReleases.filter(release => release.repo.includes(repoFilter))
    : allReleases

  // Sort by date (most recent first) and limit results
  return finalResults
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 35)
}

// Export individual fetchers for direct use
export {
  fetchGitHubReleases,
  fetchGitLabReleases,
  fetchNpmReleases,
  fetchNimiqFrontendReleases
}

// Export types
export type { SourceConfig, SourceMetadata } from './sources/types'
