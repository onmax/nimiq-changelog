import { consola } from 'consola'

interface LinearIssue {
  id: string
  title: string
  identifier: string
  url: string
  description: string | null
  completedAt: string | null
  team: { name: string, key: string }
  project: { name: string } | null
  state: { name: string, type: string }
}

interface LinearResponse {
  data: { issues: { nodes: LinearIssue[], pageInfo: { hasNextPage: boolean, endCursor: string | null } } }
  errors?: Array<{ message: string }>
}

export async function fetchLinearDoneIssues(daysAgo = 7): Promise<LinearIssue[]> {
  const runtimeConfig = useRuntimeConfig()
  const linearApiKey = runtimeConfig.linearApiKey

  if (!linearApiKey) {
    consola.error('LINEAR_API_KEY not configured')
    return []
  }

  const since = new Date()
  since.setDate(since.getDate() - daysAgo)

  const query = `
    query IssuesQuery($after: String) {
      issues(
        first: 50
        after: $after
      ) {
        nodes {
          id
          title
          identifier
          url
          description
          completedAt
          team { name key }
          project { name }
          state { name type }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `

  try {
    const allIssues: LinearIssue[] = []
    let hasNextPage = true
    let cursor: string | null = null

    while (hasNextPage) {
      const response: LinearResponse = await $fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Authorization': linearApiKey,
          'Content-Type': 'application/json'
        },
        body: { query, variables: { after: cursor } }
      })

      if (response.errors) {
        consola.error('Linear API errors:', response.errors)
        break
      }

      const issues = response.data.issues
      allIssues.push(...issues.nodes)

      hasNextPage = issues.pageInfo.hasNextPage
      cursor = issues.pageInfo.endCursor
    }

    // Filter completed issues from the last N days
    const filteredIssues = allIssues.filter(issue =>
      issue.completedAt && issue.state.type === 'completed' && new Date(issue.completedAt) >= since
    )

    consola.success(`Fetched ${filteredIssues.length} done issues from Linear (from ${allIssues.length} total)`)
    return filteredIssues
  } catch (error) {
    consola.error('Failed to fetch Linear issues:', error)
    return []
  }
}

export function groupIssuesByProject(issues: LinearIssue[]): Record<string, { team: string, issues: LinearIssue[] }> {
  const grouped: Record<string, { team: string, issues: LinearIssue[] }> = {}

  issues.forEach((issue) => {
    const projectName = issue.project?.name || 'No Project'
    if (!grouped[projectName]) {
      grouped[projectName] = { team: issue.team.name, issues: [] }
    }
    grouped[projectName]!.issues.push(issue)
  })

  return grouped
}
