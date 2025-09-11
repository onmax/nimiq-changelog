import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import type { MDCRoot } from '@nuxtjs/mdc'
import type { Release } from '../../shared/types/releases'

const REPOS = [
  'nimiq/core-rs-albatross'
]

const NIMIQ_FRONTEND_URL = 'https://nimiq-frontend-release-notes.netlify.app/mainnet_releases.json'

function removeDuplicateWhatsSections(body: MDCRoot): MDCRoot {
  const children = body.children.filter((child, index) => {
    if (child.type === 'element' && child.tag === 'h2'
      && child.children?.[0]?.type === 'text' && child.children[0].value === 'What\'s Changed') {
      // Check if the next element is an h3 with "What's changed"
      const nextChild = body.children[index + 1]
      if (nextChild?.type === 'element' && nextChild.tag === 'h3'
        && nextChild.children?.[0]?.type === 'text'
        && nextChild.children[0].value.toLowerCase() === 'what\'s changed') {
        return false // Remove the duplicate h2
      }
    }
    return true
  })

  return { ...body, children }
}

export default defineCachedEventHandler(async () => {
  console.log('fetching releases')

  const runtimeConfig = useRuntimeConfig()
  const { token: gitlabToken, projects: gitlabProjects, baseUrl: gitlabBaseUrl } = runtimeConfig.gitlab

  // Parse GitLab projects from config
  const GITLAB_PROJECTS = gitlabProjects
    ? gitlabProjects.split(',').map((project) => {
        const [id, name] = project.split(':')
        return { id, name }
      })
    : []

  // Fetch GitHub releases
  const githubReleases: Release[] = await Promise.all(
    REPOS.map(async (repo) => {
      const { releases } = await $fetch<{ releases: any[] }>(`https://ungh.cc/repos/${repo}/releases`)
      return Promise.all(
        releases
          .filter(r => r.draft === false)
          .map(async release => ({
            url: `https://github.com/${repo}/releases/tag/${release.tag}`,
            repo,
            tag: release.tag,
            title: release.name || release.tag,
            date: release.publishedAt,
            body: removeDuplicateWhatsSections((await parseMarkdown(release.markdown)).body)
          }))
      )
    })
  ).then(results => results.flat())

  // Fetch GitLab releases
  let gitlabReleases: Release[] = []
  if (gitlabToken && GITLAB_PROJECTS.length > 0) {
    try {
      gitlabReleases = await Promise.all(
        GITLAB_PROJECTS.map(async (project) => {
          const releases = await $fetch<any[]>(`${gitlabBaseUrl}/api/v4/projects/${project.id}/releases`, {
            headers: {
              Authorization: `Bearer ${gitlabToken}`
            }
          })
          return Promise.all(
            releases.map(async release => ({
              url: `${gitlabBaseUrl}/${project.name}/-/releases/${release.tag_name}`,
              repo: project.name || 'unknown',
              tag: release.tag_name,
              title: release.name || release.tag_name,
              date: release.released_at,
              body: release.description ? (await parseMarkdown(release.description)).body : { type: 'root' as const, children: [] }
            }))
          )
        })
      ).then(results => results.flat())
    } catch (error) {
      console.warn('Failed to fetch GitLab releases:', error)
    }
  } else {
    if (!gitlabToken) console.warn('GitLab token not configured, skipping GitLab releases')
    if (GITLAB_PROJECTS.length === 0) console.warn('No GitLab projects configured, skipping GitLab releases')
  }

  // Fetch Nimiq frontend releases
  const nimiqReleases: any[] = await $fetch<any[]>(NIMIQ_FRONTEND_URL)
  const formattedNimiqReleases: Release[] = await Promise.all(
    nimiqReleases.map(async release => ({
      url: '#', // No direct URL available for these releases
      repo: `nimiq/${release.app.toLowerCase()}`,
      tag: release.version,
      title: release.version,
      date: release.date,
      body: (await parseMarkdown(release.message)).body
    }))
  )

  const allReleases = [...githubReleases, ...gitlabReleases, ...formattedNimiqReleases]

  return allReleases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20)
}, {
  maxAge: 60
})
