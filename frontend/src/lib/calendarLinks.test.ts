import { describe, expect, it } from 'vitest'
import { absoluteUrl, googleSubscribeUrl, isPrivateHost, webcalUrl } from '@/lib/calendarLinks'

const PATH = '/api/calendar/feeds/abc_DEF-123.ics'

describe('calendar links', () => {
  it('puts the address of this site in front of the path', () => {
    expect(absoluteUrl(PATH, 'https://voyager.example')).toBe(`https://voyager.example${PATH}`)
    expect(absoluteUrl(PATH, 'http://localhost:5173')).toBe(`http://localhost:5173${PATH}`)
  })

  it('writes the same address as webcal for apps that subscribe on open', () => {
    expect(webcalUrl(`https://voyager.example${PATH}`)).toBe(`webcal://voyager.example${PATH}`)
    expect(webcalUrl(`http://localhost:5173${PATH}`)).toBe(`webcal://localhost:5173${PATH}`)
  })

  it('fills in Google Calendar’s add-by-link page, with the address encoded', () => {
    const url = googleSubscribeUrl(`https://voyager.example${PATH}`)
    expect(url.startsWith('https://calendar.google.com/calendar/r?cid=')).toBe(true)
    const cid = new URL(url).searchParams.get('cid')
    expect(cid).toBe(`webcal://voyager.example${PATH}`)
  })

  it('knows an address a calendar app’s servers could never reach', () => {
    for (const host of [
      'http://localhost:5173',
      'http://127.0.0.1:8080',
      'http://192.168.1.20',
      'http://10.0.0.4',
      'http://172.16.5.5',
      'http://172.31.255.1',
      'http://trips.local',
      'http://[::1]:5173',
    ]) {
      expect(isPrivateHost(host + PATH), host).toBe(true)
    }
    for (const host of [
      'https://voyager.example',
      'https://172.32.0.1',
      'https://172.15.0.1',
      'https://11.0.0.1',
      'https://localhost.example.com',
    ]) {
      expect(isPrivateHost(host + PATH), host).toBe(false)
    }
  })
})
