import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import type { MDCRoot } from '@nuxtjs/mdc'
import type { Release } from '../../shared/types/releases'
import { getQuery } from 'h3'
import { parseCommitMessage } from '../utils/parseCommitMessage'

const REPOS = [
  'nimiq/core-rs-albatross',
  'onmax/nimiq-mcp',
  'onmax/albatross-rpc-client-ts'
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
        return { id, name }
      })
    : []

  // Filter repos if specified
  const filteredRepos = repoFilter ? REPOS.filter(repo => repo.includes(repoFilter)) : REPOS
  console.log('repoFilter:', repoFilter, 'filteredRepos:', filteredRepos)

  // Fetch GitHub releases, fallback to tags for repos without releases
  const githubReleases: Release[] = await Promise.all(
    filteredRepos.map(async (repo) => {
      try {
        // First try to fetch releases (existing method)
        const { releases } = await $fetch<{ releases: any[] }>(`https://ungh.cc/repos/${repo}/releases`)

        if (releases && releases.length > 0) {
          // Use existing releases method but also parse the content for links
          return Promise.all(
            releases
              .filter(r => r.draft === false)
              .map(async (release) => {
                // Parse the markdown content to enhance with links
                const parsedMarkdown = parseCommitMessage(release.markdown, repo)
                return {
                  url: `https://github.com/${repo}/releases/tag/${release.tag}`,
                  repo,
                  tag: release.tag,
                  title: release.name || release.tag,
                  date: release.publishedAt,
                  body: removeDuplicateWhatsSections((await parseMarkdown(parsedMarkdown)).body)
                }
              })
          )
        }

        // Fallback: generate releases from tags
        console.log(`No releases found for ${repo}, generating from tags`)
        const tags = await $fetch<any[]>(`https://api.github.com/repos/${repo}/tags`)
        if (!tags.length) return []

        const tagReleases: Release[] = []

        for (let i = 0; i < Math.min(tags.length, 5); i++) { // Limit to 5 most recent tags
          const currentTag = tags[i]
          const previousTag = tags[i + 1]

          let commits: any[] = []
          const tagDate = currentTag.commit?.author?.date || new Date().toISOString()

          if (previousTag) {
            // Get commits between previous tag and current tag
            try {
              const comparison = await $fetch<any>(`https://api.github.com/repos/${repo}/compare/${previousTag.name}...${currentTag.name}`)
              commits = comparison.commits || []
            } catch (error) {
              console.warn(`Failed to fetch commits for ${repo} ${currentTag.name}:`, error)
            }
          } else {
            // For the first tag, get recent commits
            try {
              const recentCommits = await $fetch<any[]>(`https://api.github.com/repos/${repo}/commits?sha=${currentTag.commit.sha}&per_page=10`)
              commits = recentCommits || []
            } catch (error) {
              console.warn(`Failed to fetch recent commits for ${repo} ${currentTag.name}:`, error)
            }
          }

          // Generate changelog from commit messages
          const changelogItems = commits
            .filter(commit => !commit.commit.message.startsWith('chore: release'))
            .map((commit) => {
              const firstLine = commit.commit.message.split('\n')[0]
              const parsed = parseCommitMessage(firstLine, repo)
              return `- ${parsed}`
            })
            .join('\n')

          const changelogMarkdown = changelogItems || '- Initial release'

          tagReleases.push({
            url: `https://github.com/${repo}/releases/tag/${currentTag.name}`,
            repo,
            tag: currentTag.name,
            title: currentTag.name,
            date: tagDate,
            body: (await parseMarkdown(changelogMarkdown)).body
          })
        }

        return tagReleases
      } catch (error) {
        console.warn(`Failed to fetch releases/tags for ${repo}:`, error)
        return []
      }
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

  // Apply repo filter to final results if specified
  const finalResults = repoFilter
    ? allReleases.filter(release => release.repo.includes(repoFilter))
    : allReleases

  return finalResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 35)
}, {
  maxAge: process.env.NODE_ENV === 'development' ? 0 : 60
})
