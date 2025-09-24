import type { Release } from '../../shared/types/releases'
import type { SourcesConfig } from './sources/types'
import { sources, flattenSourceGroups, getEnabledSourceGroupsForReleases, getEnabledSourceGroupsForSummary } from './sourceRegistry'

type FetchContext = 'releases' | 'slack'

/**
 * New function to fetch releases from grouped sources configuration
 */
export async function fetchReleasesFromGroups(
  sourcesConfig: SourcesConfig,
  repoFilter?: string,
  context: FetchContext = 'releases'
): Promise<Release[]> {
  const allReleases: Release[] = []

  // Get the appropriate source groups based on context
  const enabledGroups = context === 'releases'
    ? getEnabledSourceGroupsForReleases(sourcesConfig)
    : getEnabledSourceGroupsForSummary(sourcesConfig)

  // Flatten all sources from enabled groups
  const flattenedSources = flattenSourceGroups(enabledGroups)

  // Fetch from all sources in parallel
  const sourcePromises = flattenedSources.map(async ({ kind, config, groupLabel }) => {
    const sourceMeta = sources[kind]

    if (sourceMeta && config.enabled) {
      try {
        const releases = await sourceMeta.fetcher(config, repoFilter)
        // Add group label to releases for potential UI grouping
        return releases.map(release => ({ ...release, groupLabel }))
      } catch (error) {
        console.warn(`Failed to fetch releases from ${sourceMeta.name} (${groupLabel}):`, error)
        return []
      }
    }
    return []
  })

  const results = await Promise.all(sourcePromises)
  allReleases.push(...results.flat())

  // Apply context-specific filtering (keep existing logic for compatibility)
  let filteredReleases = allReleases

  if (context === 'slack') {
    // Filter out @onmax repos for slack summary
    filteredReleases = allReleases.filter(release => !release.repo.includes('onmax/'))
  } else if (context === 'releases') {
    // Filter out nimiq/bug-bounty-dashboard for releases endpoint (only in production)
    if (process.env.NODE_ENV === 'production') {
      filteredReleases = allReleases.filter(release => release.repo !== 'nimiq/bug-bounty-dashboard')
    }
  }

  // Apply repo filter to final results if specified
  const finalResults = repoFilter
    ? filteredReleases.filter((release) => {
        // Support filtering by repo name
        if (release.repo.includes(repoFilter)) return true

        // Support filtering by source type + repo (e.g., "gh_pr:nimiq/bug-bounty-dashboard")
        if (repoFilter.includes(':')) {
          const [_sourceType, repoName] = repoFilter.split(':', 2)
          return repoName ? release.repo.includes(repoName) : false
        }

        return false
      })
    : filteredReleases

  // Sort by date (most recent first) and limit results
  return finalResults
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 35)
}
