// Universal fetch that works in both Nuxt runtime and Node environment
export async function universalFetch<T = any>(url: string, options?: any): Promise<T> {
  // In Nuxt runtime, use $fetch
  if (typeof $fetch !== 'undefined') {
    return $fetch<T>(url, options) as Promise<T>
  }

  // In Node environment (tests), use regular fetch
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json() as T
}
