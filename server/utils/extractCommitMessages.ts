/**
 * Extract commit messages from structured release body content
 */

import type { MDCRoot, MDCNode } from '@nuxtjs/mdc'

export interface BodyNode {
  type: 'root' | 'element' | 'text'
  tag?: string
  children?: BodyNode[]
  value?: string
  props?: Record<string, any>
}

/**
 * Extract text content from structured MDC nodes
 */
function extractTextFromNodes(nodes: MDCNode[]): string[] {
  const texts: string[] = []

  for (const node of nodes) {
    if (node.type === 'text' && 'value' in node && node.value) {
      texts.push(node.value.trim())
    } else if (node.type === 'element' && 'children' in node && node.children) {
      texts.push(...extractTextFromNodes(node.children))
    }
  }

  return texts.filter(text => text.length > 0)
}

/**
 * Extract commit messages from list items in release body
 */
export function extractCommitMessages(body: MDCRoot): string[] {
  if (!body || !body.children) return []

  const commitMessages: string[] = []

  function findListItems(nodes: MDCNode[]) {
    for (const node of nodes) {
      if (node.type === 'element' && 'tag' in node && node.tag === 'li' && 'children' in node && node.children) {
        // Extract text from this list item
        const texts = extractTextFromNodes(node.children)
        const message = texts.join(' ').trim()

        if (message) {
          // Clean up common patterns in commit messages
          const cleanMessage = message
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\([a-f0-9]{7,8}\)$/, '') // Remove commit hash at end
            .trim()

          // Skip merge commit messages and very short messages
          if (!cleanMessage.startsWith('Merge') && cleanMessage.length > 5) {
            commitMessages.push(cleanMessage)
          }
        }
      } else if (node.type === 'element' && 'children' in node && node.children) {
        findListItems(node.children)
      }
    }
  }

  findListItems(body.children)
  return commitMessages
}
