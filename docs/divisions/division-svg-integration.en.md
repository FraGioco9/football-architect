# DIV-ASSET-07 — Inline division SVG integration

The 32 approved SVG sources replace all 128 division PNG/WebP files. The old
asset registry and asynchronous logo loader are removed. Source files are
byte-identical to `DIV-ASSET.zip`; paths derive from canonical division IDs
and names, with explicit `primary.svg` and `compact.svg` variants.

The canonical [SVG specification](division-svg-specification.en.md) applies with
these subsequent owner decisions: DIV-ASSET-05 A accepts current theme contrast;
DIV-SVG-14 is excluded. Original colors, aspect ratios and viewBoxes remain
unchanged. No backing surfaces, frames, shadows or theme-specific variants exist.

## Generation and runtime

- Competition cards and competition headers explicitly select Compact.
  Both approved source variants remain available; Primary is not rendered in
  these contexts, following the owner’s subsequent display decision.
- HTML contains SVG markup before delivery. Declarative shadow roots isolate
  the original `.s0`/`.s1` styles without rewriting the artwork or fetching it.
- Full detail documents replace tiny asynchronous route entries so logos are
  present even with JavaScript disabled. This increases generated HTML size;
  the generator remains the single source of shell markup.
- Runtime enhances only the standings region. It never replaces or injects
  logos. The existing competition data manifest contains no logo paths.
- Unslotted light-DOM division IDs provide a fallback in browsers without
  declarative shadow DOM. Supported browsers render only the SVG. The renderer
  also supports ID fallback for absent artwork and accessible names for standalone
  logos. Current contexts show division names and hide decorative hosts from
  assistive technology.
- Missing, malformed, modified or extra source assets stop validation and page
  generation before publication. The approved aggregate SHA-256 pins all source
  bytes and paths without a separately maintained asset manifest.

## Verification

Automated checks cover exact source integrity, safe XML/CSS, canonical colors,
original viewBoxes, deterministic paths, symlinks, publication allowlisting,
reserved fallback space and contextual accessibility. Chrome checks cover
1440/390/320 widths, light/dark themes, standings and DEV isolation; all 16
detail logos and 16 index logos also render with page JavaScript disabled.
Their SVG viewports fit the reserved frames. Original styles remain isolated
under hostile page-level CSS, scale
uniformly without cropping and issue no logo resource requests.

Current browser evidence is Chrome; Safari and Firefox have not been exercised.
The accepted artwork contrast is preserved, not re-evaluated against a new
contrast threshold. Club identities, flags and general branding are unchanged.
