import * as React from 'react'
import { CalendarPlus, Check, Copy, Download, ExternalLink, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Placard } from '@/components/common/chrome'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCalendarFeed,
  useDownloadCalendar,
  useRenewCalendarFeed,
} from '@/hooks/queries'
import { absoluteUrl, googleSubscribeUrl, isPrivateHost, webcalUrl } from '@/lib/calendarLinks'
import { saveFile } from '@/lib/download'
import { messageFor } from '@/lib/errors'

/**
 * Takes the trip's calendar into the person's own calendar app: a link to subscribe to, which keeps
 * up as plans change, and a download for a one-off copy. The file itself is built by the server.
 */
export function ShareCalendar({ tripId }: { tripId: string }) {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const feed = useCalendarFeed(tripId, open)
  const renew = useRenewCalendarFeed(tripId)
  const download = useDownloadCalendar(tripId)

  const link = feed.data ? absoluteUrl(feed.data, window.location.origin) : null

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Your browser would not let us copy that. Select the link and copy it yourself.')
    }
  }

  async function renewLink() {
    try {
      await renew.mutateAsync()
      toast.success('New link made. The old one no longer works.')
    } catch (error) {
      toast.error(messageFor(error, 'Could not make a new link. Try again.'))
    }
  }

  async function saveCopy() {
    try {
      const file = await download.mutateAsync()
      saveFile(file.name, file.blob)
    } catch (error) {
      toast.error(messageFor(error, 'Could not download the calendar. Try again.'))
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlus size={14} aria-hidden="true" />
          Add to my calendar
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add to my calendar</SheetTitle>
          <SheetDescription>
            Take what is planned into Google Calendar, Apple Calendar or Outlook.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <section className="flex flex-col gap-3" aria-labelledby="subscribe-heading">
            <Placard className="self-start">
              <span id="subscribe-heading">Subscribe</span>
            </Placard>
            <p className="text-sm text-muted-foreground">
              Your calendar app keeps this in step as the group adds and changes plans. Most apps
              check every few hours, so a change can take a while to show.
            </p>

            {feed.isPending ? (
              <Skeleton className="h-9 w-full" />
            ) : feed.isError || !link ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-destructive">
                  {messageFor(feed.error, 'Could not get your calendar link.')}
                </p>
                <Button variant="outline" size="sm" onClick={() => void feed.refetch()}>
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={link}
                    aria-label="Calendar link"
                    className="tabular min-w-0 flex-1 text-xs"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <Button variant="outline" size="sm" onClick={() => void copy(link)}>
                    {copied ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      <Copy size={14} aria-hidden="true" />
                    )}
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                </div>

                {isPrivateHost(link) ? (
                  <p className="text-xs text-caution">
                    This address is only reachable from this computer or network, so Google and other
                    online calendars cannot subscribe to it yet. It will work once the app is online.
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a href={googleSubscribeUrl(link)} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} aria-hidden="true" />
                      Google Calendar
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href={webcalUrl(link)}>
                      <ExternalLink size={14} aria-hidden="true" />
                      Apple Calendar or Outlook
                    </a>
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Anyone with this link can see what is planned on this trip, so keep it to
                  yourself. It stops working if you leave the trip.
                </p>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="self-start" disabled={renew.isPending}>
                      <RefreshCw size={14} aria-hidden="true" />
                      Make a new link
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Make a new link?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The old link stops working straight away. Any calendar already using it will
                        stop updating until you give it the new one.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep the old link</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void renewLink()}>
                        Make a new link
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="download-heading">
            <Placard className="self-start">
              <span id="download-heading">Download a copy</span>
            </Placard>
            <p className="text-sm text-muted-foreground">
              A file to import once. It shows the plan as it is today and does not update.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              disabled={download.isPending}
              onClick={() => void saveCopy()}
            >
              <Download size={14} aria-hidden="true" />
              Download .ics
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
