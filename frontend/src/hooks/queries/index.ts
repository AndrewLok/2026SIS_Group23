/*
 * TanStack Query wrappers. Every screen reads through these; no component calls
 * a service directly, and no component holds server-shaped state of its own.
 *
 * Grouped by feature in one file rather than eight, because the key factory has
 * to stay consistent across features for invalidation to be correct, and that is
 * easier to see when it is all in front of you.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { api } from '@/services/client'
import type { NewBooking } from '@/services/mock/bookings'
import type { NewExpense } from '@/services/mock/expenses'
import type { NewFuelLeg } from '@/services/mock/fuel'
import type { NewIdea } from '@/services/mock/ideas'
import type { NewTrip } from '@/services/mock/trips'
import type {
  Booking,
  Expense,
  FuelLeg,
  Idea,
  IdeaStatus,
  Role,
  Trip,
  Vote,
} from '@/types'

export const keys = {
  trips: ['trips'] as const,
  trip: (id: string) => ['trips', id] as const,
  members: (tripId: string) => ['trips', tripId, 'members'] as const,
  ideas: (tripId: string) => ['trips', tripId, 'ideas'] as const,
  votes: (tripId: string) => ['trips', tripId, 'votes'] as const,
  bookings: (tripId: string) => ['trips', tripId, 'bookings'] as const,
  fuel: (tripId: string) => ['trips', tripId, 'fuel'] as const,
  expenses: (tripId: string) => ['trips', tripId, 'expenses'] as const,
  channels: (tripId: string) => ['trips', tripId, 'channels'] as const,
  messages: (channelId: string) => ['channels', channelId, 'messages'] as const,
}

/** Everything on a trip that a balance or a count can depend on. */
function invalidateTrip(client: ReturnType<typeof useQueryClient>, tripId: string) {
  return Promise.all([
    client.invalidateQueries({ queryKey: keys.trip(tripId) }),
    client.invalidateQueries({ queryKey: keys.members(tripId) }),
    client.invalidateQueries({ queryKey: keys.ideas(tripId) }),
    client.invalidateQueries({ queryKey: keys.votes(tripId) }),
    client.invalidateQueries({ queryKey: keys.bookings(tripId) }),
    client.invalidateQueries({ queryKey: keys.fuel(tripId) }),
    client.invalidateQueries({ queryKey: keys.expenses(tripId) }),
  ])
}

/* Trips and members */

export const useTrips = () => useQuery({ queryKey: keys.trips, queryFn: api.trips.list })

export const useTrip = (tripId: string) =>
  useQuery({ queryKey: keys.trip(tripId), queryFn: () => api.trips.get(tripId) })

export const useMembers = (tripId: string) =>
  useQuery({ queryKey: keys.members(tripId), queryFn: () => api.members.list(tripId) })

export function useCreateTrip() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: NewTrip) => api.trips.create(input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.trips }),
  })
}

export function useUpdateTrip(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Trip>) => api.trips.update(tripId, patch),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useJoinByCode() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api.trips.joinByCode(code),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.trips }),
  })
}

export function useRegenerateCode(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.trips.regenerateCode(tripId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.trip(tripId) }),
  })
}

export function useRemoveMember(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.members.remove(tripId, userId),
    // Removing a member changes every split, so the whole trip re-reads.
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useUpdateRole(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      api.members.updateRole(tripId, userId, role),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.members(tripId) }),
  })
}

/* Ideas and votes */

export const useIdeas = (tripId: string) =>
  useQuery({ queryKey: keys.ideas(tripId), queryFn: () => api.ideas.list(tripId) })

export const useVotes = (tripId: string) =>
  useQuery({ queryKey: keys.votes(tripId), queryFn: () => api.votes.listForTrip(tripId) })

export function useCreateIdea(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<NewIdea, 'tripId'>) => api.ideas.create({ ...input, tripId }),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useUpdateIdea(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ ideaId, patch }: { ideaId: string; patch: Partial<Idea> }) =>
      api.ideas.update(ideaId, patch),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useSetIdeaStatus(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ ideaId, status }: { ideaId: string; status: IdeaStatus }) =>
      api.ideas.setStatus(ideaId, status),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useRemoveIdea(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ideaId: string) => api.ideas.remove(ideaId),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

/**
 * Voting, optimistically. The vote lands on screen at once and reverts if the
 * write fails, because waiting 300ms to see your own tap feels broken.
 */
export function useCastVote(
  tripId: string,
  userId: string,
): UseMutationResult<void, Error, { ideaId: string; value: 1 | -1 | null }, { previous?: Vote[] }> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ ideaId, value }: { ideaId: string; value: 1 | -1 | null }) =>
      value === null ? api.votes.clear(ideaId) : api.votes.cast(ideaId, value),
    onMutate: async ({ ideaId, value }) => {
      await client.cancelQueries({ queryKey: keys.votes(tripId) })
      const previous = client.getQueryData<Vote[]>(keys.votes(tripId))
      client.setQueryData<Vote[]>(keys.votes(tripId), (current = []) => {
        const others = current.filter((v) => !(v.ideaId === ideaId && v.userId === userId))
        if (value === null) return others
        return [...others, { ideaId, userId, value, createdAt: new Date().toISOString() }]
      })
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(keys.votes(tripId), context.previous)
    },
    onSettled: () => invalidateTrip(client, tripId),
  })
}

/* Bookings */

export const useBookings = (tripId: string) =>
  useQuery({ queryKey: keys.bookings(tripId), queryFn: () => api.bookings.list(tripId) })

export function useCreateBooking(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<NewBooking, 'tripId'>) => api.bookings.create({ ...input, tripId }),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useUpdateBooking(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ bookingId, patch }: { bookingId: string; patch: Partial<Booking> }) =>
      api.bookings.update(bookingId, patch),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useRemoveBooking(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (bookingId: string) => api.bookings.remove(bookingId),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

/* Fuel */

export const useFuelLegs = (tripId: string) =>
  useQuery({ queryKey: keys.fuel(tripId), queryFn: () => api.fuel.list(tripId) })

export function useCreateFuelLeg(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<NewFuelLeg, 'tripId'>) => api.fuel.create({ ...input, tripId }),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useUpdateFuelLeg(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ legId, patch }: { legId: string; patch: Partial<FuelLeg> }) =>
      api.fuel.update(legId, patch),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useRemoveFuelLeg(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (legId: string) => api.fuel.remove(legId),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

/* Expenses */

export const useExpenses = (tripId: string) =>
  useQuery({ queryKey: keys.expenses(tripId), queryFn: () => api.expenses.list(tripId) })

export function useCreateExpense(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<NewExpense, 'tripId'>) => api.expenses.create({ ...input, tripId }),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useUpdateExpense(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ expenseId, patch }: { expenseId: string; patch: Partial<Expense> }) =>
      api.expenses.update(expenseId, patch),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useRemoveExpense(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (expenseId: string) => api.expenses.remove(expenseId),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

/* Chat */

export const useChannels = (tripId: string) =>
  useQuery({ queryKey: keys.channels(tripId), queryFn: () => api.chat.listChannels(tripId) })

export const useMessages = (channelId: string | undefined) =>
  useQuery({
    queryKey: keys.messages(channelId ?? 'none'),
    queryFn: () => api.chat.listMessages(channelId as string),
    enabled: Boolean(channelId),
  })

export function useSendMessage(channelId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => api.chat.send(channelId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.messages(channelId) }),
  })
}
