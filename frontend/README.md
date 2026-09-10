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
| `npm run test` | Vitest, covering the money maths |
| `npm run lint` | oxlint |

Everything in the app is fabricated demo data. No person, booking, reference or figure
in it corresponds to anything real.

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
4. **Dates are ISO strings in UTC**, formatted only at render.

## Wiring a real backend

`src/services/client.ts` is the only file that has to change. Rewrite the modules behind
it keeping the same method signatures, and no screen is touched.

Things to sort out with whoever owns the backend branch first:

- Their ids are `Long`. Keep ids as strings here and convert in the mapper.
- They use `BigDecimal` for money. Parse to integer cents on the way in and send decimal
  strings on the way out. Never let a float into the app.
- `AuthController` is a stub. Ask whether it will issue a session cookie or a JWT before
  writing `useSession` against it.
- Ideas, votes, expenses, fuel legs and bookings do not exist server side yet. Those
  endpoints are a conversation, not a swap.
- Their `Trip` has no name, no invite code and no members. This app needs all three.

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
