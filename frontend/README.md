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

### With the real backend (everything: sign-in, trips, members, chat, activities, votes, bookings, expenses and fuel)

```bash
# terminal 1, in ../backend (listens on 8080; needs Postgres, see the root README, or add
# SPRING_PROFILES_ACTIVE=h2 to run with the database in memory)
./gradlew bootRun

# terminal 2, in this folder
cp .env.example .env.local      # sets VITE_USE_MOCK=false
npm run dev
```

Sign-in, sign-up and sign-out then go to the Spring backend (`/api/auth/*`), which keeps you
logged in with a session cookie. Vite proxies `/api` to `127.0.0.1:8080`, so the cookie is
same-origin and no CORS setup is needed. The demo button is hidden in this mode, because the
demo account only exists in the mock store.

The app opens in night, and the sun and moon button (login, trip list, and a trip's top bar) switches to
daylight. The choice is kept in this browser (`voyager-theme` in localStorage), not on the account, and the
overview's dashboard stays a night scene in both. It is `next-themes` putting a `dark` class on `<html>`,
so a reload does not flash the other theme.

Trips and their members (create, edit, invite code, join, leave, remove, roles) then go to
`/api/trips/*` too, so they are shared between people and devices. Only the owner can change
a trip's name, destination, dates, currency or budget cap, make a new invite code, remove others or
change roles; any member can change the shared settings (private debts, allowance, fuel defaults)
or leave. The Trip settings screen (in the trip menu) edits all of these except the currency; see
below.

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

Trip settings (trip menu, "Trip settings") has two forms. The owner's is the name, destination, dates
and a budget cap; everyone else sees it read only. Anyone can save the other: allowance each, and the
efficiency and price per litre the fuel form starts from. Each sends only the fields that changed
(`src/lib/tripSettings.ts`), so a member saving the shared form never trips over the owner-only rules,
and nobody's save overwrites a field somebody else changed meanwhile. The budget cap, when set, is
what the overview's tank and the Money screen's spend bar measure against instead of the cost
estimate. The currency can be changed on the server but is not offered here, because amounts are
shown in dollars whatever it says. On the Members screen an owner can promote a member to owner or
step an owner down; a trip always keeps at least one owner, and an owner may leave once there is
another. On Activities, the person who proposed an idea (or the owner) can edit it, rule it out, and
put a ruled-out idea back to a vote.

Bookings are real too (`/api/trips/{id}/bookings`, `/api/bookings/*`). Everyone on the trip sees every
booking; a personal one is marked with its owner's name, not hidden. The person who added a booking,
the person it belongs to, and the owner can delete it, and the Delete button is only offered to
them. If someone leaves the trip, bookings that belonged to them go too. Other people's changes
appear within 5 seconds, the same way activities do. The top of the screen suggests two bookings (`src/lib/recommendations.ts`): fixed examples, the same
on every trip, which open the ordinary booking form filled in, with the cost ready to go on the money
screen. The people who may delete a booking can also
edit it (the pencil on its card): the form starts from what is saved and sends only what you changed.

Expenses are real too (`/api/trips/{id}/expenses`, `/api/expenses/*`). Everyone on the trip sees every
expense. The person who added one, the person who paid, and the owner can delete it, and the Delete
button is only offered to them. Balances and "settle up" are still worked out on the screen
(`src/lib/balances.ts`) from the list the server sends, so the split rules live in one place.
Someone who leaves keeps their expenses and their share of others: they are still owed what they
paid, and still owe their part of what was split with them, shown as "someone who has left the trip"
in the settle-up list. The screens that count people
(Money and the trip overview) look at the member list every 5 seconds for that reason. Other people's
changes appear within 5 seconds. The form has no way to edit an expense yet, although the server supports it.

Fuel is real too (`/api/trips/{id}/fuel-legs`, `/api/fuel-legs/*`). Everyone on the trip sees every
leg. The person who added one, the driver, and the owner can delete it, and the Delete button is
only offered to them. A leg's expense is written by the server together with the leg, paid by the
driver, so it arrives in the ordinary expenses list (marked `fuel`, read only, with a link back to the
leg) and is part of every balance; deleting the leg removes it. The cost is worked out on both sides
with the same sum (`src/lib/fuel.ts` here, `FuelCost` on the server), so the number on the leg card
and the expense always agree to the cent. The price per litre has to be whole cents, as the trip's
remembered default is. Making a leg saves its efficiency and price as the trip's defaults, so they
persist across reloads. Someone who leaves keeps their legs and their share of others', like
expenses. A leg can be edited by the people who may delete it (the pencil on its card), and its
expense follows. As with expenses, only what changed is sent, and a driver or rider who has left
stays on the leg unless their tick is taken off.

The calendar can be taken out of the app (Calendar screen, "Add to my calendar"): a link for Google,
Apple or Outlook to subscribe to, which keeps up as plans change, and a `.ics` download for a
one-off copy. The server builds both from the activities going ahead (`/api/trips/{id}/calendar.ics`,
`/api/trips/{id}/calendar/feed`, and the open `/api/calendar/feeds/{token}.ics` a calendar app reads
with no login). There is no mock version, so the button only shows with a real backend
(`features.calendarExport`). The link needs an address that is online: a calendar app's servers cannot
reach `localhost`, and the panel says so when it sees one. Bookings with a time are in the file, but
not their reference or notes.

If the server stops recognising you (the session ran out, or you signed out somewhere else), the
next request comes back 401, which the app treats as `unauthenticated` rather than `forbidden`. One
handler in `services/queryClient.ts` then clears what was loaded and sends you to the sign-in screen
with a note, and signing in again returns you to where you were.

Every module now has a backend side, so with `VITE_USE_MOCK=false` nothing is read from or written to
the local mock store. (The temporary bridge that used to mirror your account, trips and members into
it for the unfinished screens has been deleted.) The mock layer is there only for the no-backend demo.

### End to end tests

These drive a real browser through the real app and the real Spring backend: sign-up and
sign-in, creating a trip, joining by invite link, regenerating the code, leaving, group
chat (a message reaching the other person's open screen live, the unread count, the "New"
divider), activities (a vote on one screen carrying an activity onto the plan on another,
voting for and against, saying you are in or out, who sees a delete button, someone leaving mid-vote),
the members screen (who is offered Remove and Leave, removing someone and letting them back in, promoting and demoting), trip settings (what an owner and a member can change), editing what was added (bookings, expenses, legs),
the calendar and the overview's next-up sign and Vote lamp, night and daylight (`theme.e2e.ts`), bookings (one person's screen reaching another's, who is offered Delete, leaving), expenses (a payment reaching the others and the balances adding up, exact amounts, who is offered Delete, someone leaving with money outstanding), fuel (a leg and its expense reaching everyone, only the riders being charged, who is offered Delete, a driver other than the person who added it), taking the calendar out (the subscription link read with no login, a new link replacing it, the download), and what happens when things go wrong: the session ending under you, a refused request,
over-long text, a browser in another time zone (`e2e/resilience.e2e.ts`). Each person in a test
has their own browser context, so their own cookie, like separate phones.

```bash
npx playwright install chromium   # once, about 150 MB
npm run e2e
```

Playwright starts everything itself and stops it afterwards: the backend with
`./gradlew bootRun` in `../backend` (port 8080, with the `h2` profile: an in-memory database, so
nothing to install and every run starts empty) and a separate Vite on port **5174** with `VITE_USE_MOCK=false`, so a dev server
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
polling. `settings.e2e.ts` covers the trip settings screen and `edits.e2e.ts` the booking, expense
and fuel leg edit forms; `members.e2e.ts` and `activities.e2e.ts` cover role changes and ruling out
or editing an activity. The rules behind them are in the backend tests.

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
activities, votes, bookings, expenses and fuel are done: `services/http/auth.ts`, `trips.ts`, `chat.ts`, `ideas.ts`,
`votes.ts`, `bookings.ts`, `expenses.ts` and `fuel.ts` replace their mock twins when
`VITE_USE_MOCK=false`, and `services/http/request.ts` is the shared fetch wrapper that turns
every failure into an `ApiError`. That is every module.

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
