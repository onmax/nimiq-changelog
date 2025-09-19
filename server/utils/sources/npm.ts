import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import type { Release } from '../../../shared/types/releases'
import type { SourceConfig } from './types'
import { universalFetch } from '../fetch'

interface NpmPackageInfo {
  'name': string
  'description'?: string
  'versions': Record<string, {
    version: string
    description?: string
    dist?: {
      tarball: string
    }
  }>
  'time': Record<string, string>
  'dist-tags': {
    latest: string
  }
  'homepage'?: string
  'repository'?: {
    type: string
    url: string
  }
}

function generateChangelogForVersion(packageName: string, version: string, previousVersion?: string): string {
  // Simple changelog generation - in a real implementation you might want to:
  // 1. Fetch GitHub releases if repository is available
  // 2. Parse commit messages between versions
  // 3. Use conventional commits to generate changelog

  const changes = [
    `- Updated to version ${version}`
  ]

  if (previousVersion) {
    changes.push(`- Previous version: ${previousVersion}`)
  }

  return changes.join('\n')
}

async function processChangelogContent(content: string, packageName: string) {
  try {
    const body = (await parseMarkdown(content)).body
    return body
  } catch (error) {
    console.warn(`Failed to parse changelog for ${packageName}:`, error)
    // Fallback to simple text content
    return {
      type: 'root' as const,
      children: [{
        type: 'element' as const,
        tag: 'p',
        props: {},
        children: [{ type: 'text' as const, value: content }]
      }]
    }
  }
}

export async function fetchNpmReleases(config: SourceConfig, repoFilter?: string): Promise<Release[]> {
  if (!config.enabled || !config.packages) {
    return []
  }

  // Filter packages if specified
  const filteredPackages = repoFilter
    ? config.packages.filter(pkg => pkg.includes(repoFilter))
    : config.packages

  const releases: Release[] = await Promise.all(
    filteredPackages.map(async (packageName) => {
      try {
        // Fetch package information from npm registry
        const packageInfo = await universalFetch<NpmPackageInfo>(`https://registry.npmjs.org/${packageName}`)

        if (!packageInfo.versions || !packageInfo.time) {
          console.warn(`No version information found for package ${packageName}`)
          return []
        }

        // Get all versions sorted by publish date (most recent first)
        const sortedVersions = Object.keys(packageInfo.versions)
          .filter(version => packageInfo.time[version]) // Only versions with publish dates
          .sort((a, b) => {
            const dateA = packageInfo.time[a]
            const dateB = packageInfo.time[b]
            if (!dateA || !dateB) return 0
            return new Date(dateB).getTime() - new Date(dateA).getTime()
          })
          .slice(0, 10) // Limit to 10 most recent versions

        // Create release objects for each version
        const packageReleases: Release[] = await Promise.all(
          sortedVersions
            .filter(version => packageInfo.time[version]) // Ensure we have a publish date
            .map(async (version, index) => {
              const publishDate = packageInfo.time[version]!
              const previousVersion = sortedVersions[index + 1]

              // Generate changelog content
              const changelogContent = generateChangelogForVersion(packageName, version, previousVersion)
              const body = await processChangelogContent(changelogContent, packageName)

              // Create npm package URL
              const packageUrl = `https://www.npmjs.com/package/${packageName}/v/${version}`

              return {
                url: packageUrl,
                repo: `npm/${packageName}`,
                tag: version,
                title: `${packageName}@${version}`,
                date: publishDate,
                body
              }
            })
        )

        return packageReleases
      } catch (error) {
        console.warn(`Failed to fetch npm releases for ${packageName}:`, error)
        return []
      }
    })
  ).then(results => results.flat())

  return releases
}
