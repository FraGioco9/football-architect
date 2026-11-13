# Country flag assets

The 255 country/subdivision SVGs in this directory are vendored from
[flag-icons](https://github.com/lipis/flag-icons), version **v7.6.0**,
using its `flags/4x3/*.svg` collection (MIT license; see `LICENSE.flag-icons`).

- Each original asset code and public path `/assets/flags/<code>.svg` is retained.
- Every SVG has a **4:3 display viewBox** for consistent rendering across the app.
  This is a standardized graphic ratio, not necessarily a nation's official
  physical flag ratio (for example, Nigeria's official ratio is 2:1).
- The downloaded SVG artwork is wrapped in a per-file native rounded-corner
  mask (~3px radius at 24×18px display size). Masks use country-specific IDs.
- No runtime dependency, external CDN, or network request is needed.
- The England flag uses `gb-eng.svg`.

To update the assets, use the same upstream release for all 255 source files,
keep existing filenames and the mask convention, and run
`node --test tests/flags-4x3-assets.test.mjs`.
