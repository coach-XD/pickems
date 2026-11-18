# Singapore Major Pick'em

Private Swiss-stage prediction pool for the PGL Singapore 2026 CS2 Major. Built for about eight friends: one invite link, a display name, and a PIN. No email or passwords for players.

Stage 1 (24–27 Nov 2026) is seeded with the 16 teams and the eight Round 1 best-of-ones. Stage 2 (28 Nov–1 Dec) and Stage 3 (about 2–5 Dec) can be added from the admin desk. Playoffs are not in this version.

## Stack

- Next.js (App Router) and TypeScript
- Postgres, intended for [Neon](https://neon.tech) via the Vercel Marketplace
- Drizzle ORM, SQL migrations in `drizzle/`

## Environment variables

Copy `.env.example` to `.env` for local work. On Vercel, set the same names in Project → Settings → Environment Variables (Neon injects the database URLs when you connect it).

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled Postgres URL. The app also accepts `POSTGRES_URL` if that is what the integration provides. |
| `DATABASE_URL_UNPOOLED` | For migrations | Direct Neon URL. `npm run db:migrate` uses this first, then `DATABASE_URL`, then `POSTGRES_URL_NON_POOLING`, then `POSTGRES_URL`. |
| `ADMIN_PASSWORD` | Yes | Unlocks `/admin`. |
| `INVITE_TOKEN` | Yes | Secret in the invite URL `/join/<INVITE_TOKEN>`. Use a long URL-safe token (letters, numbers, hyphen). Rotating it signs everyone out; they come back with the same name and PIN. |

Player cookies are signed with `INVITE_TOKEN`. The admin cookie is signed with `ADMIN_PASSWORD`.

## Local setup

```bash
npm install
cp .env.example .env
# fill in DATABASE_URL, ADMIN_PASSWORD, and INVITE_TOKEN

npm run db:migrate
npm run db:seed
npm run dev
```

`db:migrate` applies `drizzle/`. `db:seed` inserts Stage 1 once. Running it again does nothing if that stage already exists, so it will not overwrite results or seed edits.

Optional sample data (a finished Swiss, eight fake players, full picks). It is hidden on the board until someone taps **Show sample**. Do not run this against the production database unless you want that fixture there.

```bash
npm run db:seed:demo
```

Sample players are Nova, Pixel, Rook, Ivy, Blitz, Echo, Jett, and Kite. Every sample PIN is `2468`.

## Deploy on Vercel

1. Merge this repo to `main` (or deploy the branch).
2. In Vercel, **Add New → Project** and import the GitHub repo. Framework preset: Next.js. Build command stays `next build`. Do not point the build command at the database.
3. Open the project → **Storage** or **Marketplace** → **Neon** → create a database and connect it to this project. That sets `DATABASE_URL`. If Neon also shows a direct/unpooled URL, put it in `DATABASE_URL_UNPOOLED`.
4. Add `ADMIN_PASSWORD` and `INVITE_TOKEN` for Production (and Preview, if you want those to work).
5. Deploy.
6. From your laptop, with the production URLs in `.env`:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   ```

7. Open `https://<your-app>.vercel.app/join/<INVITE_TOKEN>` and send that link to the group.
8. Open `https://<your-app>.vercel.app/admin` and sign in with `ADMIN_PASSWORD`. The admin home page also shows the invite link for the current host.

If the Neon integration used different variable names, copy the pooled URL into `DATABASE_URL` and the direct URL into `DATABASE_URL_UNPOOLED`. Migrations should use the direct URL. The running app should use the pooled URL.

Adding a later stage does not need a new deploy: create it in `/admin`, add the 16 teams (existing names are reused), then add Round 1 or use **Suggested round** after results exist.

## How Stage 1 seeds were assigned

The cards in the source screenshot show two ranks. The **left badge is stored as world rank** (shown on the board). The **orange badge is stored as the other rank**.

Seeds are **not** a sort of that world rank. Round 1 is Valve's opening pattern, 1 vs 9 through 8 vs 16, which is also the published 2 Nov 2026 VRS seed list. That pairing matches the eight series in the bracket screenshot:

| Seed | Team | World (left) | Other (orange) | Round 1 opponent |
| --- | --- | --- | --- | --- |
| 1 | Ninjas in Pyjamas | 18 | 18 | M80 |
| 2 | PARIVISION | 13 | 14 | DENDELE |
| 3 | HEROIC | 23 | 20 | Imperial |
| 4 | FaZe | 19 | 23 | Wildcard |
| 5 | Liquid | 16 | 15 | BC.Game |
| 6 | Eternal Fire | 22 | 24 | FlyQuest |
| 7 | 100 Thieves | 29 | 17 | Chinggis Warriors |
| 8 | 9z | 21 | 29 | Lynn Vision |
| 9 | M80 | 24 | 27 | Ninjas in Pyjamas |
| 10 | DENDELE | 33 | 28 | PARIVISION |
| 11 | Imperial | 48 | 34 | HEROIC |
| 12 | Wildcard | 42 | 39 | FaZe |
| 13 | BC.Game | 46 | 46 | Liquid |
| 14 | FlyQuest | 58 | 43 | Eternal Fire |
| 15 | Chinggis Warriors | 59 | 53 | 100 Thieves |
| 16 | Lynn Vision | 44 | 57 | 9z |

Round 1 is best of one. Times are the published slate, stored in UTC and editable:

- 24 Nov 2026 04:00 UTC — HEROIC vs Imperial, 9z vs Lynn Vision
- 05:00 UTC — Ninjas in Pyjamas vs M80, 100 Thieves vs Chinggis Warriors
- 06:00 UTC — Liquid vs BC.Game, PARIVISION vs DENDELE
- 07:00 UTC — FaZe vs Wildcard, Eternal Fire vs FlyQuest

Change a seed, rank, or logo from **Admin → Stage 1 → Teams** and save. Swapping two seeds in one save is safe. Logos are optional https URLs; otherwise the board uses an initials badge. Team logos are not hotlinked.

## Rules implemented

16 teams. Three wins advance, three losses are out: two 3-0s, three 3-1s, three 3-2s, and the mirror on the way out.

- The bracket derives two 3-0 teams (5 pts each), two 0-3 teams (5 pts each), and six other advancers (2 pts each).
- A 3-0 team that actually advances 3-1 or 3-2 scores 0 in that slot. An 0-3 team that goes out 1-3 or 2-3 scores 0.
- 1 point for the correct match winner, only when that matchup is the one the admin enters. A predicted series that never happens scores 0. Bo3 adds 1 point for the exact map score when the winner is also correct.
- The whole bracket locks one hour before the first Round 1 match. Times are stored in UTC and shown in the viewer's timezone.
- Each stage has its own board. Overall adds the real stages and leaves the sample stage out.
- Equal totals share a rank. Two players on the same score are both 1, and the next player is 3. There is no placement tiebreak.

Picks are made on a Swiss bracket simulator. Clicking winners generates the next round with Valve's pairing rules. The 3-0, 0-3, and advance slots are read from that bracket. A match scores only when the predicted teams are the teams the admin actually schedules. The whole bracket locks one hour before the first Round 1 match.

Records and the advanced/eliminated pools are derived from results. Later rounds are not pre-seeded. Admin can add them by hand or confirm a suggested pairing from the same Valve engine. Series that can advance or eliminate a team default to Bo3; the others default to Bo1.

## Scripts

```bash
npm run dev
npm run build
npm test                 # scoring, tiebreak, Swiss records
npm run db:generate      # write a new migration after a schema change
npm run db:migrate
npm run db:seed
npm run db:seed:demo
```
