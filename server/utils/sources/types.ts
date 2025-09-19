import type { Release } from '../../../shared/types/releases'

export interface SourceConfig {
  enabled: boolean
  repos?: string[]
  projects?: Array<{ id: string, name: string }>
  packages?: string[]
  baseUrl?: string
  token?: string
}

export type SourceFetcher = (config: SourceConfig, repoFilter?: string) => Promise<Release[]>

export interface SourceMetadata {
  name: string
  description: string
  fetcher: SourceFetcher
}
