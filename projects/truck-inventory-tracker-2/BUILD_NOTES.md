# Build notes
- Vanilla JS + Vite app; hash routing; data in localStorage `truck-inventory-v1`.
- All six pages implemented per SPEC (inventory CRUD with edit dialog, Quick Add parser + voice, tap-to-count Photo Count, Use Parts incl. bad parts, Restock list, Reports with filter + CSV downloads).
- Deviation: Inter is declared in the font stack but not loaded from Google Fonts (avoids network-failure console errors); system sans-serif fallback is used.
- Extra: editing a part to a name matching another part shows an error.
- Parts List page (#/parts-list): read-only, grouped by category, Out/Low/OK status, search, print stylesheet.
