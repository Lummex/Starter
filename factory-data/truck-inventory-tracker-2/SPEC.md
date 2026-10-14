# Chas Roberts Truck Inventory — Build Spec

## Summary

**Chas Roberts Truck Inventory** is a phone-friendly web app for plumbing and air-conditioning service techs to keep track of the parts on their truck. Parts can be added by typing, by talking (where the browser supports voice), or by taking a photo and tapping each part to count it. It understands the different ways techs name parts — "half inch" means `1/2"`, "ninety" means 90, word order doesn't matter, and each part can have its own nicknames — for typing, talking and searching. When parts are used on a job — or turn out to be bad — the tech records it and the truck's counts update automatically. A complete, printable Parts List shows everything on the truck grouped by category, alongside a restock list and downloadable reports.

## Technical ground rules

- Vite static front end (vanilla JS/TS or React — builder's choice). Output is a static `dist/` folder. No backend, no accounts, no API keys.
- All data is saved in the browser's `localStorage` (key `truck-inventory-v1`) and must survive a page reload. Photos are **not** saved (too large for browser storage).
- Hash-based routing so it works on any static host:
  - `#/` (and empty hash) → Inventory
  - `#/parts-list` → Parts List
  - `#/quick-add` → Quick Add
  - `#/photo` → Photo Count
  - `#/use` → Use Parts
  - `#/restock` → Restock List
  - `#/reports` → Reports
- The browser tab title (`<title>`) is exactly **"Chas Roberts Truck Inventory"** on every page.
- The page must include a favicon (a file or inline data-URI) so there are no 404 console errors on load.
- No uncaught JavaScript errors and no console errors on any page.
- Success messages are shown in an element with `role="status"`; error messages in an element with `role="alert"`. Messages are plain visible text.
- In all tables, header cells are `<th>` inside `<thead>` and body cells are `<td>` (do not use `<th>` for body cells).
- Number inputs use `<input type="number">`. Every form field has a visible `<label>` connected to it.

## Shared behavior: parts and names

- A **part** has: name, category, quantity on truck (whole number ≥ 0), "low-stock alert at" (whole number ≥ 0), and **other names** (a list of optional alternative names the crew uses for it, e.g. "stop valve", "supply stop"; may be empty). Parts saved by earlier versions without other names are treated as having an empty list.
- Adding a part whose name matches an existing part (strict match, below) **adds to the existing quantity** instead of creating a duplicate. The existing part keeps its original name.

## Shared behavior: understanding part names (sizes, number words, nicknames)

Techs say and type the same part many ways: `1/2" ProPress 90 degree elbow`, "half inch ProPress ninety", "90 degree ProPress", "ninety-degree ProPress half inch". The app must treat these as the same part. All of this works the same for typed text and for speech (speech is turned into text first, then the same rules apply).

### A. Name key (normalizing a name)

To compare names, each name is turned into a **key** by these steps, in order:

1. Lowercase. Replace `½` with ` 1/2`, `¼` with ` 1/4`, `¾` with ` 3/4`. Replace curly/prime quotes (`”`, `″`, `“`) with `"`. Replace `°` with ` degree`. Replace hyphens `-` with spaces.
2. **Sizes** become a canonical size token (`<size>in`). All of the following mean the same size (longest phrase wins; any case; "inch", "inches", "in" and `"` are all accepted after a number):

   | Canonical token | Accepted ways to write / say it |
   |---|---|
   | `1/4in` | `1/4"`, `1/4 inch`, `1/4 in`, `1/4`, `quarter inch`, `a quarter inch` |
   | `3/8in` | `3/8"`, `3/8 inch`, `3/8`, `three eighths inch`, `three eighth inch` |
   | `1/2in` | `1/2"`, `1/2 inch`, `1/2 in`, `1/2`, `.5 inch`, `0.5 inch`, `half inch`, `half an inch`, `one half inch` |
   | `5/8in` | `5/8"`, `5/8 inch`, `5/8`, `five eighths inch`, `five eighth inch` |
   | `3/4in` | `3/4"`, `3/4 inch`, `3/4`, `three quarter inch`, `three quarters inch`, `three fourths inch` |
   | `1in` | `1"`, `1 inch`, `one inch`, `an inch` |
   | `1-1/4in` | `1-1/4"`, `1 1/4"`, `1 1/4 inch`, `1-1/4`, `1 1/4`, `one and a quarter inch`, `one and one quarter inch`, `inch and a quarter` |
   | `1-1/2in` | `1-1/2"`, `1 1/2"`, `1 1/2 inch`, `1-1/2`, `1 1/2`, `one and a half inch`, `one and one half inch`, `inch and a half` |
   | `2in`, `3in`, `4in` | `2"`, `2 inch`, `two inch` (and the same for 3/three, 4/four) |

   A bare fraction (e.g. `1/2`, `3/4`) always counts as a size. A bare whole number (e.g. `90`, `2`) is **not** a size unless followed by `"`/inch/inches/in.
3. Remove any remaining punctuation except `/` in fractions (so `elbow.` → `elbow`, `(copper)` → `copper`).
4. **Word synonyms** (whole words/phrases, any case):
   - `pro press`, `propress` → `propress`
   - `shark bite`, `sharkbite` → `sharkbite`
   - `ell`, `el` → `elbow`
   - `coupler` → `coupling`
   - `ninety` → `90`; `forty five` → `45`; `twenty two and a half` and `22.5` → `22.5`
5. Remove these filler words: `degree`, `degrees`, `deg`, `the`, `of`, `a`, `an`. (So `90 degree`, `90°`, `90 deg`, `ninety degree` and plain `90` are all just `90`.)
6. For each remaining word longer than 3 letters that ends in a single `s` (not `ss`), drop that `s` (so `stops` → `stop`, `elbows` → `elbow`, `couplings` → `coupling`; `brass` stays).
7. Collapse spaces and trim. The result is the key; its words are the key's **tokens**.

Examples: `1/2" ProPress 90 degree elbow` → `1/2in propress 90 elbow`. "ninety-degree ProPress half inch" → `90 propress 1/2in`. `Half inch copper couplings` → `1/2in copper coupling`. `Angle stops` → `angle stop`.

### B. Strict match (used by the Inventory "Add part" form and the Edit dialog)

Two names are the same part when their keys are exactly equal. So on the Inventory page, adding `half inch copper couplings` when `1/2" copper coupling` exists adds to `1/2" copper coupling`. "Angle stop", "angle stops" and "ANGLE  STOPS" are the same part. Other names are **not** used by the add form (to avoid accidental merges).

### C. Smart lookup (used by Quick Add, Use Parts and Photo Count)

To find which truck part a typed/spoken name refers to:

1. **Exact:** a part whose name key — or the key of any of its other names — equals the spoken key. If exactly one part matches, use it.
2. **Partial:** otherwise, a part matches if **every token** of the spoken key appears among the tokens of the part's name key, or among the tokens of one of its other-name keys (word order does not matter, extra words in the part's name are fine). Example: "90 degree ProPress" (`90 propress`) matches `1/2" ProPress 90 degree elbow`; "ninety-degree ProPress half inch" (`90 propress 1/2in`) matches it too.
3. If exactly one part matches → that part. If no part matches → the name is **not on the truck** (Quick Add treats it as a new part; Use Parts shows the "Not on your truck" error). If **more than one** part matches (in step 1 or step 2) → the name is **ambiguous** and the app shows the error **"NAME could be more than one part: A, B. Say or type more of the name."** where NAME is the name as typed/spoken and A, B … are the matching parts' names sorted A→Z, joined with ", ". Nothing is saved when this error appears.

