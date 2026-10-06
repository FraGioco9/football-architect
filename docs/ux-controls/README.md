# UX controls polish

- Text buttons use content-independent dimensions so IT/EN changes do not resize them.
- Existing full-width and icon-only controls retain their intended geometry.
- Scrollbar tracks and corners are transparent; thumbs remain visible.
- Single-select dropdowns use a Football Architect themed combobox/listbox surface while keeping the native select synchronized as the game state source.
- Keyboard open/close, selection change, responsive overflow and B-PC03 career creation are covered by the targeted browser gate.

Targeted gate: Chrome + Edge on Node 20 and Node 24 — PASS.
Candidate SHA-256: $env:NEW_HASH
No deploy.
