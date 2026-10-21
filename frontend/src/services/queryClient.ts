/*
 * The one QueryClient, built here (rather than in main.tsx) so its rules can be tested.
 */

import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { reportIfSessionEnded } from '@/services/sessionEnded'
import { ApiError } from '@/types'

/**
 * Whether a failed read is worth asking again. The app is used on patchy mobile data, so a read
 * that failed because the network or the server hiccuped (`unavailable`) gets one quiet retry.
 * Every other failure is the server's considered answer ("no such trip", "not allowed", "sign in"),
 * and asking again gets the same answer, only slower.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.code !== 'unavailable') return false
  return failureCount < 1
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    // A request that fails because the session ended is reported once, here, for every query and
    // every mutation, so no screen has to handle it.
    queryCache: new QueryCache({ onError: reportIfSessionEnded }),
    mutationCache: new MutationCache({ onError: reportIfSessionEnded }),
    defaultOptions: {
      queries: {
        // A stale read beats a spinner.
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
    },
  })
}
