# Competition History data

This directory is the planned canonical source for approved historical competition results. It is a **data scaffold only**: it currently contains no historical results.

## Layout
- `index.json` lists all 16 competitions and their data-availability status.
- `competitions/<competition-id>.json` holds all seasons for one competition.
- `coverage-matrix.csv` tracks the audit status of each candidate competition/season pair.
- `SOURCE-AUDIT.md` documents inspected sources and unresolved prerequisites.
- Use stable competition and club IDs. Resolve display names and crests from canonical catalogues instead of copying them into historical rows.

## Season contract
A verified season entry should follow this shape:

```json
{
  "seasonId": 1,
  "status": "completed",
  "dataStatus": "approved",
  "provenance": {"kind": "canonical", "source": "approved source reference"},
  "standings": [
    {
      "clubId": 1, "position": 1, "played": 30,
      "won": 20, "drawn": 6, "lost": 4,
      "goalsFor": 58, "goalsAgainst": 24, "points": 66
    }
  ]
}
```

The example values are illustrative only, not Football Architect results.

## Status and validation rules
- `dataStatus: "unavailable"` means no approved source data is currently present.
- Public History may consume only completed, approved seasons that pass validation.
- Missing seasons are not represented as empty or zero-valued standings.
- Fictional local DEV results from `tools/dev-standings-preview-data.mjs` must never be imported as canonical history.
- Validate competition and club IDs against approved canonical sources; historical membership may differ from current membership.
- Season IDs must be unique per competition. Final tables must not duplicate clubs or positions and must use non-negative integer statistics.
- Enforce `played = won + drawn + lost`; derive goal difference from goals for/against.
- Points, ranking and tie-breaks must match the rules applicable to that season.
- Provenance and approval are required before publication.
- Derive three records only from approved completed tables: most league titles, most podium finishes (top-three finishes), and most consecutive league titles.
- If coverage is incomplete, do not label all-time records definitive without disclosing the coverage limitation.

## Current limitations
The repository audit found no authoritative final standings or match-result datasets for Seasons 1–4. The current competition manifest is marked `approved: false`. This scaffold does not approve the manifest or any historical data and does not alter runtime behavior.

Before adding season rows, establish approved competition/club identity sources and traceable historical results.
