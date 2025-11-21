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
  const sinceISO = since.toISOString()

  const query = `
    query IssuesQuery($after: String, $since: DateTime!) {
      issues(
        first: 50
        after: $after
        filter: {
          completedAt: { gte: $since }
          state: { type: { eq: "completed" } }
        }
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
        body: { query, variables: { after: cursor, since: sinceISO } }
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

    consola.success(`Fetched ${allIssues.length} completed issues from Linear (last ${daysAgo} days)`)
    return allIssues
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
