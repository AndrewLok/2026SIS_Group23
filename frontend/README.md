# Voyager — front end

A shared planning app for one small group taking one trip together. It answers two
questions fast: **what are we doing next**, and **what do I owe**.

Front end only for now. It runs against an in-memory mock layer, so it demos with no
backend running.

## Running it

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:5173 and press **Try the demo trip**. That signs you in as a
seeded member of a trip with five people, so every screen has real-looking data in it.

| Script | Does |
|---|---|
| `npm run dev` | Dev server on 127.0.0.1:5173 |
| `npm run build` | Typecheck and production build |
| `npm run test` | Vitest: the maths, the mock services, and the HTTP clients against a stubbed `fetch` |
| `npm run e2e` | Playwright end to end tests against the real backend (see below) |
| `npm run lint` | oxlint |

Everything in the app is fabricated demo data. No person, booking, reference or figure
in it corresponds to anything real.

### With the real backend (sign-in, trips, members, chat, activities and votes so far)

```bash
# terminal 1, in ../backend (listens on 8080)
./gradlew bootRun

# terminal 2, in this folder
cp .env.example .env.local      # sets VITE_USE_MOCK=false
npm run dev
```

Sign-in, sign-up and sign-out then go to the Spring backend (`/api/auth/*`), which keeps you
logged in with a session cookie. Vite proxies `/api` to `127.0.0.1:8080`, so the cookie is
same-origin and no CORS setup is needed. The demo button is hidden in this mode, because the
demo account only exists in the mock store.

Trips and their members (create, edit, invite code, join, leave, remove, roles) then go to
`/api/trips/*` too, so they are shared between people and devices. Only the owner can change
a trip's name, dates or currency, make a new invite code, remove others or change roles; any
member can change the shared settings (private debts, allowance, fuel defaults) or leave.

Group chat is real too. Messages go over `/api/channels/*`, and what each person has read is
kept on the server, so the unread count and the "New" divider follow you between devices. New
messages reach other people's screens through one WebSocket (`/ws/chat`, proxied by Vite like
`/api`) that only says "something new here"; the screen then fetches. If the socket drops it
reconnects with a growing delay, and if it cannot connect at all the screens check every
5 seconds instead, so chat still arrives, only slower (`services/http/liveChat.ts`).

Activities and votes are real too (`/api/trips/{id}/ideas`, `/api/ideas/*`). The server counts the
votes and moves an activity between the Plan and Voting tabs: more than half of the people on the
trip carry it, and everyone who agreed is marked as going the moment it is carried. Only the person
who added an activity, or the trip owner, can change or delete it; anyone on the trip can vote and
say they are in or out. Someone who leaves the trip takes their votes with them, and what is still
open is counted again against the smaller group. Other people's votes appear by the Activities
screen looking again every 5 seconds while it is open (there is no live socket for this one), so
two people on the screen see each other's changes within a few seconds.

The calendar can be taken out of the app (Calendar screen, "Add to my calendar"): a link for Google,
Apple or Outlook to subscribe to, which keeps up as plans change, and a `.ics` download for a
one-off copy. The server builds both from the activities going ahead (`/api/trips/{id}/calendar.ics`,
`/api/trips/{id}/calendar/feed`, and the open `/api/calendar/feeds/{token}.ics` a calendar app reads
with no login). There is no mock version, so the button only shows with a real backend
(`features.calendarExport`). The link needs an address that is online: a calendar app's servers cannot
reach `localhost`, and the panel says so when it sees one. Bookings are not in the file yet, because
they have no backend.

If the server stops recognising you (the session ran out, or you signed out somewhere else), the
next request comes back 401, which the app treats as `unauthenticated` rather than `forbidden`. One
handler in `services/queryClient.ts` then clears what was loaded and sends you to the sign-in screen
with a note, and signing in again returns you to where you were.

Expenses, fuel and bookings still run on the mock layer until their
backend side is built, which means that data lives in your browser only and is not shared
between people or devices. Those screens read the mock store, so a temporary bridge
(`services/mock/bridge.ts`) mirrors your account, the real trips and their members into it
whenever they are fetched. It goes away as each of those modules moves to `services/http`.

Known gap: fuel's "remembered defaults" are saved by the mock fuel service onto the mock trip
row only, so on a real trip they do not persist across reloads until fuel has a backend.

### End to end tests

These drive a real browser through the real app and the real Spring backend: sign-up and
sign-in, creating a trip, joining by invite link, regenerating the code, leaving, group
chat (a message reaching the other person's open screen live, the unread count, the "New"
divider), activities (a vote on one screen carrying an activity onto the plan on another,
voting for and against, saying you are in or out, who sees a delete button, someone leaving mid-vote),
the members screen (who is offered Remove and Leave, removing someone and letting them back in),
the calendar and the overview's next-up sign and Vote lamp, taking the calendar out (the subscription link read with no login, a new link replacing it, the download), and what happens when things go wrong: the session ending under you, a refused request,
over-long text, a browser in another time zone (`e2e/resilience.e2e.ts`). Each person in a test
has their own browser context, so their own cookie, like separate phones.

