# GitHub Feedback Issues Integration - Summary

## ✅ Implementation Complete

Successfully integrated GitHub issues from `nimiq/feedback` repository into the weekly Slack changelog summary.

## 🎯 What Was Built

### 1. New Source: `github-issues-feedback`
**File**: `server/utils/sources/github-issues-feedback.ts`

**Features**:
- Fetches both open AND closed issues from nimiq/feedback
- Filters issues from last 7 days (using `since` parameter)
- **Image Stripping**: Removes markdown (`![]()`), HTML (`<img>`), and standalone image URLs
- **Label Inclusion**: Adds issue labels to the body for LLM context
- **Test Label Filtering**:
  - **Development**: Includes issues with `test` label
  - **Production**: Excludes issues with `test` label
- Handles pagination automatically
- Filters out pull requests (GitHub API returns both in `/issues` endpoint)

### 2. Source Registry Integration
**File**: `server/utils/sourceRegistry.ts`

- Registered as `github-issues-feedback` in source registry
- Added `gh_issues_feedback:` prefix support for string-based configuration
- Follows existing source patterns

### 3. Configuration
**File**: `sources.config.ts`

```typescript
{
  label: 'Nimiq Feedback',
  token: process.env.NUXT_FEEDBACK_GITHUB_TOKEN,
  source: `gh_issues_feedback:${process.env.NUXT_FEEDBACK_REPO || 'nimiq/feedback'}`,
  showInReleases: false,  // NOT in public API
  showInSummary: true     // ONLY in Slack
}
```

**Conditional**: Only enabled when `NUXT_FEEDBACK_GITHUB_TOKEN` is set

### 4. Environment Variables
**File**: `.env.example`

```bash
NUXT_FEEDBACK_GITHUB_TOKEN="your_token_here"  # GitHub token for feedback repo
NUXT_FEEDBACK_REPO="nimiq/feedback"           # Configurable repo (defaults to nimiq/feedback)
```

### 5. Enhanced System Prompt
**File**: `server/utils/systemPrompt.ts`

Updated to:
- Handle both releases and user feedback
- Differentiate between shipped features and community requests
- Maintain engaging, witty tone for both types of content

### 6. Test Suite
**File**: `server/utils/sources/github-issues-feedback.test.ts`

**7 Tests** (all passing ✅):
- Configuration validation (disabled, empty repos, missing repos)
- Repository filtering
- **Mocked tests**:
  - Image stripping verification
  - Label inclusion verification
  - Development vs Production mode filtering

## 🧪 Test Issue Created

- **Issue #75**: `[TEST] Verifying Slack integration for feedback issues`
- **URL**: https://github.com/nimiq/feedback/issues/75
- **Label**: `test` (created specifically for testing)
- **Content**: Includes test image and descriptive text
- **Behavior**:
  - ✅ Included in dev/test environments
  - ❌ Filtered out in production

## 📊 Data Flow

```
1. Weekly Summary Trigger (Friday)
   ↓
2. fetchReleasesFromGroups(context='slack')
   ↓
3. Fetches from all sources including feedback
   ↓
4. github-issues-feedback source:
   - Calls GitHub API /repos/nimiq/feedback/issues?state=all&since=<7daysago>
   - Filters out pull requests
   - Filters test issues (production only)
   - Strips images from body
   - Adds labels to body
   - Transforms to Release format
   ↓
5. Combined with releases and fed to LLM
   ↓
6. LLM generates witty summary (GPT-5 Nano + GPT-4.1)
   ↓
7. Posted to Slack with changelog attachment
```

## 🔒 Security & Privacy

### Public API Exclusion
- `showInReleases: false` ensures feedback issues **NEVER** appear in `/api/releases`
- Only accessible via authenticated Slack summary endpoint

### Test Issue Filtering
- Production: `test` labeled issues automatically excluded
- Development: `test` labeled issues included for testing
- Detection: `process.env.NODE_ENV === 'production'`

## 🚀 Setup Instructions

### 1. Set Environment Variable

Add to `.env`:
```bash
NUXT_FEEDBACK_GITHUB_TOKEN="github_pat_YOUR_TOKEN_HERE"
```

