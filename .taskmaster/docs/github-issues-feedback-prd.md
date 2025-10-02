# PRD: Add GitHub Issues Feedback Summary to Weekly Slack Notifications

## Overview
Add support for fetching and summarizing open GitHub issues from the `nimiq/feedback` repository in the weekly Slack changelog summary. This feature will provide the team with visibility into user feedback alongside shipped releases.

## Background
The current changelog system aggregates releases, pull requests, and blog posts from various Nimiq sources and generates weekly summaries posted to Slack. However, it doesn't include user feedback from the `nimiq/feedback` repository, which is tracked via GitHub issues in the `nimiq/feedback-hub` project.

## Goals
1. Create a new GitHub Issues source that fetches open issues from `nimiq/feedback`
2. Include issue summaries in the weekly Slack notification
3. Keep this data private (Slack-only, not exposed via the releases API endpoint)
4. Feed issue title, body (without images), and labels to the LLM for summary generation

## Non-Goals
- Exposing feedback issues via the public releases API endpoint
- Fetching issues from repositories other than `nimiq/feedback`
- Closed or resolved issues (only open issues)

## Technical Requirements

### 1. New GitHub Issues Source
- Create `server/utils/sources/github-issues.ts`
- Implement `fetchGitHubIssues()` function following the existing source pattern
- Fetch open issues from configured repositories
- Transform GitHub issue data to Release format:
  - `tag`: Issue number (e.g., `#123`)
  - `title`: Issue title
  - `body`: Issue body content (parsed as markdown, images removed)
  - `url`: Issue URL
  - `date`: Issue creation date
  - Include labels in the body or as metadata

### 2. Source Registry Integration
- Register the new source in `server/utils/sourceRegistry.ts`
- Add source metadata with name, description, and fetcher function
- Support `gh_issues:` prefix for string-based configuration

### 3. Configuration
- Add new environment variables in `.env`:
  - `NUXT_FEEDBACK_GITHUB_TOKEN`: GitHub token for accessing feedback repo
  - `NUXT_FEEDBACK_REPO`: Repository to fetch issues from (default: `nimiq/feedback`)
- Add source configuration in `sources.config.ts`:
  - Label: "Nimiq Feedback"
  - Source: `gh_issues:nimiq/feedback`
  - Token: From environment variable
  - `showInReleases`: `false` (Slack only)
  - `showInSummary`: `true`

### 4. API Filtering
- Ensure issues are NOT returned by `/api/releases` endpoint
- Ensure issues ARE included when fetching for Slack summary context

### 5. LLM Integration
- Issues should be formatted for LLM consumption similar to releases
- Format: `{repo} #{number} ({labels}): {title} - {body}`
- Strip images from issue body before feeding to LLM
- Update system prompt if needed to handle feedback issues appropriately

### 6. Data Fetching
- Fetch only open issues (state: `open`)
- Filter to issues created/updated in the last 7 days (matching release behavior)
- Handle pagination for repositories with many issues
- Include error handling and rate limiting

## Data Format

### GitHub Issues API Response
```json
{
  "number": 123,
  "title": "Issue title",
  "body": "Issue description with **markdown**",
  "state": "open",
  "labels": [{"name": "enhancement"}, {"name": "bug"}],
  "html_url": "https://github.com/nimiq/feedback/issues/123",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-02T00:00:00Z"
}
```

### Transformed Release Format
```typescript
{
  url: "https://github.com/nimiq/feedback/issues/123",
  repo: "nimiq/feedback",
  tag: "#123",
  title: "Issue title",
  date: "2024-01-01T00:00:00Z",
  body: {
    type: 'root',
    children: [
      // Parsed markdown without images
      // Include labels as part of content
    ]
  }
}
```

## Implementation Steps

1. **Create GitHub Issues Source**
   - Implement `fetchGitHubIssues()` in new source file
   - Handle GitHub API calls with authentication
   - Transform issues to Release format
   - Filter by date and state
   - Remove images from body content

2. **Register Source**
   - Add to source registry
   - Add type definitions if needed
   - Support configuration options (state, labels, date filters)

3. **Configure in Environment**
   - Add environment variables
   - Update `.env.example`
   - Add source to `sources.config.ts`

4. **Test Integration**
   - Create unit tests for the new source
   - Test with weekly summary generation
   - Verify issues appear in Slack but not in releases API

5. **Update System Prompt (Optional)**
   - Consider updating prompt to handle user feedback appropriately
   - May want to differentiate between releases and feedback in summary

## Success Criteria
- [ ] GitHub issues from `nimiq/feedback` are fetched successfully
- [ ] Issues appear in weekly Slack summaries
- [ ] Issues do NOT appear in `/api/releases` endpoint
- [ ] Issue bodies are properly formatted (no images)
- [ ] Labels are included in the LLM context
- [ ] Rate limiting and error handling work correctly
- [ ] Tests pass for the new source

## Security & Privacy
- Use dedicated GitHub token with minimal required permissions (read-only access to issues)
- Ensure feedback issues are never exposed via public API
- Only include in authenticated Slack notifications

## Future Enhancements
- Support multiple feedback repositories
- Filter by specific labels
- Group issues by label in the summary
- Track issue resolution in weekly updates
