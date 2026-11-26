# Feature Specification: Track Your Abduction (Order Tracking)

**Feature Branch**: `001-order-tracking`  
**Created**: 2026-11-26  
**Status**: Draft  
**Input**: User description: "Add a 'Track Your Abduction' page so earthlings can check the status of an order they already placed, without logging in. From the main navigation, an earthling opens the tracking page and enters their order number and the email ('transmission') they used at checkout. If both match an order, they see its current status on a timeline (Confirmed by the mothership → Hand-tossed in Hangar 18 → In the tractor beam → Abducted to your drop coordinates), plus the items in the order and the total. If the number and email don't match, show a friendly in-character message and never reveal whether an order number exists. The order confirmation page links straight to tracking for that order. Out of scope: accounts, notifications, cancelling or changing orders."

## Clarifications

### Session 2026-11-26

- Q: How do orders move through the four stages, given there's no admin UI? → A: They don't yet. All orders stay at "Confirmed by the mothership". Progression is a later feature, and the timeline is built to show any stage.
- Q: Should this feature close the existing gap where any order's details can be viewed by number alone? → A: Yes. Number-only lookups stop returning details. The confirmation page shows full details only to the browser that just placed the order, and anyone else must enter number + email.
- Q: What happens when "Track your abduction" is clicked on the confirmation page? → A: The tracking result appears straight away, with no pre-filled form and no submit step.
- Q: How long does the browser that placed the order keep access without entering the email? → A: 24 hours after checkout, in the same browser. After that, number + email is required.
- Q: How strict is the lookup limit? → A: 10 lookups per minute per source, then a 1-minute cooldown.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Look up an order by number and transmission (Priority: P1)

An earthling who placed an order wants to know where their pizza is. They open "Track Your Abduction" from the main navigation, enter their order number and the email ("transmission") they used at checkout, and submit. If both match, they see a four-stage timeline showing the order's current stage, the items in the order (name, quantity, line amount), and the order total.

**Why this priority**: This is the whole point of the feature. It answers "where's my pizza?" without contacting support.

**Independent Test**: Place an order, open the tracking page from the navigation, enter that order's number and email, and confirm the correct stage, items, and total are shown.

**Acceptance Scenarios**:

1. **Given** an earthling on any page of the shop, **When** they choose "Track Your Abduction" in the main navigation, **Then** the tracking page opens with an empty order number field and an empty transmission field.
2. **Given** an order exists with number N and email E, **When** the earthling enters N and E and submits, **Then** they see a timeline with the four stages in order — "Confirmed by the mothership", "Hand-tossed in Hangar 18", "In the tractor beam", "Abducted to your drop coordinates" — with the order's current stage highlighted, earlier stages shown as done, and later stages shown as upcoming.
3. **Given** a matching lookup, **When** the result is shown, **Then** the earthling also sees every item in the order with its name, quantity, and line amount, and the order total, all matching what was charged at checkout.
4. **Given** an order placed with email `Earthling@Example.com`, **When** the earthling enters `earthling@example.com ` (different case, extra spaces), **Then** the order is found.
5. **Given** a matching result is shown, **When** the earthling enters a different number and email and submits again, **Then** the previous result is replaced by the new outcome.

---

### User Story 2 - Friendly, non-revealing message on no match (Priority: P1)

An earthling mistypes their order number or email. They get a playful, in-character message telling them the mothership couldn't find a matching abduction and to double-check both fields. The message is identical whether the order number doesn't exist or exists with a different email, so nobody can find out which order numbers are real.

**Why this priority**: Without it, the tracking page would leak other customers' order details or let someone probe which order numbers exist. This is a privacy guarantee, not polish, so it ships with Story 1.

**Independent Test**: Submit (a) a real order number with the wrong email, (b) a non-existent order number with any email, and (c) a real email with the wrong number. All three must show exactly the same message and reveal no order details.

**Acceptance Scenarios**:

