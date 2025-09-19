import type { SourceMetadata } from './sources/types'
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
