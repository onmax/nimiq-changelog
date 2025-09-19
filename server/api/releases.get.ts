import { getQuery } from 'h3'
import { fetchAllReleases, type AllSourcesConfig } from '../utils/sources'

export default defineCachedEventHandler(async (event) => {
  console.log('fetching releases')

  const query = getQuery(event)
  const repoFilter = typeof query.repo === 'string' ? query.repo : ''

  const runtimeConfig = useRuntimeConfig()
  const { token: gitlabToken, projects: gitlabProjects, baseUrl: gitlabBaseUrl } = runtimeConfig.gitlab

  // Parse GitLab projects from config
  const GITLAB_PROJECTS = gitlabProjects
    ? gitlabProjects.split(',').map((project) => {
        const [id, name] = project.split(':')
        return { id: id || '', name: name || '' }
      }).filter(p => p.id && p.name)
    : []

  // Configure all sources
  const sourcesConfig: AllSourcesConfig = {
    'github': {
      enabled: true,
      repos: [
        'nimiq/core-rs-albatross',
        'onmax/nimiq-mcp',
        'onmax/albatross-rpc-client-ts'
      ]
    },
    'gitlab': {
      enabled: !!(gitlabToken && GITLAB_PROJECTS.length > 0),
      projects: GITLAB_PROJECTS,
      baseUrl: gitlabBaseUrl,
      token: gitlabToken
    },
    'npm': {
      enabled: true,
      packages: [
        '@nimiq/utils'
      ]
    },
    'nimiq-frontend': {
      enabled: true
    }
  }

  // Fetch all releases using the new modular sources system
  const allReleases = await fetchAllReleases(sourcesConfig, repoFilter)

  return allReleases
}, {
  maxAge: process.env.NODE_ENV === 'development' ? 0 : 60
})
