import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AvatarStack } from '@/components/common/people'
import { useSession } from '@/hooks/useSession'
import { useJoinByCode } from '@/hooks/queries'
import { api } from '@/services/client'

export function JoinPage() {
  const { code = '' } = useParams<{ code: string }>()
  const { user, loading } = useSession()
  const navigate = useNavigate()
  const join = useJoinByCode()
  const [joining, setJoining] = React.useState(false)

  const preview = useQuery({
    queryKey: ['join', code],
    queryFn: () => api.trips.previewByCode(code),
    retry: false,
  })

  // An invite link opened while signed out returns here after signing in.
  if (!loading && !user) {
    return <Navigate to="/login" replace state={{ from: `/join/${code}` }} />
  }

  const accept = async () => {
    setJoining(true)
    try {
      const trip = await join.mutateAsync(code)
      toast.success(`You are on ${trip.name}`)
      navigate(`/trips/${trip.id}`, { replace: true })
    } catch {
      toast.error('Could not join that trip.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="placard mb-3 text-center text-xs">Invite code {code.toUpperCase()}</p>

        {preview.isPending ? (
          <div className="plate flex items-center justify-center gap-3 p-8 text-placard">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            <span className="placard text-xs">Checking the code</span>
          </div>
        ) : preview.isError ? (
          <div className="plate flex flex-col items-center gap-4 p-8 text-center">
            <span className="recessed flex size-12 items-center justify-center rounded-full text-caution">
              <TriangleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-lg font-semibold">That code does not match a trip</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Codes get regenerated when someone leaves. Ask whoever sent it for the current one.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/trips')}>
              Go to my trips
            </Button>
          </div>
        ) : (
          <div className="plate flex flex-col items-center gap-5 p-6 text-center">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{preview.data.trip.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {preview.data.trip.destination || 'Destination not set'}
              </p>
            </div>
            <AvatarStack profiles={preview.data.members} size={34} />
            <p className="text-sm text-muted-foreground">
              {preview.data.members.length}{' '}
              {preview.data.members.length === 1 ? 'person is' : 'people are'} already on this trip.
              Joining puts you in every even split from here on.
            </p>
            <Button className="w-full" onClick={() => void accept()} disabled={joining}>
              {joining ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
              Join this trip
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
