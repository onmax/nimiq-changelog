/**
 * Parse commit messages and enhance them with GitHub links for issues, PRs, and commits
 */
export function parseCommitMessage(message: string, repo: string): string {
  let parsed = message

  // Replace GitHub PR/issue URLs with short references if they match the current repo
  parsed = parsed.replace(
    /https:\/\/github\.com\/([^\/]+\/[^\/]+)\/(?:pull|issues)\/(\d+)/g,
    (match, urlRepo, number) => {
      if (urlRepo === repo) {
        return `[#${number}](${match})`
      }
      return match // Keep the full URL if it's from a different repo
    }
  )

  // Replace issue/PR references (#123, fixes #456, closes #789, etc.)
  parsed = parsed.replace(
    /(?:^|\s)((?:fix(?:es)?|close(?:s)?|resolve(?:s)?)\s+)?#(\d+)(?=\s|$|[.,!?])/gi,
    (match, prefix = '', issueNumber) => {
      const baseUrl = `https://github.com/${repo}`
      const replacement = `${prefix}[#${issueNumber}](${baseUrl}/issues/${issueNumber})`
      return match.replace(`${prefix}#${issueNumber}`, replacement)
    }
  )

  // Replace commit SHAs (7-8 characters hex)
  parsed = parsed.replace(
    /(?:^|\s)([a-f0-9]{7,8})(?=\s|$|[.,!?])/gi,
    (match, sha) => {
      // Only treat as SHA if it's not part of a longer word/number
      const baseUrl = `https://github.com/${repo}`
      const replacement = `[\`${sha}\`](${baseUrl}/commit/${sha})`
      return match.replace(sha, replacement)
    }
  )

  // Replace full commit SHAs (40 characters hex)
  parsed = parsed.replace(
    /(?:^|\s)([a-f0-9]{40})(?=\s|$|[.,!?])/gi,
    (match, sha) => {
      const baseUrl = `https://github.com/${repo}`
      const shortSha = sha.substring(0, 8)
      const replacement = `[\`${shortSha}\`](${baseUrl}/commit/${sha})`
      return match.replace(sha, replacement)
    }
  )

  // Replace user mentions (@username)
  parsed = parsed.replace(
    /(?:^|\s)@([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})(?=\s|$|[.,!?])/g,
    (match, username) => {
      const replacement = `[@${username}](https://github.com/${username})`
      return match.replace(`@${username}`, replacement)
    }
  )

  return parsed
}
