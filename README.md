# Voyager

A shared planning app for one small group taking one trip together. It answers two questions
fast: **what are we doing next**, and **what do I owe**.

| Folder | What it is |
|---|---|
| `frontend/` | Vite, React and TypeScript. Runs on its own against an in-browser mock, or against the backend. See `frontend/README.md`. |
| `backend/` | Spring Boot (Java 25). Accounts, trips and members, group chat, activities with their votes, bookings, expenses, fuel legs, and the trip calendar as a file. |

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
docker compose up -d db                    # a local Postgres (once; it keeps its data)
cd backend && ./gradlew bootRun            # listens on 8080, creates its tables on first start

# terminal 2
cd frontend
cp .env.example .env.local                 # VITE_USE_MOCK=false
npm run dev
```

Delete `.env.local` to go back to the mock.

### Database

The backend uses Postgres. The schema is a Flyway migration (`backend/src/main/resources/db/migration`),
run on start-up, and Hibernate only checks that the entities still match it (`ddl-auto: validate`), so
changing an entity means adding a new `V2__...sql`, never editing `V1`. Settings come from the
environment:

| Variable | Default | What |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/voyager` | A JDBC url, not the `postgres://` one some hosts show. For a hosted database add `?sslmode=require`. |
| `DB_USER` / `DB_PASSWORD` | `voyager` / `voyager` | Match `docker-compose.yml`. |
| `COOKIE_SECURE` | `false` | Set `true` once the site is served over HTTPS, or the login cookie is sent in the clear. |
| `DDL_AUTO` | `validate` | `none` skips the entity check; leave it alone otherwise. |

To run with no database installed, `SPRING_PROFILES_ACTIVE=h2 ./gradlew bootRun` keeps everything in
memory, gone when the server stops (the end-to-end tests start it this way, and `./gradlew test` uses
H2 too).

## Tests

| Command | Where | What it covers |
|---|---|---|
| `./gradlew test` | `backend/` | The real server on a random port, driven over HTTP and WebSocket: sign-up and sign-in, who may do what on a trip, chat, activities and votes, and a few "two requests at the same moment" cases. |
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
- **Activities** are either added straight to the plan (with a time and the people going) or put to
  the group. More than half of the people on the trip carry a vote, and the server, not the screen,
  moves an activity between "voting" and "agreed" every time a vote changes or someone leaves.
  Everyone who agreed is marked as going at the moment it is carried; after that being in or out
  is each person's own call. Only the person who added one, or the trip owner, can change or
  delete it. Other people's changes reach an open screen within 5 seconds (it looks again; there
  is no socket for this).
- **Bookings** (flights, stays, cars you have already booked elsewhere) are a record, not a
  decision, so there are no votes. Everyone on the trip sees every booking; one that belongs to a
  single person is marked as theirs rather than hidden, because the cost estimate counts them all
  and hiding some would give each person a different total. The person who added a booking, the
  person it belongs to, and the trip owner can change or delete it. A booking that belongs to
  someone who leaves goes with them; ones they added for the group or for somebody else stay.
  The booking reference and notes are never put in the calendar file (see below).
- **Expenses** are money somebody spent for the trip, in whole cents. Everyone on the trip sees all
  of them. An expense is shared evenly by everyone on the trip, or by the people named in its
  split: *equal* (evenly between the named people) or *exact* (what each person owes the payer,
  with whatever is left being the payer's own share, and never more than the total). The server
  checks that the person who paid and everyone in a split are on the trip, and that the figures
  are whole numbers (12.5 is refused, not cut to 12). The person who added an expense, the person
  who paid, and the trip owner can change or delete it. Balances and the settle-up list are not
  stored: the screen works them out from the list. Someone who leaves does not take their
  expenses with them, or their share of other people's: they are still owed what they paid and
  still owe what they ate: the add-expense form always names who is sharing, so an expense made
  before they left is still split the way it was agreed (only one with no split at all, as when a
  booking is also added as an expense, is shared by whoever is on the trip). Nobody can start naming
  them in a new expense. Expenses written by a fuel leg cannot be changed or deleted
  here: edit or delete the leg and its expense follows.
- **Fuel legs** are one drive: a distance, how thirsty the car is (litres per 100 km), a price per
  litre in whole cents, the driver who pays at the pump, and the riders who share it. The cost is
  worked out on the server with the same sum the screen uses (`FuelCost`, mirroring
  `frontend/src/lib/fuel.ts`: litres = distance × efficiency / 100, cost = litres × price rounded to
  the cent, halves up) and is never sent by the client. Every leg has an expense for that cost,
  paid by the driver and split between the riders only. The server writes it with the leg, keeps
  it in step when the leg is changed and removes it with the leg, all in one transaction, so there
  is never one without the other; a leg has to cost something. The person who added a leg, the
  driver, and the trip owner can change or delete it. The driver and riders have to be on the trip
  and there has to be at least one rider. Making a leg also remembers its efficiency and price as the
  trip's defaults for the next form. Someone who leaves keeps their legs and their place on
  other people's, as with expenses: they are still owed what they paid at the pump and still owe
  what they rode. A leg may keep naming them, but a new or edited one cannot add them.
- **The trip calendar can leave the app** as an `.ics` file: a one-off download, or a link a
  calendar app subscribes to. The calendar is not stored; the file is built each time from the
  activities that are going ahead and have a start time. A calendar app cannot send the login
  cookie, so each person has their own secret link (256 random bits, kept as plain text so the
  screen can show it again) that can only read. It stops working when they leave the trip, and
  "Make a new link" replaces it. Times are written in UTC and every calendar app shows them in the
  viewer's own zone; an all-day activity is written as a plain date, taken from the UTC date of its
  start. Bookings that have a time are in the file too, with their provider and route but not their
  reference or notes: the link is a bearer address that can be pasted around, a reference lets
  whoever holds it manage the booking, and notes are where people keep door codes. Calendar apps decide how often to check (Google can take many hours), so it is not live.
  The link is in the address, so it can end up in server and proxy logs.
- Text has length limits (names 60 characters, trip name, destination and activity title 100,
  booking title and provider 100, booking places 200, expense description 100, fuel leg label 90, activity and booking notes and chat messages 2000). The forms stop you at the limit, and the server refuses
  anything longer with a message.

## Before this goes anywhere public

These are known and deliberate for now:

- **One copy of the backend only.** The database is Postgres, but login sessions live in the server's
  memory, so a restart signs everyone out, and the chat socket only reaches people connected to the
  same copy. Running more than one needs sessions in the database or Redis (Spring Session) and a
  shared message bus for chat. The H2 web console is switched off in every profile.
- **The migration has not been run through Hibernate's check here.** It was loaded into a real
  Postgres 16 and matches the entities field by field, but the first start against Postgres is where
  `validate` confirms it. If it refuses, the message names the column.
- **No rate limiting** on sign-in or on invite codes yet, so both can be guessed at.
- **CSRF tokens are off.** The session cookie is SameSite=Lax and every change needs a JSON body,
  which covers a browser. Revisit before serving it from a different site than the frontend.
- **Turn on `server.servlet.session.cookie.secure`** once it is served over HTTPS.
- Every module on the frontend now has a backend side. What is left is rate limiting. Every change the server supports now has a screen, except changing a trip's currency, which has none because the app shows dollars whatever it is set to; see the frontend README.
