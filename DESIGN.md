# Design Guide

How the two front-ends look and behave. Tokens live in `packages/ui/src/styles/globals.css`;
components live in `packages/ui/src/components`. This file is the rulebook for composing them.

## Product context

| App | Who | Job | Tone |
| --- | --- | --- | --- |
| `apps/web` | Travellers (guests, signed-in customers) | Find a hotel for given dates, compare rooms, see the real price, book | Calm, trustworthy, photo-led. Prices and dates are always unambiguous. |
| `apps/web-admin` | Hotel staff and admins | Manage hotels, rooms, rates and bookings | Dense, utilitarian, predictable. Data first, no decoration. |

Principles, in priority order:
1. **Clarity over flourish** — every screen answers "what can I do here, and what will it cost?".
2. **Honest prices** — show currency, per-night vs total, and the number of nights side by side. Never show a
   price that the API did not quote.
3. **Content carries the colour** — the UI chrome is neutral so hotel photography stands out.
4. **Every data view has four states** — loading, error, empty, data (see [States](#states)).

## Tokens

Use Tailwind classes generated from the theme (`bg-background`, `text-muted-foreground`, `border`, `rounded-lg`…).
Never hardcode colours (`#fff`, `text-gray-500`, `bg-[oklch(...)]`) or arbitrary sizes (`w-[312px]`).

### Colour (neutral base, `oklch`)

| Token | Use for |
| --- | --- |
| `background` / `foreground` | Page surface and body text |
| `card` / `card-foreground` | Cards, panels (hotel card, room type card, forms) |
| `popover` / `popover-foreground` | Popovers, calendar, menus |
| `primary` / `primary-foreground` | The one main action per view (Search, Log in, Book) |
| `secondary` / `secondary-foreground` | Secondary buttons, subtle chips |
| `muted` / `muted-foreground` | Supporting text (city, review count, hints, "per night"), skeleton fill |
| `accent` / `accent-foreground` | Hover/selected backgrounds (ghost buttons, calendar range middle) |
| `destructive` | Errors, validation messages, destructive actions |
| `border`, `input`, `ring` | Dividers and card edges; input borders; focus ring |
| `chart-1…5` | Charts in web-admin only |
| `sidebar-*` | web-admin navigation only |

Dark mode: tokens are redefined under `.dark`; components must not need per-mode overrides. Use `dark:`
variants only where shadcn components already do.

### Typography

- Font: Geist Sans (`font-sans`) for everything; Geist Mono (`font-mono`) only for codes/IDs (booking refs).
  Both apps are Thai UI and set `font-sans` in their `globals.css`: web = Anuphan (variable, Thai + Latin),
  web-admin = IBM Plex Sans Thai.
- web theme (ref: Booking.com / Airbnb / Expedia): its `globals.css` sets a deep sea-teal `primary` (search, book, pay,
  rating score badge, hero band) on near-white neutrals, `--radius` 0.75rem. Home + `/hotels` open with a
  `bg-primary` band holding the search card; hotel detail = photo mosaic (md+, ≥5 photos) + content in
  `lg:col-span-2` beside a sticky summary card. Ratings show as a `bg-primary` score + word (`ratingWord`) + count.
  Features not built yet get a `ComingSoon` page (no dead controls); copy is written in Thai, never machine-literal.
- web-admin theme: its `globals.css` redefines the colour tokens (blue primary on slate-tinted neutrals, white
  cards on a tinted page, `--radius` 0.5rem). Same token names — components still use `bg-primary`, `bg-sidebar` etc., never raw colours.
- Scale (Tailwind defaults): page title `text-2xl font-semibold tracking-tight` (hero may use `text-3xl`/`text-4xl`
  on `sm:`+), section title `text-lg font-semibold`, card title via `CardTitle`, body `text-sm`/`text-base`,
  meta `text-sm text-muted-foreground`, fine print `text-xs text-muted-foreground`.
- Prices: `font-semibold tabular-nums`; the unit ("/ night", "total for 3 nights") is `text-muted-foreground`
  and smaller than the amount.

### Spacing, radius, layout

- Spacing on the 4px Tailwind scale: `gap-2` inside controls, `gap-4` between cards and form fields
  (`space-y-4` for stacked fields, `space-y-2` label → input), `gap-6`/`py-8` between page sections.
- Page container: web `mx-auto w-full max-w-6xl px-4` (matches the header/footer; account and booking pages
  narrower: `max-w-3xl`/`max-w-5xl`); web-admin `w-full px-4` (full width beside the sidebar). Narrow forms: `max-w-sm`.
- Radius: shared `--radius` = `0.625rem` (web 0.75rem, web-admin 0.5rem) → `rounded-lg` for cards and images
  (web uses `rounded-xl` for cards, tiles and photos), `rounded-md` for controls (the component defaults).
  Don't mix in `rounded-none`/`rounded-3xl`.
- Grids: results `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`. Mobile first; everything works at 360px wide.
- Images: `next/image`, fixed aspect ratio (`aspect-[4/3]` cards, `aspect-video` gallery main), `object-cover`,
  meaningful `alt` (hotel/room name).

## Components

Use what's in `packages/ui` first; add new shadcn components only with `npm run ui:add -- <name>`.

| Component | Use | Notes |
| --- | --- | --- |
| `Button` | Actions | One `default` (primary) per view; `outline`/`secondary` for the rest; `ghost` in toolbars; `link` inline. Pending state: disable + verb-ing label ("Searching…"). |
| `Input`, `Label` | Form fields | Always a `Label` with `htmlFor`; `aria-invalid` when invalid; error text below as `text-sm text-destructive`. |
| `Card` (+ `CardHeader/Title/Description/Content/Footer`) | Hotel card, room type card, form panels | Whole hotel card is one link; no nested interactive elements inside a link. |
| `Badge` | Rating, "Sold out", status | `outline` for neutral info, `secondary` for status, `destructive` only for problems. |
| `Separator` | Section dividers | Prefer spacing; use sparingly. |
| `Popover` + `Calendar` | Date range picker | `mode="range"`; disable days before Bangkok today and ranges > 30 nights (rules from `@booking/shared`). Trigger is an `outline` button showing "12 Apr – 15 Apr" or "Add dates". |
| `ImageUpload` | Picking image files (click or drop) | `multiple` for galleries (+ `maxFiles` = slots left), single otherwise. It only selects files — upload, previews and errors stay with the caller (web-admin: `features/uploads/hooks.ts` `useUploadImages`). |
| `Timeline` (+ `TimelineItem/Icon/Content/Header/Title/Time/Description`) | web-admin history ("ประวัติการแก้ไข" tab) | One `TimelineItem` per activity, newest first; `TimelineIcon` holds a lucide icon (`variant`: default / primary / secondary / muted / destructive) and is decorative, so the title says what happened. |
| `DataTable` (+ `DataTableSkeleton`) | web-admin lists (hotels, room types, bookings…) | Pass `columns` (`{ id, header, cell(row), className? }`), `rows`, `getRowKey`, a `caption` (screen readers), `busy={isPlaceholderData}`, `empty` (empty-state copy, centered under the header with an icon — default inbox, pass `emptyIcon={<SearchX />}` when filters match nothing; web-admin's `EmptyState` gives message + clear-filters link) and `pagination` (footer slot inside the border — always pass the app's `Pagination` — "แสดง x–y จาก N", rows-per-page select (`PAGE_SIZE_OPTIONS`), ‹ numbered pages › with the current one highlighted: server-paged lists pass `page/totalPages/total/pageSize` from the response + `hrefFor` + `onPageSizeChange` (→ URL `pageSize`, page 1); lists the API returns whole spread `useClientPagination(rows).paginationProps`). List pages (one table per page) also pass `fill`: their `<main>` is `flex flex-col md:h-screen` and the list root `flex min-h-0 flex-1 flex-col`, so on md+ the page doesn't scroll — rows scroll inside the table under a sticky header and pagination stays at the bottom. Tables inside cards don't use `fill`. Loading/error states stay in the feature. Use `Table` directly only for one-off layouts. |
| `Skeleton` | Loading placeholders | Shape matches the final content (image block + 2 text lines for a hotel card). |

Forms: react-hook-form + `zodResolver` with schemas from `@booking/shared`; server field errors via
`applyServerFieldErrors`; a form-level error is a `role="alert"` paragraph above the submit button.

Icons: `lucide-react`, `size-4` inline with text, `aria-hidden` when decorative; icon-only buttons need an
`aria-label`.

## States

Every data view renders exactly one of these, in this order of checks:

| State | Pattern |
| --- | --- |
| Loading (first load) | `Skeleton` layout of the final content. No spinners for page content. |
| Refetching (e.g. next page, new filter) | Keep previous data visible (`placeholderData: keepPreviousData`), dim it (`opacity-60`) and set `aria-busy`. |
| Error | Short plain-language message + `outline` "Try again" button calling `refetch()`. Never show raw error objects. |
| Not found (404) | Heading ("Hotel not found") + one line + link back to search. |
| Empty | What happened + how to fix it: "No hotels match these filters" + "Clear filters" link. |
| Data | The content. |

Mutations: disable the submit button while pending; show success by navigating or updating the view, not
with alerts.

## Accessibility

- Visible focus everywhere (the theme's `ring`; don't remove outlines).
- Keyboard: popover/calendar, gallery thumbnails and pagination are reachable and operable by keyboard.
- Text contrast ≥ 4.5:1 — `muted-foreground` is the lightest allowed text colour on `background`/`card`.
- Landmarks: one `<main>` per page, one `<h1>`; result counts announced politely (`aria-live="polite"`).

## Formatting

- Money: `Intl.NumberFormat("th-TH", { style: "currency", currency })` with the API's `currency` (THB → ฿).
- Dates: wire format is `YYYY-MM-DD` in `Asia/Bangkok`; both apps display Thai months + Buddhist-era year,
  `12 เม.ย. 2570`, ranges `12 – 15 เม.ย. 2570` (each app's `format.ts`); calendars use the `th` locale from
  `@booking/ui/lib/calendar-locales`. Nights are `[checkIn, checkOut)`; always show the night count with a total.
- Ratings: web `4.6 ดีมาก · 128 รีวิว` (score badge + `ratingWord` + `reviewsLabel`); stars (`★`) in review lists.
