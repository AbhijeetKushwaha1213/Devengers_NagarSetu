import { useState, useEffect } from 'react'

/**
 * Custom hook that debounces a value
 * Useful for search inputs, API calls, etc.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook for debounced search functionality
 */
export function useSearch(initialQuery: string = '', delay: number = 300) {
  const [query, setQuery] = useState(initialQuery)
  const [isSearching, setIsSearching] = useState(false)
  const debouncedQuery = useDebounce(query, delay)

  useEffect(() => {
    if (query !== debouncedQuery) {
      setIsSearching(true)
    } else {
      setIsSearching(false)
    }
  }, [query, debouncedQuery])

  const clearSearch = () => {
    setQuery('')
    setIsSearching(false)
  }

  return {
    query,
    setQuery,
    debouncedQuery,
    isSearching,
    clearSearch,
  }
}