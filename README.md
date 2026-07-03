# Vacation Planner

A lightweight team vacation scheduling SPA built with **Angular 20** and hosted on **GitHub Pages**. Team members log in with their username, register vacation days on a shared calendar, and see the full team's schedule in a Gantt-style history view. All data lives in a single Google Spreadsheet — no dedicated backend required.

---

## What's built

| Page | What it does |
|---|---|
| **Home** | Monthly calendar showing your vacations, teammates' absences, public holidays, upcoming releases, and events. Right sidebar shows team stats and today's absentees with emoji avatars. |
| **History** | Gantt timeline of all vacation registrations, grouped by month. Each member's scattered vacation days render as separate bars (one per consecutive run). Filterable by month and member name. The logged-in user's bars are highlighted in purple. Also available in calendar view. |
| **Members** | Team cards (color-coded per team) and a full member table with emoji avatars, team color pills, role, and vacation-used count. Default shows top 10; expand to see all. |
| **Holidays** | List of public holidays loaded from the spreadsheet. |
| **Profile** | Editable profile for the logged-in user. Read-only: ID, Name, Role. Editable: Team, Origin, IP, Public IP, PC Name, MAC Address, BHS Email, Mobile, Birthday, Username. Saved back to the spreadsheet via Apps Script. |

**Auth flow:** Enter your username in the Login dialog. If it matches a row in the Members sheet, you're logged in — no password. Session is persisted in `localStorage` so users stay logged in across page refreshes and return visits.

**Register vacation:** Pick one or more future workdays in the calendar dialog. Deselecting a registered day removes it from the sheet. Submissions are rate-limited to one per 5 minutes per user (enforced client-side via `localStorage`).

**Vacation types:** Each registration carries a type — `Vacation`, `Compensation`, or `Special Leave` (e.g. maternity, bereavement) — stored as a fourth column in the Vacation-Plan sheet and displayed as a colored badge throughout the UI.

**Releases & Events:** Company-wide release dates and events are pulled from the `ReleasePlan` and `EventPlan` named ranges in the `Database` sheet and shown as distinct badges (🚀 green for releases, 📅 blue for events) on the home calendar. Adding a row to either range surfaces it on the calendar automatically — no code changes needed.

**Responsive layout:** Full support for desktop (≥1024px), tablet, and mobile. The sidebar is an off-canvas overlay on small screens with a hamburger toggle; it becomes an inline column on desktop. Calendar and timeline grids use horizontal scroll when viewport is too narrow.

