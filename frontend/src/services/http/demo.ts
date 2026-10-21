import { request } from '@/services/http/request'

/** Wipe the server's data and put the demo trip back. Signs everyone out. */
export const reset = (): Promise<void> => request('POST', '/demo/reset')
