# UI Contract: Track Your Abduction

**Feature**: `001-order-tracking`. All copy follows the Planet Pizza voice
(Constitution V). The copy below is the baseline, and the wording can be polished
during implementation as long as the meaning and differences between messages
stay the same.

## Routes

| Path | Component | Behavior |
|---|---|---|
| `/track` | `TrackingPage` | Empty form (Story 1, scenario 1). |
| `/track/:orderId` | `TrackingPage` | If an unexpired access token exists for `orderId` in this browser, auto-lookup and show the result with no form submit (FR-010). Otherwise show the form with the order number pre-filled and the email empty. |
| `/order/:id` | `OrderConfirmationPage` | With a valid token, show full details plus a **"Track your abduction"** link to `/track/:id`. Without one, show `TrackingLookup` with the number pre-filled (FR-013). |

Navigation: `Layout` adds `<NavLink to="/track">Track Your Abduction</NavLink>`
between **Merch** and **Cart** (FR-001).

## Components

- `TrackingLookup` (`components/TrackingLookup.tsx`)
  - Props: `initialOrderNumber?: string`, `accessToken?: string`, `orderId?: number`.
  - Fields: **Order number** (`input`, text, `inputMode="numeric"`) and
    **Email transmission** (`input`, `type="email"`). Submit button uses
    `btn-primary`.
  - Client-side validation mirrors the server rules (research R5). Invalid input
    shows a field prompt and sends **no** request.
  - A new submit replaces the previous outcome (Story 1, scenario 5).
  - Renders the result as `TrackingTimeline` followed by the item list and total,
    inside a `card`.
- `TrackingTimeline` (`components/TrackingTimeline.tsx`)
  - Props: `stage: TrackingStage`.
  - Shows the 4 stages in fixed order, each marked `done` / `current` /
    `upcoming` with distinct styling (e.g. `alien-600` check for done,
    pulsing `cosmic-500` for current, `slate-400` for upcoming). The status is
    also given as text (`aria-current="step"` on current, plus a visually
    available "done"/"upcoming" label), so it doesn't rely on color alone.
- Items list: `name_snapshot × quantity` with `formatPrice(line_total_cents)`, and
  the total via `formatPrice(total_cents)`. Customer name and address are not shown.

## Copy (baseline)

| Key | Text |
|---|---|
| page eyebrow | `Classified tracking terminal` |
| page heading | `Track Your Abduction 🛸` |
| intro | `Enter your order number and the transmission you used at checkout, earthling. The mothership will check its logs.` |
| label: number | `Order number` (placeholder `#42`) |
| label: email | `Email transmission` |
| submit | `Scan the skies` / while loading `Scanning…` |
| `invalidNumber` | `That order number looks scrambled. Use the digits from your confirmation, like #42.` |
| `invalidEmail` | `That transmission address won't reach orbit. Double-check your email.` |
| `required` | `The mothership needs this field filled in.` |
| `noMatch` | `The mothership couldn't find a matching abduction. Double-check your order number and transmission, then try again. 👽` |
| `cooldown` | `Whoa, earthling. The mothership needs a moment to cool its scanners. Try again in a minute.` |
| `signalLost` | `Signal lost somewhere over Nevada. Try again in a moment. 📡` |
| result eyebrow | `Order #{id}. Status decrypted.` |
| items heading | `Itemized cargo manifest` |
| total label | `Total charged` |
| confirmation link | `Track your abduction →` |
| confirmation (no token) eyebrow | `Restricted file` |
| confirmation (no token) intro | `This confirmation is classified. Enter the order number and transmission to see where it stands.` |

`noMatch` is used for **every** 404 and MUST be byte-identical regardless of cause
(FR-007). `signalLost` MUST differ from `noMatch`.