```bash
npx playwright install chromium   # once, about 150 MB
npm run e2e
```

Playwright starts everything itself and stops it afterwards: the backend with
`./gradlew bootRun` in `../backend` (port 8080, in-memory database, so every run starts
empty) and a separate Vite on port **5174** with `VITE_USE_MOCK=false`, so a dev server
you already have open on 5173 can never be tested by mistake. The first run is slow while
Gradle compiles. If a backend is already running on 8080 it is reused; the tests sign up
fresh accounts, so leftover data does not matter. Failed runs leave a screenshot and a trace
in `test-results/` (`npx playwright show-trace <trace.zip>`). Vite may print `ws proxy error:
read ECONNRESET` or `write EPIPE` lines while the chat tests run; that is only a test browser
closing its chat connection abruptly, and is harmless.

The files are `e2e/*.e2e.ts`. The `.e2e.ts` name keeps `npm run test` (Vitest) from picking
them up. The detailed permission rules belong in the backend's `TripFlowTests`, `ChatFlowTests`
and `IdeaFlowTests`; the e2e tests cover journeys across two people's screens. The live chat checks
wait only 3 seconds, less than the 5 second polling fallback, so they pass only when the
socket really delivers. The activities checks wait up to 12 seconds, because they rely on that
polling. Expenses, fuel and bookings still run on the mock layer and are deliberately not covered
yet. Trip renaming, role changes and ruling out or editing an activity have no screen yet, so
only the backend tests cover them.

## How it is put together

```
src/
  types/index.ts      every entity, plus one mapper per entity
  lib/                pure functions, no React: money, dates, balances, fuel,
                      voting, estimate, calendar
  services/
    client.ts         THE SWAP POINT — see below
    mock/             in-memory store, seeded, persisted to localStorage
  hooks/
    useSession.tsx    session context
    queries/          TanStack Query wrappers
  components/
    ui/               shadcn, owned by the CLI, do not hand-edit
    common/           ours: Instrument, money, people, chrome, state, Field
    layout/           AppShell, TripLayout
  pages/              one file per route
```

Four rules hold throughout:

1. **No component talks to the mock data directly.** Everything goes through `api` in
   `src/services/client.ts`.
2. **Every derived number is a pure function in `src/lib`** with no React in it, so the
   maths can be tested without rendering anything.
3. **Money is integer cents, never a float.** One `formatMoney()` helper.
4. **Dates are ISO strings in UTC**, formatted only at render. A date that is only a day (a trip's
   start, when an expense was spent) is stored as noon on that day, on the picker's own clock, by
   `dayToIso()`, so it shows as the same day for them and for anyone within twelve hours.

## Wiring a real backend

`src/services/client.ts` is the only file that has to change. Rewrite the modules behind
it keeping the same method signatures, and no screen is touched. Sign-in, trips, chat,
activities and votes are done: `services/http/auth.ts`, `trips.ts`, `chat.ts`, `ideas.ts` and
`votes.ts` replace their mock twins when
`VITE_USE_MOCK=false`, and `services/http/request.ts` is the shared fetch wrapper that turns
every failure into an `ApiError`. Move the other modules over one at a time the same way.

Decided so far:

- **Auth is a session cookie**, not a JWT. Nothing is stored client side; the browser sends
  the cookie itself.
- The backend answers in camelCase in exactly the shape of the types here, with errors as
  `{ code, message }` using the `ApiError` codes, so the mappers for it are checks, not
  conversions.
- Backend ids are UUIDs. They arrive as strings, which is what this app already uses.

Still to sort out, entity by entity:

- Money is integer cents on both sides (the backend trip's budget is `budgetCapCents`).
  Never let a float into the app.
- Expenses, fuel legs and bookings do not exist server side yet. Those endpoints are a
  conversation, not a swap.

Keep the mock layer in the repo behind `VITE_USE_MOCK`. It is what makes the app
demoable when the backend is on someone else's branch and not running.

## Design

The design language is not the shadcn preset. It is a **night instrument panel**: a dark
tinted panel carrying instruments that each own one truth, chosen because the app is used
late at night, in a car, on patchy data.

- The palette, type and motion decisions live in `src/styles/index.css`, in one place. Do
  not override them per component, or there stops being a design system.
- Colour is meaning and it is fixed: radium green is a normal reading, amber wants
  attention, red is destructive only and never decorates.
- **Dark only, deliberately.** There is no light theme, and adding one would not be this
  world.
- `PRODUCT.md` holds the product truth, and `.impeccable/surfaces/` holds the direction
  contract the build was held to.

## What it deliberately does not do

Each of these is stated on screen where someone might otherwise wait for it:

- No payments or transfers. Settle up between yourselves.
- Even splits only. Fuel legs are the single exception, splitting across their riders.
- No real bookings are made here, and nothing is checked against an airline.
- No live flight tracking. Details are whatever the person who booked it typed in.
- Online only. It degrades gracefully on bad signal, but there is no offline mode.
