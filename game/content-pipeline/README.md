# Content pipeline: public-domain puzzle images

Step 1 of the puzzle game build (issue #93). Defines the rules for an image to enter the game and the validator that enforces them.

## Rules (block by default)

| Rule | Check |
|---|---|
| Created before 1931 | `creation_year` < 1931; `publication_year` < 1931 if set |
| Author died before 1926 | `creator.death_year` < 1926, unless `anonymous` |
| CC0 evidence | `rights.status = cc0`, source is an accepted CC0 museum, `license_text` states CC0, `license_evidence_url` set |
| Exception (narrow) | Only from `biodiversity_heritage_library`, with `exception.basis`, `approver`, `reviewed_on`. Reported as a warning |
| No identifiable real people | `rights.contains_identifiable_person` = false |
| No trademarks or logos | `rights.trademark_or_logo` = false |
| Resolution | short side ≥ 2048 px |
| Maps | `map.sovereignty_checked` = true (disputed-border maps are excluded) |
| Text | 40–150 words of English |
| Duplicates | no repeated sha256 or perceptual hash across the set (`check_duplicates`) |
| Reviewer | `reviewed_by` and `reviewed_on` always required |

Excluded by decision: NASA images (not used, even as an exception). Wikimedia is not a primary source.

## Accepted CC0 sources
The Met, Art Institute of Chicago, Cleveland Museum of Art, National Gallery of Art, Rijksmuseum, Smithsonian.

Note: the Met object API returns `isPublicDomain` but no license field. CC0 has to be evidenced with the Met's Open Access policy page (stored in `license_evidence_url`). The same applies to every source.

## Files
- `manifest.schema.json`: structure of one `manifest.json`.
- `validate_manifest.py`: business rules plus schema check. Run `python3 validate_manifest.py <manifest.json> ...`.
- `tests/test_validate_manifest.py`: 25 tests. Run `python3 -m pytest tests`.

## Not done yet
- The 30-image sample (The Met + AIC) is not complete. Only one real Met record (object 436535) was checked, to confirm the metadata fields. Image files and real hashes still need to be downloaded and checked.
- Approving the contact sheet (25 images per review) is a manual step for Paul.
- Legal review of the public-domain rule and the BHL exception before launch.
