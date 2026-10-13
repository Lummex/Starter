# Truck Inventory Tracker — Build Spec

## Summary

A phone-friendly web app for plumbing and air-conditioning service techs to keep track of the parts on their truck. Parts can be added by typing, by talking (where the browser supports voice), or by taking a photo and tapping each part to count it. When parts are used on a job — or turn out to be bad — the tech records it and the truck's counts update automatically, with a restock list and downloadable reports.

## Technical ground rules

- Vite static front end (vanilla JS/TS or React — builder's choice). Output is a static `dist/` folder. No backend, no accounts, no API keys.
- All data is saved in the browser's `localStorage` (key `truck-inventory-v1`) and must survive a page reload. Photos are **not** saved (too large for browser storage).
- Hash-based routing so it works on any static host:
  - `#/` (and empty hash) → Inventory
  - `#/quick-add` → Quick Add
  - `#/photo` → Photo Count
  - `#/use` → Use Parts
  - `#/restock` → Restock List
  - `#/reports` → Reports
- The page must include a favicon (a file or inline data-URI) so there are no 404 console errors on load.
- No uncaught JavaScript errors and no console errors on any page.
- Success messages are shown in an element with `role="status"`; error messages in an element with `role="alert"`. Messages are plain visible text.
- In all tables, header cells are `<th>` inside `<thead>` and body cells are `<td>` (do not use `<th>` for body cells).
- Number inputs use `<input type="number">`. Every form field has a visible `<label>` connected to it.

## Shared behavior: parts and names

- A **part** has: name, category, quantity on truck (whole number ≥ 0), and "low-stock alert at" (whole number ≥ 0).
- **Name matching** (used everywhere a part name is typed or spoken): two names are the same part if they are equal after: lowercasing, trimming, collapsing repeated spaces into one, and removing one trailing letter "s" if present. So "Angle stop", "angle stops" and "ANGLE  STOPS" are the same part. "90 degree elbow" and "90 degree elbows" are the same part.
- Adding a part whose name matches an existing part **adds to the existing quantity** instead of creating a duplicate. The existing part keeps its original name.
- A part is **low** when its quantity on truck is less than or equal to its "low-stock alert at" number.
- Every change is recorded in a **history** log with: date/time, type, part name, quantity, job number (or blank). History types are exactly: `Added`, `Used on job`, `Bad part`, `Replaced`, `Count changed`, `Removed`.

## Shared behavior: reading a list of parts from text or speech

Quick Add and Use Parts both read free text like `add 3 angle stops and 2 90 degree elbows`. Rules:

1. Split the text into chunks on: new lines, commas, semicolons, `&`, and the whole word `and` (any case).
2. In each chunk, trim it, drop a trailing period, and remove any of these leading filler phrases (any case): `add`, `i used`, `i'm using`, `im using`, `we used`, `used`, `using`, `i have`, `there are`, `plus`.
3. Quantity: if the chunk starts with a number in digits (e.g. `3`) or a number word (`a`, `an`, `one` … `twenty`), that is the quantity and the rest is the part name — **except** when that number is immediately followed by the word `degree`/`deg` or the symbol `°`, in which case the number is part of the name and the quantity is 1. If there is no leading number, the quantity is 1. Only the **first** number is checked, so `2 90 degree elbows` means 2 × "90 degree elbows".
4. Chunks with an empty name are ignored. Repeated parts in the same text are combined (quantities added).
5. New part names are stored as written, with the first letter capitalized (e.g. `90 degree elbows`, `Copper couplings`).

## Pages & features

### Navigation (all pages)

1. A top header with the app title text **"Truck Inventory Tracker"** and a `<nav>` element containing six links, in this order: **"Inventory"**, **"Quick Add"**, **"Photo Count"**, **"Use Parts"**, **"Restock"**, **"Reports"**. The current page's link is visually highlighted. The app title is **not** an `<h1>`; each page has exactly one `<h1>` (its main heading below).
2. On phones, all six links stay available without a hamburger menu (wrapping onto two rows or a horizontally scrollable bar are both fine). The page itself must never scroll sideways.

### Page 1 — Inventory (`#/`)

1. Main heading (h1): **"Truck Inventory"**.
2. A summary line: **"Total items on truck: N"** where N is the sum of all quantities (0 when empty).
3. An add form with heading **"Add a part"** and fields:
   - **"Part name"** (text)
   - **"Quantity"** (number, default empty)
   - **"Low-stock alert at"** (number, default `0`)
   - **"Category"** (select with options exactly: `Plumbing`, `Air conditioning`, `Electrical`, `Other`; default `Plumbing`)
   - Button **"Add part"**
4. Validation on "Add part" (nothing is saved if invalid):
   - Empty name → error **"Please enter a part name."**
   - Quantity empty, negative, or not a whole number → error **"Quantity must be a whole number of 0 or more."**
   - Low-stock alert at negative or not a whole number → same style error **"Low-stock alert must be a whole number of 0 or more."**
5. On success: the part is added (or merged into a matching part — see name matching), a success message **"Added Q to NAME (now T)."** appears (e.g. `Added 3 to Angle stop (now 3).`), the form clears (Low-stock alert back to `0`, Category back to `Plumbing`), and a history entry of type `Added` is recorded.
6. A search box with placeholder **"Search parts"** filters the table as you type (case-insensitive, matches anywhere in the name).
7. A parts table with column headers exactly: **"Part"**, **"Category"**, **"On truck"**, **"Low at"**, **"Actions"**. Sorted by part name A→Z. In the Part cell of a low part, show a small badge with the text **"Low"** (red/orange).
8. Each row's Actions cell has two buttons: **"Edit"** and **"Delete"**.
9. **Edit** opens a dialog (`role="dialog"`, e.g. a native `<dialog>`) with heading **"Edit part"**, the same four fields pre-filled ("Part name", "Quantity", "Low-stock alert at", "Category"), and buttons **"Save changes"** and **"Cancel"**. Same validation as the add form. Saving updates the part; if the quantity changed, a history entry of type `Count changed` is recorded with the new quantity. The dialog closes after saving or cancelling.
10. **Delete** asks for confirmation with the browser's `confirm()` dialog, text **"Delete NAME from the truck?"**. If confirmed, the part is removed and a `Removed` history entry is recorded. If cancelled, nothing changes.
11. When there are no parts, instead of table rows show **"No parts yet. Add your first part above."** When a search matches nothing, show **"No parts match your search."**

### Page 2 — Quick Add (`#/quick-add`)

1. Main heading: **"Quick Add"**. Intro text: "Type or say what you're putting on the truck, like "add 3 angle stops and 2 90 degree elbows"."
2. A textarea labelled **"What do you want to add?"**.
3. Voice: if the browser supports the Web Speech API (`SpeechRecognition` or `webkitSpeechRecognition`), show a button **"Start talking"**. While listening it reads **"Stop talking"**. Recognized speech is appended to the textarea (separated by a comma if the textarea isn't empty). If speech isn't supported, show instead the text **"Voice input isn't supported in this browser. Type instead."** Speech errors (e.g. microphone permission denied) show an error message **"Couldn't hear you. Check microphone permission and try again."** and must not throw uncaught errors.
4. Button **"Read list"** parses the text (see parsing rules) and shows a preview table with headers **"Part"**, **"Quantity"**, **"Status"**. Part shows the existing part's name if it matches one, otherwise the new name. Status is **"Already on truck"** or **"New part"**.
5. If nothing could be read → error **"I couldn't find any parts in that. Try something like "3 angle stops"."** and no preview.
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
   - Success → adds the count to the matching part (or creates a new one with category `Other`, low-stock alert `0`), records an `Added` history entry, shows **"Added N to NAME (now T)."**, and clears the markers and name (the photo may stay).
7. Choosing a new photo resets the count to 0.

### Page 4 — Use Parts (`#/use`)

1. Main heading: **"Use Parts"**.
2. A text field **"Job number"** (any text, e.g. `1001` or `J-2024-15`).
3. A radio group with legend **"What happened?"** and two options: **"Used on job"** (selected by default) and **"Bad part (not usable)"**. Helper text under the bad-part option: "The part was bad and not used. It won't be charged to the job and will go on your restock list."
4. A textarea labelled **"Parts used"** with placeholder `e.g. 2 angle stops, 2 90 degree elbows`, plus the same **"Start talking"** voice button / unsupported text as Quick Add.
5. Button **"Record"**. Validation (nothing changes if any error):
   - Empty parts text → **"Please list the parts you used."**
   - "Used on job" selected and job number empty → **"Please enter a job number."**
   - Any part that doesn't match a part on the truck → **"Not on your truck: NAME1, NAME2. Add it on the Inventory page first."** (names as typed)
   - Any part with not enough quantity → **"Not enough NAME on the truck (have H, need N)."** (NAME = the inventory name; if several, show the first one)
6. **Used on job** success: subtract the quantities from the truck, record one `Used on job` history entry per part with the job number, show **"Recorded for job JOB: Q × NAME, Q × NAME."** (e.g. `Recorded for job 1001: 2 × Angle stop, 2 × 90 degree elbow.`), and clear the parts text (the job number stays, so the tech can record more for the same job).
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

- Rugged, work-truck feel: clean and high-contrast so it's readable in sunlight and with dirty gloves.
- Colors: dark navy header `#1F2A44` with white text; primary buttons safety orange `#F26B1D` with white text; page background `#F5F6F8`; cards white with subtle shadow; "Low" badge and error text red `#C62828`; success text green `#2E7D32`.
- Font: "Inter" from Google Fonts with system sans-serif fallback; base size 16px or larger.
- Big tap targets: buttons and inputs at least 44px tall.
- Responsive: works from 360px phone width to desktop. On phones, forms stack in one column and wide tables scroll inside their own container — the page itself never scrolls sideways.

## Acceptance criteria

1. The app loads at `/` showing heading "Truck Inventory", "Total items on truck: 0" and "No parts yet. Add your first part above.", with no uncaught errors or console errors.
2. The six nav links each open their page with the correct heading (Truck Inventory, Quick Add, Photo Count, Use Parts, Restock List, Reports).
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
19. On a phone-sized screen (390×844) the nav links work, a part can be added, and the page does not scroll sideways.

## Out of scope / limitations

- **Automatic part recognition from photos (AI vision) is not included.** Identifying plumbing/HVAC parts and counting them automatically needs a paid AI service with a secret API key and a server, which version 1 cannot have. Instead, the Photo Count page lets the tech tap each part on the photo to count it quickly and accurately. This is the main gap from the owner's wish and is a natural upgrade for version 2.
- **Voice** uses the browser's built-in speech recognition. It works in Chrome, Edge and Safari (including iPhone Safari) but not in Firefox; those users can type instead. Speech-to-text quality depends on the browser.
- No user accounts, no syncing between phones or between multiple trucks, no cloud backup. Data lives on one device/browser; clearing browser data erases it. (CSV download is the backup/report path.)
- Photos are not stored.
- No barcode scanning, no supplier ordering, no pricing/costs, no invoicing to customers.
- Name matching is simple (one trailing "s"), so irregular plurals like "boxes"/"box" won't match each other.

## Assumptions

- One truck per device; the person using the app is the tech who drives it.
- "Groups of items" counting is satisfied by tap-to-count on a photo plus speaking/typing quantities ("12 copper couplings").
- A bad part is removed from the truck count and goes on a restock list, but is never charged to a job number; the replacement part used is recorded normally as "Used on job".
- "Mark replaced" means the tech got a new part from the supply house and put it back on the truck.
- Categories are limited to Plumbing, Air conditioning, Electrical, Other.
- The app starts empty (no sample data).
- A part is "low" at or below its alert number, so with the default alert of 0, a part with 0 left shows as Low.
