/**
 * Group commits by conventional commit prefixes
 */

export interface GroupedCommit {
  message: string
  originalMessage: string
}

export interface CommitGroup {
  heading?: string
  commits: GroupedCommit[]
}

export interface GroupedCommits {
  ungrouped: GroupedCommit[]
  groups: Array<{ type: string, heading: string, commits: GroupedCommit[] }>
}

// Well-known prefixes in order of importance
const WELL_KNOWN_PREFIXES = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'style',
  'test',
  'docs',
  'build',
  'ci',
  'chore',
  'revert'
] as const

/**
 * Extract conventional commit prefix from a commit message
 */
function extractPrefix(message: string): string | null {
  const match = message.match(/^([a-zA-Z]+):\s*(.*)/)
  return match?.[1]?.toLowerCase() ?? null
}

/**
 * Remove prefix from commit message for display
 */
function removePrefix(message: string): string {
  const match = message.match(/^[a-zA-Z]+:\s*(.*)/)
  return match?.[1] ?? message
}

/**
 * Get heading for a prefix type
 */
function getHeadingForPrefix(prefix: string): string {
  const headingMap: Record<string, string> = {
    feat: '✨ Features',
    fix: '🐛 Bug Fixes',
    perf: '⚡ Performance',
    refactor: '♻️ Refactoring',
    style: '💄 Styling',
    test: '✅ Testing',
    docs: '📚 Documentation',
    build: '📦 Build',
    ci: '👷 CI/CD',
    chore: '🔧 Chores',
    revert: '⏪ Reverts'
  }

  return headingMap[prefix] || `${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`
}

/**
 * Group commits by their conventional commit prefixes
 */
export function groupCommits(commitMessages: string[]): GroupedCommits {
  const ungrouped: GroupedCommit[] = []
  const groupMap = new Map<string, GroupedCommit[]>()

  // Check if we have at least one commit with a prefix
  const hasAnyPrefix = commitMessages.some(msg => extractPrefix(msg) !== null)

  // If no prefixes found, return all as ungrouped
  if (!hasAnyPrefix) {
    return {
      ungrouped: commitMessages.map(msg => ({
        message: msg,
        originalMessage: msg
      })),
      groups: []
    }
  }

  // Group commits by prefix
  for (const message of commitMessages) {
    const prefix = extractPrefix(message)

    if (!prefix) {
      // No prefix - add to ungrouped
      ungrouped.push({
        message,
        originalMessage: message
      })
    } else {
      // Has prefix - add to appropriate group
      if (!groupMap.has(prefix)) {
        groupMap.set(prefix, [])
      }
      groupMap.get(prefix)!.push({
        message: removePrefix(message),
        originalMessage: message
      })
    }
  }

  // Sort groups by well-known prefixes first, then alphabetically
  const sortedGroups = Array.from(groupMap.entries())
    .sort(([a], [b]) => {
      const aIndex = WELL_KNOWN_PREFIXES.indexOf(a as any)
      const bIndex = WELL_KNOWN_PREFIXES.indexOf(b as any)

      // Both are well-known
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex
      }

      // Only a is well-known
      if (aIndex !== -1) return -1

      // Only b is well-known
      if (bIndex !== -1) return 1

      // Neither is well-known, sort alphabetically
      return a.localeCompare(b)
    })
    .map(([type, commits]) => ({
      type,
      heading: getHeadingForPrefix(type),
      commits
    }))

  return {
    ungrouped,
    groups: sortedGroups
  }
}

/**
 * Convert grouped commits to markdown format
 */
export function groupedCommitsToMarkdown(grouped: GroupedCommits): string {
  const sections: string[] = []

  // Add ungrouped commits first (no heading)
  if (grouped.ungrouped.length > 0) {
    const items = grouped.ungrouped.map(commit => `- ${commit.message}`).join('\n')
    sections.push(items)
  }

  // Add grouped commits with headings
  for (const group of grouped.groups) {
    const heading = `## ${group.heading}`
    const items = group.commits.map(commit => `- ${commit.message}`).join('\n')
    sections.push(`${heading}\n\n${items}`)
  }

  return sections.join('\n\n')
}