### D. Search (Inventory "Search parts" and Parts List "Search parts list")

A part is shown when **either** the search text (lowercased, trimmed) appears anywhere in the part's name or one of its other names (lowercased), **or** every token of the search text's key appears inside (as a substring of) some token of the part's name key or other-name keys. So searching `half inch`, `1/2"`, `1/2 inch` or `1/2` all find `1/2" copper coupling` and `1/2" ProPress 90 degree elbow` but not `3/4" copper coupling`; searching `ninety` finds `90 degree elbow`; searching `stop valve` finds a part whose other names include "stop valve".
- A part is **low** when its quantity on truck is less than or equal to its "low-stock alert at" number.
- Every change is recorded in a **history** log with: date/time, type, part name, quantity, job number (or blank). History types are exactly: `Added`, `Used on job`, `Bad part`, `Replaced`, `Count changed`, `Removed`.

## Shared behavior: reading a list of parts from text or speech

Quick Add and Use Parts both read free text like `add 3 angle stops and 2 90 degree elbows`. Rules:

1. Split the text into chunks on: new lines, commas, semicolons, `&`, and the whole word `and` (any case) — **except** do not split on `and` when it is followed by `a half`, `a quarter`, `one half` or `one quarter` (so "one and a half inch" and "inch and a half" stay in one piece).
2. In each chunk, trim it, drop a trailing period, and remove any of these leading filler phrases (any case): `add`, `i used`, `i'm using`, `im using`, `we used`, `used`, `using`, `i have`, `there are`, `plus`.
3. Quantity: if the chunk starts with a whole number in digits (e.g. `3`, followed by a space) or a number word (`a`, `an`, `one` … `twenty`), that is the quantity and the rest is the part name — **except** when that number is part of a size or angle, in which case it belongs to the name and the quantity is 1. A leading number is part of the name when it is: immediately followed by `degree`/`degrees`/`deg`/`°`; immediately followed by `"`/`inch`/`inches`/`in`; directly attached to `/`, `-` or `.` (e.g. `1/2"`, `1-1/2`, `0.5`); followed by a plain fraction (e.g. `1 1/2 inch` = size 1-1/2", quantity 1 — but a number followed by a dashed mixed size like `2 1-1/2"` is quantity 2 of `1-1/2"`); or part of a spoken size phrase (`one inch`, `one and a half inch`, `an inch`). If there is no leading quantity, the quantity is 1. Only the **first** number is checked, so `2 90 degree elbows` means 2 × "90 degree elbows", `two ninety-degree ProPress half inch` means 2 × "ninety-degree ProPress half inch", and `3 half inch copper couplings` means 3 × "half inch copper couplings". (`ninety`, `half`, `quarter` are never quantities.)
4. Chunks with an empty name are ignored. Repeated parts in the same text (the same truck part after smart lookup, or the same key for new parts) are combined (quantities added).
5. New part names are stored as written, with the first letter capitalized (e.g. `90 degree elbows`, `Copper couplings`).
6. Each chunk's name is matched to a truck part with **smart lookup** (section C above).

## Shared behavior: voice input

- Voice is offered only when the browser has `window.SpeechRecognition` or `window.webkitSpeechRecognition`. Check for it when the page is shown (not cached at import time from a different window).
- To listen: create a new recognizer with `new (window.SpeechRecognition || window.webkitSpeechRecognition)()`, set `lang = 'en-US'`, `interimResults = false`, `continuous = false`, attach handlers (either the `onresult` / `onerror` / `onend` properties or `addEventListener('result' | 'error' | 'end', …)` — both must work), then call `start()`.
- The recognized text is the concatenation of `event.results[i][0].transcript` for each result `i` from `event.resultIndex` (default 0) to `event.results.length - 1`, trimmed. Use it exactly as recognized (the name-understanding rules above handle "half inch", "ninety", etc.).
- When listening ends (`end` event) or the button is pressed again (call `stop()`), the button text goes back to its idle text.
- Recognizer errors (`error` event, or `start()` throwing) show **"Couldn't hear you. Check microphone permission and try again."** in a `role="alert"` element and never cause uncaught errors.

## Pages & features

### Navigation (all pages)

1. A top-level `<header>` element (a direct child of `<body>` or the app root, not inside `<main>`, so it has the "banner" role) containing the company logo image and the app name text **"Chas Roberts Truck Inventory"**, plus a `<nav>` element containing seven links, in this order: **"Inventory"**, **"Parts List"**, **"Quick Add"**, **"Photo Count"**, **"Use Parts"**, **"Restock"**, **"Reports"**. The current page's link is visually highlighted. The app title is **not** an `<h1>`; each page has exactly one `<h1>` (its main heading below).
2. **Logo:** the owner's logo is meant to live at `brand/chas-roberts-logo.png` in the repository root. The builder copies it into the app (e.g. `public/chas-roberts-logo.png`) so it ships in `dist/`, and shows it in the header as an `<img>` with alt text exactly **"Chas Roberts logo"**, about 40–56px tall on desktop (smaller is fine on phones), aspect ratio preserved, to the left of the app name. The image must actually load (no broken image, no 404). **If that file is not present in the repository when building** (it was not present when this spec was written), the builder creates a simple placeholder PNG at the same app path and file name (`chas-roberts-logo.png`, e.g. generated with a small Node script; it can be a simple blue-and-red banner with or without text) ideally the text "CHAS ROBERTS" in blue `#0073BB` with a red `#E0144C` accent), uses the same alt text, and notes in its build notes that the real logo file should be dropped in to replace it — the app code must not need any change when the real PNG is added.
3. On phones, all seven links stay available without a hamburger menu (wrapping onto two rows or a horizontally scrollable bar are both fine). The page itself must never scroll sideways.

### Page 1 — Inventory (`#/`)

1. Main heading (h1): **"Truck Inventory"**.
2. A summary line: **"Total items on truck: N"** where N is the sum of all quantities (0 when empty).
3. An add form with heading **"Add a part"** and fields:
   - **"Part name"** (text)
   - **"Quantity"** (number, default empty)
   - **"Low-stock alert at"** (number, default `0`)
   - **"Category"** (select with options exactly: `Plumbing`, `Air conditioning`, `Electrical`, `Other`; default `Plumbing`)
   - **"Other names"** (text, optional; the label text is exactly "Other names"). Helper text below it (not inside the label): "Optional. Other names the crew uses, separated by commas, e.g. stop valve, supply stop". Saved as a list: split on commas, trim each, drop empties, drop duplicates (case-insensitive). When a part is merged into an existing part, any new other names are added to the existing part's list.
   - Button **"Add part"**
4. Validation on "Add part" (nothing is saved if invalid):
   - Empty name → error **"Please enter a part name."**
   - Quantity empty, negative, or not a whole number → error **"Quantity must be a whole number of 0 or more."**
   - Low-stock alert at negative or not a whole number → same style error **"Low-stock alert must be a whole number of 0 or more."**
5. On success: the part is added (or merged into a matching part — strict match, section B), a success message **"Added Q to NAME (now T)."** appears (e.g. `Added 3 to Angle stop (now 3).`, or `Added 2 to 1/2" copper coupling (now 8).` when `half inch copper couplings` was typed), the form clears (Low-stock alert back to `0`, Category back to `Plumbing`, Other names empty), and a history entry of type `Added` is recorded.
6. A search box with placeholder **"Search parts"** (accessible name "Search parts", e.g. via `aria-label`) filters the table as you type, using the search rules in section D (so "half inch" finds `1/2"` parts). Next to it, when voice is supported, a button **"Search by voice"** (reads **"Stop talking"** while listening): the recognized speech **replaces** the search box text (trailing period removed) and the table filters immediately. When voice isn't supported, the button is simply not shown (no notice needed here).
7. A parts table with column headers exactly: **"Part"**, **"Category"**, **"On truck"**, **"Low at"**, **"Actions"**. Sorted by part name A→Z. In the Part cell of a low part, show a small badge with the text **"Low"** (red/orange). If the part has other names, the Part cell also shows a smaller grey line **"Also called: NAME1, NAME2"** (other names as entered, joined with ", ").
8. Each row's Actions cell has two buttons: **"Edit"** and **"Delete"**.
9. **Edit** opens a dialog (`role="dialog"`, e.g. a native `<dialog>`) with heading **"Edit part"**, the same five fields pre-filled ("Part name", "Quantity", "Low-stock alert at", "Category", "Other names" — other names shown joined with ", "), and buttons **"Save changes"** and **"Cancel"**. Same validation as the add form. Saving updates the part; if the quantity changed, a history entry of type `Count changed` is recorded with the new quantity. The dialog closes after saving or cancelling.
10. **Delete** asks for confirmation with the browser's `confirm()` dialog, text **"Delete NAME from the truck?"**. If confirmed, the part is removed and a `Removed` history entry is recorded. If cancelled, nothing changes.
11. When there are no parts, instead of table rows show **"No parts yet. Add your first part above."** When a search matches nothing, show **"No parts match your search."**

### Page 1b — Parts List (`#/parts-list`)

The owner asked for "a complete parts list of what's in the inventory". This page is a clean, read-only, printable list of **every** part on the truck (including parts with 0 left), grouped by category. Editing stays on the Inventory page.

1. Main heading (h1): **"Parts List"**. Intro text: "Every part in your truck inventory, grouped by category."
2. Two summary lines: **"Different parts: N"** (number of parts in the inventory) and **"Total items: T"** (sum of all quantities). Both show `0` when empty.
3. One section per category that has at least one part, in this fixed order: Plumbing, Air conditioning, Electrical, Other. Each section has an `<h2>` heading with the category name exactly (e.g. **"Plumbing"**, **"Air conditioning"**). Categories with no parts are not shown.
4. Each section has a table with column headers exactly: **"Part"**, **"On truck"**, **"Low at"**, **"Status"**, one row per part in that category, sorted by part name A→Z. Status text is exactly:
   - **"Out"** when the quantity is 0,
   - **"Low"** when the quantity is above 0 and at or below its low-stock alert,
   - **"OK"** otherwise.
5. Under each section's table, a subtotal line **"CATEGORY total: T items"** (e.g. `Plumbing total: 5 items`; use "item" when T is 1: `Plumbing total: 1 item`).
6. A search box with placeholder **"Search parts list"** filters rows across all sections as you type (search rules in section D, so "half inch" finds `1/2"` parts), with the same **"Search by voice"** button as the Inventory page when voice is supported; sections with no matching rows are hidden. When nothing matches, show **"No parts match your search."** The summary lines always show the whole inventory (not filtered).
7. Button **"Print parts list"** calls `window.print()`. A print stylesheet (`@media print`) hides the header/nav, the search box and buttons, so the printout is just the heading, summary and tables.
8. When there are no parts at all, show **"No parts yet. Add parts on the Inventory page."** (no sections, summary lines still show 0).
9. The list always reflects the current inventory (after adding, using, bad parts, edits, deletes) — it reads from the same saved data.

### Page 2 — Quick Add (`#/quick-add`)

1. Main heading: **"Quick Add"**. Intro text: "Type or say what you're putting on the truck, like "add 3 angle stops and 2 90 degree elbows"."
2. A textarea labelled **"What do you want to add?"**.
3. Voice: if the browser supports the Web Speech API (`SpeechRecognition` or `webkitSpeechRecognition`), show a button **"Start talking"**. While listening it reads **"Stop talking"**. Recognized speech is appended to the textarea (separated by a comma if the textarea isn't empty). If speech isn't supported, show instead the text **"Voice input isn't supported in this browser. Type instead."** Speech errors (e.g. microphone permission denied) show an error message **"Couldn't hear you. Check microphone permission and try again."** and must not throw uncaught errors.
4. Button **"Read list"** parses the text (see parsing rules) and shows a preview table with headers **"Part"**, **"Quantity"**, **"Status"**. Part shows the existing part's name if it matches one, otherwise the new name. Status is **"Already on truck"** or **"New part"**.
5. If nothing could be read → error **"I couldn't find any parts in that. Try something like "3 angle stops"."** and no preview. If any name is ambiguous (smart lookup) → the "could be more than one part" error and no preview.
6. Below the preview, button **"Save to inventory"**. Saving adds each quantity to the truck (new parts are created with category `Other` and low-stock alert `0`), records `Added` history entries, shows **"Saved N parts to inventory."** (N = number of preview rows), and clears the textarea and the preview.

### Page 3 — Photo Count (`#/photo`)

1. Main heading: **"Photo Count"**. Intro text: "Snap a photo of a bin or shelf, then tap each part in the photo to count it."
2. A file input labelled **"Take or choose a photo"** (`accept="image/*"`, `capture="environment"` so phones open the camera).
3. After a photo is chosen, it is shown at the full width of the content area (max 700px wide) with alt text **"Your photo"**, and the text **"Tap each part in the photo to count it."** appears.
4. Each tap/click on the photo places a numbered marker (1, 2, 3 …) at that spot. Markers must not block taps (taps on a marker still count as a new tap, e.g. `pointer-events: none` on markers). A counter shows **"Counted: N"** (starts at `Counted: 0` once a photo is loaded).
5. Buttons **"Undo last tap"** (removes the last marker) and **"Clear taps"** (removes all markers).
6. A **"Part name"** text field (with suggestions of existing part names via a `<datalist>`) and a button **"Add to inventory"**.
   - No photo or count of 0 → error **"Tap the photo to count at least one part."**
   - Empty name → error **"Please enter a part name."**
   - Ambiguous name (smart lookup) → the "could be more than one part" error.
   - Success → adds the count to the matching part found by smart lookup (or creates a new one with category `Other`, low-stock alert `0`), records an `Added` history entry, shows **"Added N to NAME (now T)."**, and clears the markers and name (the photo may stay).
7. Choosing a new photo resets the count to 0.

### Page 4 — Use Parts (`#/use`)

1. Main heading: **"Use Parts"**.
2. A text field **"Job number"** (any text, e.g. `1001` or `J-2024-15`).
3. A radio group with legend **"What happened?"** and two options: **"Used on job"** (selected by default) and **"Bad part (not usable)"**. Helper text under the bad-part option: "The part was bad and not used. It won't be charged to the job and will go on your restock list."
4. A textarea labelled **"Parts used"** with placeholder `e.g. 2 angle stops, 2 90 degree elbows`, plus the same **"Start talking"** voice button / unsupported text as Quick Add.
5. Button **"Record"**. Validation (nothing changes if any error):
   - Empty parts text → **"Please list the parts you used."**
   - "Used on job" selected and job number empty → **"Please enter a job number."**
   - Any name that is ambiguous (smart lookup) → **"NAME could be more than one part: A, B. Say or type more of the name."** (if several, show the first one)
   - Any part that doesn't match a part on the truck → **"Not on your truck: NAME1, NAME2. Add it on the Inventory page first."** (names as typed)
   - Any part with not enough quantity → **"Not enough NAME on the truck (have H, need N)."** (NAME = the inventory name; if several, show the first one)
6. **Used on job** success: subtract the quantities from the truck, record one `Used on job` history entry per part with the job number, show **"Recorded for job JOB: Q × NAME, Q × NAME."** (e.g. `Recorded for job 1001: 2 × Angle stop, 2 × 90 degree elbow.`) — NAME is always the truck part's saved name, even when it was found by another name (e.g. saying "two ninety-degree ProPress half inch" records `2 × 1/2" ProPress 90 degree elbow`), and clear the parts text (the job number stays, so the tech can record more for the same job).
7. **Bad part** success: subtract the quantities from the truck, record one `Bad part` history entry per part with **no job number** (even if one is typed), add each to the restock "Replace bad parts" list, and show **"Recorded bad part: Q × NAME. Added to your restock list."** The idea: the bad part is not charged to the job; the replacement part that *was* used is recorded separately as "Used on job".

### Page 5 — Restock List (`#/restock`)

1. Main heading: **"Restock List"**.
2. Section heading **"Running low"**: one line per low part, text **"NAME: have Q, alert at L"** (e.g. `Angle stop: have 1, alert at 2`). Empty → **"Nothing is running low."**
3. Section heading **"Replace bad parts"**: one entry per bad-part record not yet replaced, text **"NAME × Q"** (multiplication sign) and a button **"Mark replaced"**. Clicking it adds Q back onto the truck for that part, records a `Replaced` history entry, and removes the entry from this list. Empty → **"No bad parts to replace."**
4. If the part was deleted from the inventory in the meantime, "Mark replaced" re-creates it with category `Other` and low-stock alert `0`.

### Page 6 — Reports (`#/reports`)

1. Main heading: **"Reports"**.
2. A text field **"Filter by job number"**. When it has a value, the history table shows only entries whose job number equals it (case-insensitive, trimmed), and a line **"Parts used on job JOB: N"** shows the total quantity of `Used on job` entries for that job.
3. A history table with headers **"Date"**, **"Type"**, **"Part"**, **"Qty"**, **"Job number"**, newest first. Blank job numbers are shown as **"—"**. Empty → **"No history yet."**
4. Button **"Download inventory CSV"** downloads `truck-inventory.csv` with header row `Part,Category,On truck,Low at` and one row per part.
5. Button **"Download history CSV"** downloads `truck-history.csv` with header row `Date,Type,Part,Qty,Job number` and one row per history entry (respecting the current job filter is not required — always export all history).
6. CSV values containing commas or quotes must be quoted properly.

## Look & feel

- Branded for Chas Roberts using the logo's red and blue, on a clean white background. Clean and high-contrast so it's readable in sunlight and with dirty gloves.
- Colors (exact values):
  - **Main color — blue `#0073BB`**: the `<nav>` bar background (white link text), headings (h1/h2) text color, the app name text in the header, and table header row accents.
  - **Highlight / buttons — red `#E0144C`**: background of all primary action buttons (e.g. "Add part", "Read list", "Save to inventory", "Record", "Add to inventory", "Mark replaced", "Print parts list", download buttons) with white text; the highlighted (current) nav link indicator (e.g. a red underline or red background); the "Low" badge.
  - **Background — white `#FFFFFF`** for the page `<body>`; the header area above the nav is also white so the logo sits on white. Cards/sections are white with a light grey border or subtle shadow.
  - Secondary buttons (e.g. "Cancel", "Edit", "Undo last tap", "Clear taps") are white with a blue `#0073BB` border and blue text. "Delete" may be red outline.
  - Error text: dark red `#B0103C` (readable on white). Success text: green `#2E7D32`.
- Font: "Inter" from Google Fonts (optional) with system sans-serif fallback; base size 16px or larger.
- Big tap targets: buttons and inputs at least 44px tall.
- Responsive: works from 360px phone width to desktop. On phones, forms stack in one column and wide tables scroll inside their own container — the page itself never scrolls sideways. The logo and app name may shrink or wrap on phones but must stay visible.

## Acceptance criteria

1. The app loads at `/` showing the header name "Chas Roberts Truck Inventory", heading "Truck Inventory", "Total items on truck: 0" and "No parts yet. Add your first part above.", with no uncaught errors or console errors.
2. The seven nav links each open their page with the correct heading (Truck Inventory, Parts List, Quick Add, Photo Count, Use Parts, Restock List, Reports).
3. Adding a part with name, quantity and low-stock alert shows it in the table with the right "On truck" number, a success message, and an updated total.
4. The add form rejects an empty name and an invalid quantity with the specified error messages, and saves nothing.
5. Adding a part whose name matches an existing one (e.g. "angle stops" vs "Angle stop") adds to the existing quantity instead of creating a second row.
6. Edit changes a part's quantity via the "Edit part" dialog; Delete (after confirming) removes the part.
7. The "Search parts" box filters the table and shows "No parts match your search." when nothing matches.
8. A part at or below its low-stock alert shows a "Low" badge.
9. Parts and their quantities are still there after reloading the page.
10. Quick Add reads "add 3 angle stops and 2 90 degree elbows" into a preview (matching an existing part vs. new part), and "Save to inventory" updates the truck.
11. Quick Add and Use Parts show either a "Start talking" button or the "voice not supported" notice.
12. Photo Count: after choosing a photo, each tap increases "Counted: N", "Undo last tap" removes one, and "Add to inventory" adds the count to the named part.
13. Use Parts with "Used on job" and job number subtracts the listed quantities (e.g. 2 angle stops and 2 90 degree elbows) from the truck and shows a confirmation.
14. Use Parts refuses to record when the job number is missing, a part isn't on the truck, or there aren't enough on the truck — and nothing changes.
15. Recording a "Bad part" subtracts it from the truck, does not attach a job number, puts it on the "Replace bad parts" list, and "Mark replaced" puts the quantity back on the truck.
16. The Restock page lists parts that are running low.
17. Reports shows the history with types and job numbers, and filtering by job number shows only that job's entries plus "Parts used on job JOB: N".
18. Reports can download the inventory and history as CSV files with the specified headers.
19. On a phone-sized screen (390×844) the nav links work, a part can be added, and the page does not scroll sideways (including on the Parts List page).
20. The Parts List page shows every part in the inventory — including parts with 0 left — grouped under category headings, with "Different parts: N", "Total items: T", per-category subtotals, and an Out/Low/OK status; it starts with "No parts yet. Add parts on the Inventory page." when empty.
21. The Parts List updates after parts are used on a job, and its "Search parts list" box filters rows and shows "No parts match your search." when nothing matches.
22. The Parts List has a "Print parts list" button that opens the browser's print dialog.
23. Branding: the browser tab title is "Chas Roberts Truck Inventory"; the header shows the app name and a logo image (alt "Chas Roberts logo") that loads; the page background is white, the nav bar is blue `#0073BB`, and primary buttons (e.g. "Add part") are red `#E0144C`.
24. Use Parts understands sizes and different wording: with `1/2" ProPress 90 degree elbow` on the truck, "2 ninety-degree ProPress half inch" and "1 90 degree ProPress" both subtract from it (confirmation shows the saved name), and "3 half inch copper couplings" subtracts from `1/2" copper coupling` but not `3/4" copper coupling`.
25. Searching "half inch", `1/2"` or "1/2 inch" on the Inventory page finds the `1/2"` parts and hides the `3/4"` part; "half inch" works the same on the Parts List search.
26. On the Inventory add form, adding "half inch copper couplings" adds to the existing `1/2" copper coupling`; in Quick Add, "add 2 half inch copper couplings" previews `1/2" copper coupling` as "Already on truck".
27. When a spoken/typed name fits more than one part (e.g. "90 degree ProPress" with both 1/2" and 3/4" ProPress elbows), Use Parts shows "… could be more than one part: … Say or type more of the name." and nothing changes.
28. A part can be given "Other names"; they show as "Also called: …", the part can be used on a job by one of those names, and searching by one finds it.
29. Voice: with speech available, "Start talking" on Use Parts puts what was said (e.g. "two ninety-degree ProPress half inch") into the parts box and recording it subtracts from the right part; "Search by voice" on the Inventory page puts "half inch" into the search box and filters to the 1/2" parts.

## Out of scope / limitations

- **Automatic part recognition from photos (AI vision) is not included.** Identifying plumbing/HVAC parts and counting them automatically needs a paid AI service with a secret API key and a server, which version 1 cannot have. Instead, the Photo Count page lets the tech tap each part on the photo to count it quickly and accurately. This is the main gap from the owner's wish and is a natural upgrade for version 2.
- **Voice** uses the browser's built-in speech recognition. It works in Chrome, Edge and Safari (including iPhone Safari) but not in Firefox; those users can type instead. Speech-to-text quality depends on the browser.
- No user accounts, no syncing between phones or between multiple trucks, no cloud backup. Data lives on one device/browser; clearing browser data erases it. (CSV download is the backup/report path.)
- Photos are not stored.
- The Parts List is a list of what is in **this** truck's inventory; it does not come pre-loaded with a catalog of every plumbing/HVAC part made (no free public parts catalog exists that the app could use without a key). Printing uses the browser's own print dialog (which can also "Save as PDF").
- No barcode scanning, no supplier ordering, no pricing/costs, no invoicing to customers.
- Name understanding uses fixed rules (size words, number words, a short synonym list, and the "Other names" each part is given), not AI. It drops a single trailing "s", so irregular plurals like "boxes"/"box" won't match each other; other nicknames work once they're added under "Other names".
- A whole number followed by a plain fraction is read as one size, not a quantity: "1 1/2 inch PVC" means one 1-1/2" PVC part. To record two of them, write the size with a dash after the quantity: "2 1-1/2\" PVC" (or "two 1-1/2 inch PVC").
- Voice accuracy depends on the browser's speech recognition; whatever text it produces is run through the same rules.

## Assumptions

- One truck per device; the person using the app is the tech who drives it.
- "Groups of items" counting is satisfied by tap-to-count on a photo plus speaking/typing quantities ("12 copper couplings").
- A bad part is removed from the truck count and goes on a restock list, but is never charged to a job number; the replacement part used is recorded normally as "Used on job".
- "Mark replaced" means the tech got a new part from the supply house and put it back on the truck.
- Categories are limited to Plumbing, Air conditioning, Electrical, Other.
- The logo file `brand/chas-roberts-logo.png` was not found in the repository when this spec was written. The builder uses it if present; otherwise a placeholder logo file is used at the same app path so the owner can drop in the real logo later without code changes.
- The owner's blue/red/white theme replaces the earlier navy/orange/grey theme. Blue is used for the nav bar and headings, red for buttons and highlights. Error text uses a slightly darker red than the button red so error messages don't look like buttons.
- The page heading on the first page stays "Truck Inventory"; the full name "Chas Roberts Truck Inventory" appears in the header and browser tab.
- The app starts empty (no sample data).
- "A complete parts list of what's in the inventory" was read as a dedicated, read-only, printable page listing every part on the truck grouped by category with totals — rather than a pre-loaded master catalog. The Inventory page stays the place to add/edit/delete.
- "Half inch", `1/2"`, `1/2 inch`, `½"` and a bare `1/2` all mean the same size, everywhere (typing, speaking, searching). The same goes for the other common plumbing/HVAC sizes in the size table.
- "Calling a part by a different name" is handled three ways: word order doesn't matter and partial names are fine (smart lookup), a short built-in synonym list (ProPress, ell/elbow, ninety/90, degree dropped…), and a per-part "Other names" list the owner fills in for shop nicknames.
- If a partial name could mean more than one part, the app asks the tech to be more specific rather than guessing.
- The Inventory "Add part" form uses only the strict match (not partial names or other names), so adding a new size or variant never gets merged into a different part by accident.
- CSV exports keep their existing columns (other names are not exported).
- A part is "low" at or below its alert number, so with the default alert of 0, a part with 0 left shows as Low.
