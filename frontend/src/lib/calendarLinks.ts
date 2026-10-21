/*
 * Turning the path the server gives for a subscription link into the addresses people need.
 * A calendar app wants the full address of this site, and some want it as webcal:// so that
 * opening it means "subscribe" rather than "download a file".
 */

/** "/api/calendar/feeds/x.ics" on "https://voyager.example" is the full https address. */
export const absoluteUrl = (path: string, origin: string): string => new URL(path, origin).toString()

/** The same address as webcal://, which Apple Calendar and Outlook take as "subscribe to this". */
export const webcalUrl = (httpUrl: string): string => httpUrl.replace(/^https?:/i, 'webcal:')

/** Google Calendar's "add by link" page, already filled in. */
export const googleSubscribeUrl = (httpUrl: string): string =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(httpUrl))}`

/**
 * Calendar apps fetch the link from their own servers, so an address on this computer (or a private
 * network) cannot work for them, however right it looks.
 */
export function isPrivateHost(httpUrl: string): boolean {
  const { hostname } = new URL(httpUrl)
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === '[::1]'
  )
}
