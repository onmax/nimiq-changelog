# PRD: Add nimiq/feedback GitHub Issues to Weekly Slack Summary

## Overview
Add GitHub issues from the `nimiq/feedback` repository to the weekly Slack changelog summary. This provides visibility into user feedback alongside shipped releases.

## Requirements

### 1. Create GitHub Issues Feedback Source
- New source file: `server/utils/sources/github-issues-feedback.ts`
- Fetch open issues from `nimiq/feedback` repository
- Use issue title, body (no images), and labels
- Transform to Release format for LLM processing
- Only fetch issues from last 7 days (matching release behavior)

### 2. Source Registry
- Register as `github-issues-feedback` in sourceRegistry.ts
- Add fetcher function reference

### 3. Configuration
- Add to `sources.config.ts`:
  - Label: "Nimiq Feedback"
  - Source: `gh_issues_feedback:nimiq/feedback`
  - Token: `process.env.NUXT_FEEDBACK_GITHUB_TOKEN`
  - `showInReleases`: false (Slack only, NOT in public API)
  - `showInSummary`: true

### 4. Environment Variables
- `NUXT_FEEDBACK_GITHUB_TOKEN`: GitHub token for nimiq/feedback access
- `NUXT_FEEDBACK_REPO`: Repository (default: nimiq/feedback)
- Update `.env.example` with new variables

### 5. System Prompt (Optional)
- Consider updating `server/utils/systemPrompt.ts` to handle feedback issues
- Differentiate between releases and user feedback in summary tone

## Implementation

### Data Flow
1. Weekly summary endpoint calls `fetchReleasesFromGroups()` with context='slack'
2. Feedback source fetches open issues from last 7 days
3. Issues transformed to Release format (title, body without images, labels)
4. Included in LLM context alongside releases
5. LLM generates summary including feedback
6. Posted to Slack (NOT exposed via /api/releases)

### Success Criteria
- Feedback issues appear in Slack weekly summary
- Issues NOT returned by /api/releases endpoint
- Images stripped from issue bodies
- Labels included in LLM context
- Works with existing weekly summary flow
