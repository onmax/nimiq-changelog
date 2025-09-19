import { describe, it, expect } from 'vitest'
import { fetchGitLabReleases } from '../../server/utils/sources/gitlab'

describe('GitLab Source', () => {
  it('should return empty array when disabled', async () => {
    const config = {
      enabled: false,
      projects: [{ id: '1', name: 'test-project' }],
      baseUrl: 'https://gitlab.example.com',
      token: 'test-token'
    }

    const releases = await fetchGitLabReleases(config)
    expect(releases).toEqual([])
  })

  it('should return empty array when no token provided', async () => {
    const config = {
      enabled: true,
      projects: [{ id: '1', name: 'test-project' }],
      baseUrl: 'https://gitlab.example.com',
      token: ''
    }

    const releases = await fetchGitLabReleases(config)
    expect(releases).toEqual([])
  })

  it('should return empty array when no projects provided', async () => {
    const config = {
      enabled: true,
      projects: [],
      baseUrl: 'https://gitlab.example.com',
      token: 'test-token'
    }

    const releases = await fetchGitLabReleases(config)
    expect(releases).toEqual([])
  })

  it('should return empty array when no baseUrl provided', async () => {
    const config = {
      enabled: true,
      projects: [{ id: '1', name: 'test-project' }],
      baseUrl: '',
      token: 'test-token'
    }

    const releases = await fetchGitLabReleases(config)
    expect(releases).toEqual([])
  })
})
