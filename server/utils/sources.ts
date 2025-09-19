import type { Release } from '../../shared/types/releases'
import { sources } from './sourceRegistry'

export interface AllSourcesConfig {
  github: { enabled: boolean; repos?: string[] }
  gitlab: { enabled: boolean; projects?: string; baseUrl?: string; token?: string }
  npm: { enabled: boolean; packages?: string[] }
  nimiqFrontend: { enabled: boolean }
}

export async function fetchAllReleases(
  configs: AllSourcesConfig,
  repoFilter?: string
): Promise<Release[]> {
  const allReleases: Release[] = []

  // Map camelCase config keys to kebab-case source keys
  const sourceKeyMap = {
    'github': 'github',
    'gitlab': 'gitlab',
    'npm': 'npm',
    'nimiq-frontend': 'nimiqFrontend'
  } as const

  // Fetch from all enabled sources in parallel
  const sourcePromises = Object.entries(sources).map(async ([sourceKey, sourceMeta]) => {
    const configKey = Object.entries(sourceKeyMap).find(([k, v]) => k === sourceKey)?.[1]
    const config = configKey ? configs[configKey as keyof AllSourcesConfig] : undefined

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