**Daily riddle:** The header shows a random riddle fetched from [API Ninjas](https://api-ninjas.com/api/riddles) on load, styled like a quote. A "Click to Reveal Answer" button underneath reveals the answer in a small animated badge. To avoid burning through the free-tier quota, the fetched riddle is cached in `localStorage` for 30 minutes — reloads and manual refreshes within that window reuse the cached riddle instead of calling the API again. If API Ninjas is unreachable, it falls back to a plain quote from `dummyjson.com/quotes/random` (no reveal button, since fallback quotes have no answer).

---

## Tech stack

- **Angular 20** — standalone components, lazy-loaded routes, `@angular/build:application` (Vite / esbuild)
- **Tailwind CSS v3** — utility classes; dynamic team/type colors bound via `[style.xxx]` Angular bindings (Tailwind's JIT purger can't see runtime-computed class names)
- **RxJS BehaviorSubject** — lightweight in-memory state (no NgRx); single `DataService` owns all streams
- **Google Sheets API v4** — read-only data source for members, holidays, vacation records, releases, and events
- **Google Apps Script** — write proxy for vacation submissions and profile updates (Sheets API requires OAuth for writes; Apps Script runs under the sheet owner's account)
- **API Ninjas Riddles API** — header's daily riddle, with a `dummyjson.com` quote fallback on failure
- **GitHub Actions + GitHub Pages** — CI/CD; pushes to `main` trigger a production build deployed to the `github-page` branch

---

## Data model

All data lives in **one Google Spreadsheet** with three sheets:

### `Team-Info` — columns A through M

Thirteen columns, in order:

| A: ID | B: Origin | C: Team | D: Role | E: Display Name | F: Username | G: IP | H: Public IP | I: PC Name | J: MAC Address | K: BHS Email | L: Mobile | M: Birthday |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | BHS | Engineering | Senior Dev | John Smith | john | 192.168.1.10 | 203.0.113.1 | BHS-PC-001 | AA:BB:CC:DD:EE:FF | john@bhs.com | +84 90 000 0000 | 15/06 |

> **Column C is Team (department), column D is Role (position).** In code, `member.department` maps to column C and `member.position` maps to column D.

Private fields (B, G–M) are only shown to the authenticated owner on the `/profile` page. They are parsed into `Member` objects but never rendered in any other view.

**Birthday format:** `DD/MM` — day and month only, no year. The sidebar uses this to compute each member's next birthday and shows a 🎂 card in Upcoming when it's within 30 days.

### `Database` — named range `Holidays`

| Date | Name | Country |
|---|---|---|
| 01/01/2026 | New Year's Day | Vietnam |

Date format is flexible — the parser handles `M/D/YYYY`, `DD/MM/YYYY`, ISO `YYYY-MM-DD`, and Google Sheets serial numbers. The `Country` field is used to filter VN-only holidays in the sidebar.

### `Database` — named range `ReleasePlan` (columns G–H)

| ReleaseDate | Release |
|---|---|
| 2026-07-15 | v2.4.0 |

### `Database` — named range `EventPlan` (columns I–J)

| EventDate | EventDesc |
|---|---|
| 2026-07-20 | Team building day |

Both ranges use the same flexible date parsing as `Holidays`. New rows appear on the home calendar automatically on next load.

### `Vacation-Plan`

| Month | Username | Date | Type |
|---|---|---|---|
| 06/2026 | john | 2026-06-15 | Vacation |

One row per person per day. Month is `MM/YYYY` for grouping. Date is `YYYY-MM-DD`. Type is one of `Vacation`, `Compensation`, `Special Leave` (defaults to `Vacation` if missing or unrecognised). Rows with `Type = Deleted` are filtered out at parse time (soft-delete). This sheet is managed exclusively by the Apps Script.

---

## Registration lock period

To prevent last-minute changes, registration is locked by the 20th of each month:

- **Before the 20th of month M** — users can register from month M+1 onward
- **On or after the 20th of month M** — users can only register from month M+2 onward

The earliest registerable month is computed by `getEarliestAllowedMonth()` in the dialog and calendar components:

```typescript
getEarliestAllowedMonth(): { year: number; month: number } {
  const today = new Date();
  let month = today.getMonth() + 1 + (today.getDate() >= 20 ? 2 : 1);
  let year = today.getFullYear();
  if (month > 12) { month -= 12; year++; }
  return { year, month };
}
```

The register dialog enforces this by:
- Opening at the earliest allowed month (not today's month)
- Blocking backward navigation before that month
- Showing an amber banner when viewing a locked month
- Guarding `toggleDay()` and `onSubmit()` against locked months

---

## Team color system

Each team is assigned a deterministic color derived from its name using a djb2-style hash:

```typescript
const teamColorOf = (name: string): TeamColor => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return TEAM_COLORS[Math.abs(h) % TEAM_COLORS.length];
};
```

The palette has 10 entries (blue, green, orange, purple, rose, cyan, amber, sky, lime, red). A `FALLBACK_COLOR` (slate) covers members without a team. Colors are applied via `[style.background-color]` / `[style.border-color]` bindings rather than computed Tailwind class names, which would be stripped by the purger.

The header shows two colored chips next to the logged-in user's name — one for their team (seed `0`) and one for their role (seed `5381`). Different seeds prevent same-string collisions (e.g. a team and role with the same text get different colors).

---

## Animal emoji avatars

Every member gets a deterministic animal emoji as their avatar, derived from their username with the same hash pattern:

```typescript
const animalEmoji = (username: string): string => {
  let h = 0;
  for (let i = 0; i < username.length; i++)
    h = (Math.imul(31, h) + username.charCodeAt(i)) | 0;
  return ANIMAL_EMOJIS[Math.abs(h) % ANIMAL_EMOJIS.length];
};
```

The pool has 30 animals. The emoji is stored in `member.avatarUrl` and rendered inside a `bg-gray-100` rounded circle wherever members appear (sidebar user chip, team card stacks, member table, History Gantt list, Home absentee row, calendar strips).

---

## Sidebar

The sidebar is a self-contained `SidebarComponent` that injects `DataService` directly (no `@Input()` props). It subscribes to four streams:

- **authenticatedUser$** — user chip at the bottom (emoji + display name + role)
- **vacations$ + authenticatedUser$** via `combineLatest` — **Upcoming** section: the logged-in user's future vacation days, tinted by type (purple = Vacation, cyan = Compensation, orange = Event)
- **holidays$** — **Upcoming** section: up to the next 8 combined items including VN public holidays filtered by `country.includes('viet') || country === 'vn'`
- **members$** — **Upcoming** section: all members' birthdays within the next 30 days

All three item types are merged and sorted by date. Up to 8 items are shown; a "+N more" count appears if there are more. Holiday cards are urgency-tinted (red-100/red-600 for today/tomorrow, red-50/red-400 for future). Birthday cards use amber tinting with a 🎂 emoji.

Nav tiles filter based on auth state — guests see only Home and Holidays. History and Members require login (they also redirect to `/home` if a guest navigates to them directly).

---

## Apps Script (vacation writes and profile updates)

`apps-script/Code.gs` routes two operations via `doPost`, distinguished by an `action` field in the JSON body:

**Profile update (`action: "updateProfile"`):**
```json
{ "action": "updateProfile", "id": "1", "authUsername": "john", "updates": { "mobile": "+84 90 111 2222" } }
```
Finds the row where column A = `id` AND column F = `authUsername`. Updates any of: B (Origin), C (Team), F (Username), G (IP), H (Public IP), I (PC Name), J (MAC Address), K (BHS Email), L (Mobile), M (Birthday). Uses `tryLock(10000)` to prevent concurrent writes.

**Vacation changes (default, `action` absent or `"vacation"`):**
```json
{ "username": "john", "month": "07/2026", "type": "Vacation", "addDates": ["2026-07-15"], "removeDates": ["2026-07-10"] }
```
Validates `type` against `['Vacation', 'Compensation', 'Special Leave']`, defaults to `'Vacation'`. `removeDates` are processed first — matching rows (by `username` + `date`) have their Type column set to `Deleted` (soft-delete). `addDates` are then appended as one new row each (`[month, username, date, type]`), deduplicated against every non-`Deleted` row already in the sheet for that `username + date` — so a previously deleted date can be freely re-added.

The request body is sent as `Content-Type: text/plain` to keep the request "simple" (no CORS preflight). Apps Script follows a 302 redirect before responding; a preflight would not survive that redirect.

---

## Local development

### Prerequisites
- Node.js 22+
- Angular CLI (`npm install -g @angular/cli`)

### 1 — Clone and install

```bash
git clone <your-repo-url>
cd vacation-planner
npm install
```

### 2 — Create `.env.local`

```bash
cp .env.example .env.local
```

```
GOOGLE_API_KEY=AIzaSy...
GOOGLE_SHEET_ID=1jTy6D...
VACATION_API_URL=https://script.google.com/macros/s/.../exec
API_NINJAS_KEY=your_api_ninjas_key_here
```

### 3 — Run

```bash
npm start
```

`scripts/setup-env.js` reads `.env.local` and writes `src/environments/environment.ts` and `environment.development.ts`. Both are gitignored — never commit them.

---

## Google Cloud setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services → Library**
2. Enable **Google Sheets API**
3. **Credentials → Create credentials → API key**
4. Restrict the key to the Sheets API and your GitHub Pages domain
5. In the spreadsheet: **Share → Anyone with the link → Viewer**

---

## Apps Script setup

1. Open the spreadsheet → **Extensions → Apps Script**
2. Paste `apps-script/Code.gs` (replace all existing code)
3. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the URL → paste into `.env.local` as `VACATION_API_URL`

> Every code change requires a new deployment version (Deploy → Manage deployments → New version). The URL stays the same.

---

## GitHub Pages deployment

The workflow (`.github/workflows/deploy.yml`) fires on every push to `main`:

1. Installs dependencies
2. Generates environment files from GitHub Actions secrets
3. Builds with `--configuration=production-ci` (output to `docs/`)
4. Copies `docs/index.html` → `docs/404.html` for SPA deep-link support
5. Force-pushes `docs/` to the `github-page` branch

### Secrets (Settings → Secrets and variables → Actions)

| Secret | Value |
|---|---|
| `GOOGLE_API_KEY` | Google API key |
| `GOOGLE_SHEET_ID` | Spreadsheet ID |
| `VACATION_API_URL` | Apps Script Web App URL |
| `API_NINJAS_KEY` | API Ninjas key (daily riddle widget) |

### Pages (Settings → Pages)
- Source: **Deploy from a branch**
- Branch: `github-page` / `docs`

If you use a custom domain or a user/org page at `/`, add a repository variable `BASE_HREF=/`.

---

## Project structure

```
src/
  app/
    app.ts                                    # Root: header, sidebar, router outlet, auth state, hamburger, daily riddle
    app.routes.ts                             # Lazy-loaded routes: /, /history, /members, /holidays, /profile
    app.config.ts                             # provideRouter, provideHttpClient, provideAnimationsAsync
    core/
      models/models.ts                        # Member (13 fields), Holiday, Vacation, CalendarDay
      services/
        api.service.ts                        # Sheets API reads + Apps Script writes; animal emoji hash
        data.service.ts                       # BehaviorSubject state, localStorage auth, submitVacation(), updateMemberProfile()
    features/
      home/
        home.component.ts                     # Calendar layout + stats panel + absentees
        calendar.component.ts                 # Monthly grid; opens at earliest registerable month; expand/collapse overflow
      history/
        history.component.ts                  # Gantt timeline (bars per consecutive run) + calendar view; export placeholder
      members/
        members.component.ts                  # Team cards (color-coded) + member table + vacation counts
      holidays/
        holidays.component.ts                 # Holiday list
      profile/
        profile.component.ts                  # Editable profile for logged-in user; saves via Apps Script updateProfile
    shared/
      components/
        login-dialog.component.ts             # Username login with loading state
        register-vacation-dialog.component.ts # Date picker with lock period + diff tracking
        sidebar.component.ts                  # Nav + Upcoming (vacations, VN holidays, birthdays) + user chip

  environments/                               # .gitignored — generated by scripts/setup-env.js

scripts/
  setup-env.js                                # Reads .env.local → writes environment files

apps-script/
  Code.gs                                     # Apps Script: doPost action routing (vacation + updateProfile)
```

---

## Key design decisions

**Why `[style.xxx]` bindings for dynamic colors?**  
Tailwind's JIT purger scans source files for class name strings at build time. Dynamically computed class names (e.g. `bg-${color}-500`) are never seen and get stripped. Angular's `[style.background-color]` binding bypasses the purger entirely and sets inline styles at runtime.

**Why no NgRx / signals?**  
The app is small and all state flows from a single service. `BehaviorSubject` streams keep the dependency footprint minimal. Migrating to Angular signals is a natural next step if the app grows.

**Why Apps Script for writes?**  
The Sheets API v4 requires OAuth2 for writes, which needs a backend to safely hold the client secret. Apps Script is the zero-backend alternative — it executes server-side under the sheet owner's account.

**Why `Content-Type: text/plain` for Apps Script POST?**  
A `text/plain` body keeps the request "simple" (no CORS preflight), so the browser follows Apps Script's 302 redirect transparently. `application/json` would trigger a preflight that the redirect can't survive.

**Why hash-based team colors and emoji avatars?**  
Both are derived deterministically from a string (team name or username) so they are stable across sessions and builds without needing any extra data column in the spreadsheet. Same input always produces the same output.

**Why `lg:translate-x-0` as a static class for the sidebar?**  
Tailwind places responsive variants after base utilities in the generated stylesheet. Because CSS specificity is equal, the later rule wins — so `lg:translate-x-0` always overrides the Angular-bound `-translate-x-full` on large screens without any JS involvement.

**Why `outputPath.browser: ""`?**  
`@angular/build:application` nests output under `docs/browser/` by default, breaking GitHub Pages routing. Setting `browser: ""` flattens everything into `docs/`.

**Why private fields are UI-only access-controlled?**  
The app uses a read-only Google Sheets API key (client-side). All 13 columns are technically accessible to anyone who knows the key. The privacy is enforced purely in the UI — private fields are never rendered outside `/profile`, which checks `authenticatedUser$`.

---

## Known limitations & future work

| Area | Status |
|---|---|
| **Vacation day counts** | `daysUsed` / `daysLeft` come from the Members sheet and are updated optimistically on the client. Must be updated manually in the sheet for long-term accuracy. |
| **Authentication** | Username-only login — no password or session token. Suitable for an internal tool; not for public exposure. |
| **Lock period is client-side** | The 20th-of-month cutoff is enforced in the browser. The Apps Script does not validate dates, so a user could submit via direct HTTP. |
| **Rate limiting** | The 5-minute submission lock is `localStorage`-only. A user can bypass it by clearing storage or using a private tab. |
| **Offline / caching** | No service worker. The app requires a live Google Sheets connection on load. |
| **Write confirmation** | Local state is updated optimistically after submission. A hard page refresh shows the authoritative server state. |
| **History export** | The Export button per month header is a placeholder — image generation is not yet implemented. |
| **Private field security** | Column G–M data (IP, MAC, birthday, etc.) is readable by anyone with the API key. The UI restricts display to the owner, but this is not enforced server-side. |
