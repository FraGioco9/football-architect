# CLEAN-UI-03 — Calendar, Fixtures and History control contract matrix

Source-level map for existing issue #322 P3 (2026-10-27). This is a **read-only code review**, not browser/AT certification. Behavioral differences below are reasons **not** to extract a shared JavaScript controller without dedicated QA.

| Surface | Component / source | Accessible semantics | Keyboard / focus | Pointer, responsive and theme |
| --- | --- | --- | --- | --- |
| Calendar week | `tools/render-world-calendar.mjs:31–38`; `assets/calendar-simplified.js:65–99` | Navigation group labeled Week navigation; Previous/Next week buttons have `aria-controls`; Week trigger is a combobox with expanded/controls state; Current week has an aria-label | Trigger handles Escape and ArrowUp/ArrowDown; menu options have role option, tabIndex and selection semantics | Four-control enabled-state CSS shares a selector; responsive Current week text visually hidden at <=1000px; focus-visible outline and reduced-motion overrides are separate |
| Calendar season | `assets/calendar-simplified.js:19–42` | Season combobox with controlled menu options and expanded state | Escape closes menu; ArrowUp/ArrowDown changes selected season; Escape from menu returns focus to trigger | Season selection updates URL; controls differ from week picker and must not be generalized |
| Calendar event dialog | `assets/calendar-simplified.js:108–150`; `assets/app.css` CAL-UX-10/11 | Modal dialog labeled by event title; Close control has aria-label | Escape close intercepted, focus restoration to previous element; keyboard-open assigns focus to close button | Distinct animation/closing states; reduced-motion override; touch/coarse-pointer suppresses hover tooltip; light/dark event palette kept |
| Fixtures matchday | `assets/competition-fixtures.js:285–301` | Navigation arrows and round selector are wired to existing round menu implementation | Prev/Next reject disabled activation; Current matchday button selects current round and focuses round trigger | Shared arrow geometry only, not Calendar week controls; matchday selector has different data source and state |
| History player record | `assets/competition-history.js:208–272` | Native dialog labeled by heading; localized Close button; links to club and season views | Dialog shown modally; Close receives focus; native dialog close restores source focus; backdrop click closes | Scroll container locked while modal is open, restored on close; separate from Calendar timed closing animation |
| Shared arrows | `assets/app.css` CAL-REFINE and CLUBS-LAYOUT-02G | Buttons keep feature-specific labels and disabled state | Focus-visible contract remains feature-owned | Shared chevron sizing/centering via paired CSS selectors; no JS control extraction |

## Integration conclusion

**P3 mapping is complete at the source-contract level** for the named surfaces. Shared CSS styling is already represented by paired selectors and the enabled-state Calendar selectors were consolidated on Draft #323. Calendar week selectors, Fixtures matchday navigation and History dialogs have **different state machines and focus semantics**; extracting shared JavaScript behavior would increase coupling and is not a safe cleanup by default. Do not claim browser/AT/iPhone parity from this static map.

Outstanding existing acceptance (not new checklist items): run EN/DE/ES/FR/IT, light/dark, 320/390/768/1440, focus/keyboard/touch, reduced-motion and browser visual parity at final PR gate. No route, page, public policy or application runtime changed by this document.
