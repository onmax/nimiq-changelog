# Nuxt Changelog

A Nuxt 4 application that displays GitHub release changelogs from multiple repositories in a clean timeline format. Built with Nuxt UI v4 and TypeScript.

Originally inspired by [nuxt-changelog.vercel.app](https://nuxt-changelog.vercel.app/)

## Features

- Timeline view of releases from multiple GitHub repositories
- Markdown rendering for release notes
- Expandable/collapsible release bodies
- Server-side caching for performance
- Responsive design with Nuxt UI components


## Setup

Make sure to install the dependencies:

```bash
pnpm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Production

Build the application for production:

```bash
pnpm build
```

Locally preview production build:

```bash
pnpm preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Renovate integration

Install [Renovate GitHub app](https://github.com/apps/renovate/installations/select_target) on your repository and you are good to go.
