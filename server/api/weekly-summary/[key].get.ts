export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({
      statusCode: 400,
      message: 'Missing key parameter'
    })
  }

  const summary = await hubKV().get(key)

  if (!summary) {
    throw createError({
      statusCode: 404,
      message: 'Summary not found'
    })
  }

  try {
    // Try to parse as JSON (new format)
    const summaryStr = typeof summary === 'string' ? summary : JSON.stringify(summary)
    return JSON.parse(summaryStr)
  } catch {
    // Fallback to old format (plain string)
    return { text: typeof summary === 'string' ? summary : JSON.stringify(summary) }
  }
})