> **Note**: Can reuse `NUXT_GITHUB_TOKEN` if it has access to nimiq/feedback

### 2. Verify Configuration

The source will automatically be enabled when the token is set. Check `sources.config.ts`.

### 3. Test Locally (Development)

```bash
# Start dev server
nr dev

# Trigger weekly summary (requires Slack token)
curl -X POST http://localhost:3000/api/weekly-summary
```

**Expected**: Issue #75 should be included in the summary

### 4. Test in Production

Deploy to production and wait for Friday's scheduled run, or manually trigger:

```bash
# Issue #75 should be filtered out (test label)
# Only real feedback issues should appear
```

## 📝 GitHub Issue Labels

Current labels in `nimiq/feedback`:
- Priority: `⚪⚪⚪⚪⚪ 0/5` through `🟡🟡🟡🟡🟡 5/5`
- Apps: `app/nimiq-pay`, `app/nimiq-wallet`, `app/playground`
- Types: `kind/bug`, `kind/feedback`, `kind/idea`
- **Testing**: `test` (newly created for testing)

## 🎨 Example Output

### Slack Summary Format

```
This is week number 40, and this has been the last week's news:

Wallet's been taking style tips—dark mode is live...
Meanwhile, the community wants multi-sig wallets and QR scanning—
sensible requests compared to the goldfish login situation.

[Attachment: weekly-changelog.md with full details]
```

Feedback issues will be naturally woven into the narrative by the LLM.

## ✅ Verification Checklist

Before Friday's run:

- [x] Test issue #75 created in nimiq/feedback
- [x] `test` label exists in repository
- [x] All 7 tests passing
- [x] Image stripping working
- [x] Label inclusion working
- [x] Production filtering working (test issues excluded)
- [x] Development filtering working (test issues included)
- [x] Source registered in sourceRegistry
- [x] Configuration added to sources.config.ts
- [x] Environment variables documented
- [x] System prompt updated
- [ ] NUXT_FEEDBACK_GITHUB_TOKEN set in production .env
- [ ] Manual test of weekly-summary endpoint (requires Slack setup)
- [ ] Verify Friday's automated run includes feedback

## 🐛 Troubleshooting

### Issue #75 Not Appearing

**Possible reasons**:
1. **Too old**: Issue created >7 days ago (won't be fetched)
2. **Production mode**: `test` label filtered out
3. **Token missing**: `NUXT_FEEDBACK_GITHUB_TOKEN` not set
4. **Token permissions**: Token doesn't have access to nimiq/feedback

**Solution**: Create a new test issue or check token configuration

### No Feedback in Summary

**Check**:
```bash
# Verify token is set
echo $NUXT_FEEDBACK_GITHUB_TOKEN

# Test source directly
nr test github-issues-feedback --run

# Check source configuration
cat sources.config.ts | grep -A 10 "Nimiq Feedback"
```

### Images Not Stripped

**Verify**: Image stripping regex in `stripImages()` function handles:
- Markdown: `![alt](url)`
- HTML: `<img src="...">`
- Standalone URLs: `https://example.com/image.png`

## 📚 Files Modified/Created

### Created
- `server/utils/sources/github-issues-feedback.ts` - Main source implementation
- `server/utils/sources/github-issues-feedback.test.ts` - Test suite
- `.taskmaster/docs/feedback-issues-slack-summary.md` - PRD
- `FEEDBACK-INTEGRATION-SUMMARY.md` - This file

### Modified
- `server/utils/sourceRegistry.ts` - Registered new source + prefix
- `sources.config.ts` - Added feedback configuration
- `.env.example` - Documented new env vars
- `server/utils/systemPrompt.ts` - Enhanced for feedback context

## 🎉 Ready for Production

All implementation complete! The system will automatically include nimiq/feedback issues in the weekly Slack summary starting Friday when:

1. ✅ Code is deployed
2. ✅ `NUXT_FEEDBACK_GITHUB_TOKEN` is set
3. ✅ Feedback issues exist in nimiq/feedback (created/updated in last 7 days)

---

**Test Issue**: https://github.com/nimiq/feedback/issues/75
**Created**: October 2, 2025
**Status**: Ready for testing ✅