1. **Given** order N exists with email E, **When** the earthling submits N with a different email, **Then** they see the in-character "no match" message and no order details.
2. **Given** no order N exists, **When** the earthling submits N with any email, **Then** they see the exact same "no match" message as in scenario 1.
3. **Given** either no-match case above, **When** the response is compared, **Then** the message text, page layout, and response time are the same, so there is no observable difference that reveals whether N exists.
4. **Given** the earthling leaves a field empty, enters a non-numeric order number, or enters a value that isn't a valid email, **When** they submit, **Then** they see an in-character prompt to fix that field, and no lookup is attempted.

---

### User Story 3 - Jump to tracking from the order confirmation page (Priority: P2)

Right after checkout, the order confirmation page shows a "Track your abduction" link. Following it opens the tracking page for that order without the earthling retyping anything.

**Why this priority**: This is a convenience. It points customers to tracking at the moment they're most likely to want it, but Stories 1–2 work without it.

**Independent Test**: Complete a checkout, select the tracking link on the confirmation page, and confirm the tracking page shows that order's status, items, and total with no extra typing.

**Acceptance Scenarios**:

1. **Given** an earthling on the confirmation page for order N they just placed, **When** they select "Track your abduction", **Then** the tracking page opens with order N's timeline, items, and total already shown, with no further input or submit needed.
2. **Given** the tracking link is shared or bookmarked, **When** someone opens it, **Then** it does not show order details unless the matching email is supplied as well. The email MUST NOT be exposed in the link's address.
3. **Given** someone who did not place order N opens order N's confirmation page address directly, **When** the page loads, **Then** no order details (items, total, name, address) are shown. They are asked for the order number + email instead, with the same non-revealing behavior as Story 2.

---

### Edge Cases

- Order number with leading zeros, spaces, or a `#` prefix (e.g., `#0042`): treat it as order 42.
- Very large or negative order numbers, decimals, or letters: rejected as invalid input with the in-character "fix this field" prompt. They are never treated as "not found".
- Email entered in a different case or with surrounding whitespace: still matches (see Story 1, scenario 4).
- Repeated rapid guesses from the same earthling: more than 10 lookups in a minute triggers a 1-minute cooldown (FR-009), so order numbers and emails can't be brute-forced. During the cooldown, the earthling sees an in-character "the mothership needs a moment" message.
- An order whose items were later renamed or repriced in the catalog: tracking shows the names and prices as they were at checkout, not the current catalog.
- The tracking service is unreachable: the earthling sees an in-character "signal lost, try again" message that is different from the "no match" message, with no order details.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The main navigation MUST include a "Track Your Abduction" entry that opens the tracking page from any page of the shop.
- **FR-002**: The tracking page MUST ask for exactly two inputs: order number and email ("transmission"). No account, password, or login is involved.
- **FR-003**: The system MUST show order details only when the order number AND the email both match the same order. Email matching MUST ignore letter case and leading/trailing whitespace.
- **FR-004**: On a match, the system MUST show a four-stage timeline in this fixed order: (1) Confirmed by the mothership, (2) Hand-tossed in Hangar 18, (3) In the tractor beam, (4) Abducted to your drop coordinates. It MUST clearly mark which stages are done, which one is current, and which are upcoming.
- **FR-005**: On a match, the system MUST show each order item's name, quantity, and line amount, plus the order total, exactly as recorded at checkout.
- **FR-006**: The tracking result MUST NOT show the customer's name, street address, or any other personal details beyond what the earthling already entered. Only the stage, items, and total are shown.
- **FR-007**: When the number and email don't match an order, for any reason, the system MUST show one single in-character "no match" message. That message, the page state, and the response MUST NOT differ between "order number doesn't exist" and "order exists but the email is wrong".
- **FR-008**: The system MUST validate inputs before lookup. Order number must be a positive whole number (a leading `#`, spaces, and leading zeros are tolerated). Email must be in a valid email format. Invalid input gets an in-character, field-specific prompt.
- **FR-009**: The system MUST allow at most 10 tracking lookups per minute from the same source. Lookups over the limit MUST be refused for a 1-minute cooldown, with an in-character "the mothership needs a moment" message. Refused lookups MUST NOT reveal whether an order exists.
- **FR-010**: The order confirmation page MUST include a "Track your abduction" link. Following it from the browser that placed the order MUST show that order's tracking result straight away, with no typing or submit (see Story 3). The earthling's email MUST NOT appear in the link address.
- **FR-011**: Each order MUST have a current tracking stage, which is one of the four stages in FR-004. New orders MUST start at stage 1, "Confirmed by the mothership".
- **FR-012**: In this release, nothing advances an order's stage. Every order stays at stage 1, "Confirmed by the mothership". The timeline MUST still show all four stages (stage 1 current, stages 2–4 upcoming) and MUST render any of the four stages correctly, so a future feature can advance orders without changing the tracking page.
- **FR-013**: The shop MUST NOT offer any customer-facing way to get an order's details, or learn whether it exists, from the order number alone. This closes the existing gap where any order (including name and address) can be viewed by guessing its sequential number. The confirmation page MUST keep showing full order details to the browser that placed the order, for 24 hours after checkout. Anyone else opening a confirmation page address MUST be asked for the order number + email, and gets the same non-revealing behavior as FR-007.
- **FR-014**: All user-facing copy on the tracking page and messages MUST follow the Planet Pizza voice (playful, conspiratorial, deadpan; uses "earthling", "transmission", "drop coordinates", "mothership").
- **FR-015**: The feature MUST NOT add accounts, notifications (email/SMS/push), or the ability to cancel or change orders.

