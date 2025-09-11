<p align="center">
  <a href="https://github.com/onmax/nimiq-changelog" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/onmax/nimiq-changelog/HEAD/.github/logo-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/onmax/nimiq-changelog/HEAD/.github/logo-light.svg">
      <img alt="Nimiq Changelog" src="https://raw.githubusercontent.com/onmax/nimiq-changelog/HEAD/.github/logo-light.svg" width="334" height="42" style="max-width: 100%;">
    </picture>
  </a>
</p>

<p align="center">
  An application to track latest changes from multiple repositories from Nimiq
</p>


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
