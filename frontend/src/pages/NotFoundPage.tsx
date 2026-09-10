import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="placard text-xs">No reading</span>
        <h1 className="text-2xl font-semibold tracking-tight">That screen is not on the panel</h1>
        <p className="max-w-[42ch] text-sm text-muted-foreground">
          The link may be old, or the trip may have been left. Head back and pick it up from there.
        </p>
      </div>
      <Button asChild>
        <Link to="/trips">Go to my trips</Link>
      </Button>
    </div>
  )
}