### Key Entities

- **Order**: An order already placed at checkout. Relevant attributes: order number (shown to the customer), the email given at checkout, items, total, and a **tracking stage** (new).
- **Tracking Stage**: One of four ordered values: Confirmed by the mothership → Hand-tossed in Hangar 18 → In the tractor beam → Abducted to your drop coordinates. An order is at exactly one stage at a time. The stage only moves forward.
- **Order Item**: A product line in an order, with the name, quantity, and unit price captured at checkout.
- **Tracking Lookup**: A customer request made of an order number and an email. It produces either the order's tracking view or a "no match" outcome. It has no stored state of its own.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An earthling with their order number and email can reach the tracking page from any page and see their order's status in under 30 seconds and no more than 3 interactions (open, fill both fields, submit).
- **SC-002**: 100% of lookups with a correct number and email show the correct current stage, items, and total. 0% of lookups with a mismatched pair show any order detail.
- **SC-003**: For a mismatched pair, an observer can't tell from the message, page, or timing whether the order number exists. This is verified by comparing responses for a non-existent number and for a real number with the wrong email.
- **SC-004**: From the confirmation page, an earthling reaches their order's tracking view in 1 click with no retyping.
- **SC-005**: "Where's my order?" support emails drop by at least 50% within 4 weeks of launch compared with the 4 weeks before.

## Assumptions

- "Order number" is the number already shown to customers on the confirmation page (e.g., `Order #42`). No new reference code is introduced.
- The email used for matching is the one entered at checkout. There's no way to change it after ordering.
- Tracking is read-only for customers. They can't change the stage, cancel, or edit anything (per the stated out-of-scope list).
- The lookup limit (10 per minute, then a 1-minute cooldown) is loose enough that legitimate customers fixing a typo won't hit it.
- Tracking shows no estimated delivery times. Only the current stage is shown.
- Existing orders created before this feature are treated as being at stage 1, "Confirmed by the mothership". The plan must note that the local database may need resetting if the order data changes.
- Stage progression (automatic or by staff) is deliberately deferred to a later feature (decision Q1 = C). Until then, every tracked order shows "Confirmed by the mothership". This partly limits SC-005, because customers will see the order is confirmed but not see it move.
- "The browser that just placed the order" (FR-013) means the same browser within 24 hours of checkout. After 24 hours, or if that browser's data is cleared, the earthling uses number + email like everyone else.
- The pre-fill/auto-lookup from the confirmation page relies on the earthling's own browser session right after checkout. It does not put the email in a shareable link.
