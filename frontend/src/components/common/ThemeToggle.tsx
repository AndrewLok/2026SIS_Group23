/*
 * Night or daylight. Night is the default, and the choice is kept in this browser (localStorage, under
 * "voyager-theme"), so it is per device, not per account. next-themes puts the `dark` class on <html>
 * before the page paints, which is what keeps a reload from flashing the other theme.
 */

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** The browser chrome's colour (the address bar on a phone) follows the panel. */
const PANEL = { dark: '#0b0d0f', light: '#eceff0' } as const

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const light = resolvedTheme === 'light'

  React.useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', light ? PANEL.light : PANEL.dark)
  }, [light])

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-8 shrink-0 text-placard', className)}
      onClick={() => setTheme(light ? 'dark' : 'light')}
    >
      {light ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
      <span className="sr-only">{light ? 'Switch to dark mode' : 'Switch to light mode'}</span>
    </Button>
  )
}
