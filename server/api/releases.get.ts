import { getQuery } from 'h3'
import { fetchAllReleases, type AllSourcesConfig } from '../utils/sources'

export default defineCachedEventHandler(async (event) => {
  console.log('fetching releases')

  const query = getQuery(event)
  const repoFilter = typeof query.repo === 'string' ? query.repo : ''

  const runtimeConfig = useRuntimeConfig()

  // Get sources configuration from runtime config
  const sourcesConfig: AllSourcesConfig = runtimeConfig.sources as AllSourcesConfig

  // Fetch all releases using the new modular sources system
  const allReleases = await fetchAllReleases(sourcesConfig, repoFilter)

  return allReleases
}, {
  maxAge: process.env.NODE_ENV === 'development' ? 0 : 60
})
