
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

export function getCachedData<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const cached = JSON.parse(stored)

    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      localStorage.removeItem(key)
      return null
    }

    return cached.data as T
  } catch {
    return null
  }
}

export function setCachedData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data
      })
    )
  } catch (error) {
    console.warn('Cache storage unavailable:', error)
  }
}
