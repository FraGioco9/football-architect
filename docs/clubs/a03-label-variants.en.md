# A03 club-label variants — non-operational provenance audit

This document preserves 41 approved-in-conversation **A03 display labels** that differ from the **A02 primary names** used in Football Architect competition standings. It does not authorize changing any primary name, canonical identity, abbreviation, official full name, or A03 record.

## Source precedence

- Primary names: `football_architect_A02_FINAL_320_APPROVED.csv` (`Club`), validated against `football_architect_CREST02_320_ANAGRAFICHE.csv` (`Approved short name (A02)`).
- A03 alternatives: `football_architect_A03_FINAL_320_APPROVED.csv` (`Club (A03 exact)`), validated against CREST-02 (`A03 club label (exact)`).
- Prior proposal for additional corroboration: `football_architect_CLUB-02_320_sigle.csv`; IT-02 in this old register (`AC Felsina Bologna` / `FEL`) is superseded by the reconciled `AC Rinascenti Bologna` / `RIN`.
- Permanent record key: countryId + clubId, here formatted as `CC-00`; no division allocations or positions participate in identity matching.
- All 41 entries concern club IDs 21–40: 2 ENG, 19 ES, 20 DE. These are label variants, **not** a new choice of primaryName.

## Exact variants

| Permanent ID | A02 primary name | A03 exact club label | A03 source status |
|---|---|---|---|
| ENG-21 | Lincoln Foundry | Lincoln Foundry FC | APPROVED IN CONVERSATION |
| ENG-37 | Severn Vale | Severn Vale FC | APPROVED IN CONVERSATION |
| ES-21 | CD Vega Alta | CD Vega Alta Murcia | APPROVED IN CONVERSATION |
| ES-22 | Atlético Salitre | CA Salitre Vigo | APPROVED IN CONVERSATION |
| ES-23 | UD Arga | UD Arga Pamplona | APPROVED IN CONVERSATION |
| ES-24 | CF Arlanzón | CF Arlanzón Burgos | APPROVED IN CONVERSATION |
| ES-25 | Atlético Bernesga | CA Bernesga León | APPROVED IN CONVERSATION |
| ES-26 | SD Ebro Claro | SD Ebro Claro Logroño | APPROVED IN CONVERSATION |
| ES-27 | CD Llanura | CD Llanura Albacete | APPROVED IN CONVERSATION |
| ES-28 | UD Palmeral | UD Palmeral Elche | APPROVED IN CONVERSATION |
| ES-29 | CF Dársena | CF Dársena Cartagena | APPROVED IN CONVERSATION |
| ES-30 | Atlético Campiña | CA Campiña Jerez | APPROVED IN CONVERSATION |
| ES-31 | CD Azahar | CD Azahar Castellón | APPROVED IN CONVERSATION |
| ES-32 | UE Miravent | UE Miravent Tarragona | APPROVED IN CONVERSATION |
| ES-33 | FC Onyar | FC Onyar Girona | APPROVED IN CONVERSATION |
| ES-34 | UD Guadiana | UD Guadiana Badajoz | APPROVED IN CONVERSATION |
| ES-35 | CP Encina | CP Encina Cáceres | APPROVED IN CONVERSATION |
| ES-36 | CF Marisma | CF Marisma Huelva | APPROVED IN CONVERSATION |
| ES-38 | Atlético Olivar | CA Olivar Jaén | APPROVED IN CONVERSATION |
| ES-39 | UE Segre | UE Segre Lleida | APPROVED IN CONVERSATION |
| ES-40 | CF Júcar | CF Júcar Cuenca | APPROVED IN CONVERSATION |
| DE-21 | SV Havelblick | Potsdamer Sportverein Havelblick | APPROVED IN CONVERSATION |
| DE-22 | VfL Backstein | Lübecker Verein für Leibesübungen Backstein | APPROVED IN CONVERSATION |
| DE-23 | SC Elbwarte | Magdeburger Sport-Club Elbwarte | APPROVED IN CONVERSATION |
| DE-24 | FC Krämerbrücke | Erfurter Fußballclub Krämerbrücke | APPROVED IN CONVERSATION |
| DE-25 | SV Saalebogen | Jenaer Sportverein Saalebogen | APPROVED IN CONVERSATION |
| DE-26 | SG Werkhof | Chemnitzer Sportgemeinschaft Werkhof | APPROVED IN CONVERSATION |
| DE-27 | FV Salzbrücke | Hallescher Fußballverein Salzbrücke | APPROVED IN CONVERSATION |
| DE-28 | VfB Leinenfeld | Bielefelder Verein für Bewegungsspiele Leinenfeld | APPROVED IN CONVERSATION |
| DE-29 | SV Hasewiese | Osnabrücker Sportverein Hasewiese | APPROVED IN CONVERSATION |
| DE-30 | FC Löwentor | Braunschweiger Fußballclub Löwentor | APPROVED IN CONVERSATION |
| DE-31 | SC Fuldahain | Kasseler Sport-Club Fuldahain | APPROVED IN CONVERSATION |
| DE-32 | FV Quellenhof | Wiesbadener Fußballverein Quellenhof | APPROVED IN CONVERSATION |
| DE-33 | SV Mathildenhöhe | Darmstädter Sportverein Mathildenhöhe | APPROVED IN CONVERSATION |
| DE-34 | FC Rheinwacht | Koblenzer Fußballclub Rheinwacht | APPROVED IN CONVERSATION |
| DE-35 | SV Moselstein | Trierer Sportverein Moselstein | APPROVED IN CONVERSATION |
| DE-36 | FC Stahlquell | Saarbrücker Fußballclub Stahlquell | APPROVED IN CONVERSATION |
| DE-37 | SG Kohlenhain | Aachener Sportgemeinschaft Kohlenhain | APPROVED IN CONVERSATION |
| DE-38 | SV Schwebetal | Wuppertaler Sportverein Schwebetal | APPROVED IN CONVERSATION |
| DE-39 | VfL Kumpelfeld | Bochumer Verein für Leibesübungen Kumpelfeld | APPROVED IN CONVERSATION |
| DE-40 | FC Donauwerk | Regensburger Fußballclub Donauwerk | APPROVED IN CONVERSATION |

## Acceptance rule

Keep the `data/clubs.json` identity fields immutable. `approvedShortName` on six explicitly reconciled records takes precedence over every other source. Competition pages use A02 primary names; A03 labels remain in this audit only. Reopen this decision explicitly before promoting any A03 variant to the UI.
