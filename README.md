# Voyager

A shared planning app for one small group taking one trip together. It answers two questions
fast: **what are we doing next**, and **what do I owe**.

| Folder | What it is |
|---|---|
| `frontend/` | Vite, React and TypeScript. Runs on its own against an in-browser mock, or against the backend. See `frontend/README.md`. |
| `backend/` | Spring Boot (Java 25). Accounts, trips and members, and group chat so far. |

## Try it

The quickest way, with nothing else running, is the mock:

```bash
cd frontend
npm install
npm run dev          # then press "Try the demo trip" at http://127.0.0.1:5173
```

To run it against the real backend:

```bash
# terminal 1
cd backend && ./gradlew bootRun            # listens on 8080, in-memory database, starts empty

# terminal 2
cd frontend
cp .env.example .env.local                 # VITE_USE_MOCK=false
npm run dev
```

Delete `.env.local` to go back to the mock. The database is in memory, so stopping the backend
forgets every account and trip.

## Tests

| Command | Where | What it covers |
|---|---|---|
| `./gradlew test` | `backend/` | The real server on a random port, driven over HTTP and WebSocket: sign-up and sign-in, who may do what on a trip, chat, and a few "two requests at the same moment" cases. |
| `npm test` | `frontend/` | The maths, the mock services, and the HTTP clients against a stubbed `fetch`. |
| `npm run e2e` | `frontend/` | A real browser through the real app and the real backend. Needs `npx playwright install chromium` once. |

## How it hangs together

- **Login is a session cookie** (HttpOnly, SameSite=Lax), not a token. The browser sends it
  itself, and signing out ends it on the server straight away, closing that session's chat
  sockets too. When it ends some other way (it expires, or the account goes) the frontend notices
  on the next request and sends the person back to sign in.
- **Who may see what** is decided in the services, not the screens. Anyone who is not on a trip
  gets a 404 for it, exactly as if it did not exist. Owners can rename, redate, remove people and
  change roles; any member can change the shared settings or leave; a trip always keeps an owner.
- **Chat** is plain REST for the content, plus one WebSocket that only says "something new here"
  so other screens fetch straight away. If the socket cannot connect, screens check every five
  seconds instead.
- **Money is whole cents** everywhere, never a float.
- **Dates** that are only a day (a trip's start and end, when an expense was spent) are stored as
  noon on that day, on the clock of whoever picked it. That keeps the day the same for the picker
  wherever they are, and for anyone within twelve hours of them. A group spread across the world
  (Sydney and Los Angeles, say) can still see a day's difference at the edges.
- Text has length limits (names 60 characters, trip name and destination 100, message 2000). The
  forms stop you at the limit, and the server refuses anything longer with a message.

## Before this goes anywhere public

These are known and deliberate for now:

- **The database is H2 in memory**, and its web console is switched off. Moving to Postgres
  (Supabase included) means swapping the datasource, taking H2 out of `build.gradle`, setting
  `ddl-auto` to `validate` and writing the schema as migrations (Flyway or Liquibase). If the
  backend ever runs as more than one copy, login sessions will also need to live in the database
  or Redis (Spring Session), and the chat socket will need a shared message bus.
- **No rate limiting** on sign-in or on invite codes yet, so both can be guessed at.
- **CSRF tokens are off.** The session cookie is SameSite=Lax and every change needs a JSON body,
  which covers a browser. Revisit before serving it from a different site than the frontend.
- **Turn on `server.servlet.session.cookie.secure`** once it is served over HTTPS.
- Ideas, votes, expenses, fuel and bookings are still mock-only on the frontend.
