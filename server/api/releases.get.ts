import { getQuery } from 'h3'
import { fetchReleasesFromGroups } from '../utils/sources'
import type { SourcesConfig } from '../utils/sources/types'

export default defineCachedEventHandler(async (event) => {
  console.log('fetching releases')

  const query = getQuery(event)
  const repoFilter = typeof query.repo === 'string' ? query.repo : (typeof query.query === 'string' ? query.query : '')

  const runtimeConfig = useRuntimeConfig()

  // Get sources configuration from runtime config
  const sourcesConfig = runtimeConfig.sources as SourcesConfig

  // Fetch releases using context-aware filtering for releases endpoint
  const allReleases = await fetchReleasesFromGroups(sourcesConfig, repoFilter, 'releases')

  return allReleases
}, {
  maxAge: process.env.NODE_ENV === 'development' ? 0 : 60
})
