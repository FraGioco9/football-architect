# CLEAN-UI-03 — repository-wide asset reference inventory

This instrument supports the **existing P5 inventory** item without declaring any resource safe for removal.

Run `node tools/audit-repository-assets.mjs` in the repository root. It traverses tracked or present repository files excluding `.git`, `node_modules`, `.next` and `dist`, scans source HTML/JS/MJS/CSS/JSON/Markdown/CSV/YAML/SVG, and reports direct absolute/path literal references. Unlike the previous page-only tool, it also scans generator source, manifest text, i18n/catalogue data and documentation (when in these formats). Flags, crest SVGs and division art are explicitly marked as potentially generated/dynamically resolved, never deemed dead. Missing text matches for other assets are classified as requiring runtime/publication verification, not as removable.

**Limitations:** string matching is approximate, doesn't recognize computed paths, generated output not present on disk, network requests or DEV boundary manifests outside scanned formats; flags/source licenses and protected-debug publication checks must be reviewed prior to removal. This is not a delete list, and no source assets or hosting settings were changed. Two isolated tests exercise direct references, dynamic crest protections and read-only behavior. Final CI and actual file-by-file unused-resource classification remain separate.
