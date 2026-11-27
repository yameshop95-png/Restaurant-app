"""Validator for puzzle image manifests.

Blocks by default: any rule failure makes the image invalid.
Exceptions are allowed only from EXCEPTION_SOURCES and only with a
`basis`, an `approver` and a review date. They are reported as warnings
so that every exception stays visible in review.

Usage:
    python validate_manifest.py path/to/manifest.json [...]
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

from jsonschema import Draft202012Validator

SCHEMA_PATH = Path(__file__).with_name("manifest.schema.json")
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

# Public-domain cutoffs (US rule for 2026: works published through 1930).
CUTOFF_YEAR = 1931  # creation and publication year must be < 1931
AUTHOR_DEATH_CUTOFF = 1926  # author must have died before 1926
MIN_SHORT_SIDE_PX = 2048
TEXT_MIN_WORDS = 40
TEXT_MAX_WORDS = 150

# Institutions whose CC0 image policy is accepted as evidence.
CC0_SOURCES = {
    "the_met",
    "art_institute_of_chicago",
    "cleveland_museum_of_art",
    "national_gallery_of_art",
    "rijksmuseum",
    "smithsonian",
}
# Sources allowed to use a documented public-domain exception.
EXCEPTION_SOURCES = {"biodiversity_heritage_library"}


@dataclass
class Result:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def validate(manifest: dict) -> Result:
    res = Result()

    # 1. Structure first; business rules need a well-formed manifest.
    for err in sorted(Draft202012Validator(SCHEMA).iter_errors(manifest), key=str):
        loc = "/".join(str(p) for p in err.path) or "<root>"
        res.errors.append(f"schema: {loc}: {err.message}")
    if res.errors:
        return res

    src = manifest["source"]
    rights = manifest["rights"]
    creator = manifest["creator"]
    img = manifest["image"]
    words = len(manifest["text"]["en"].split())

    # 2. Dates: created and published before the cutoff.
    if manifest["creation_year"] >= CUTOFF_YEAR:
        res.errors.append(
            f"date: creation_year {manifest['creation_year']} is not before {CUTOFF_YEAR}"
        )
    pub = manifest.get("publication_year")
    if pub is not None and pub >= CUTOFF_YEAR:
        res.errors.append(f"date: publication_year {pub} is not before {CUTOFF_YEAR}")

    # 3. Author must have died before the cutoff (unless anonymous).
    if not creator["anonymous"]:
        death = creator.get("death_year")
        if death is None:
            res.errors.append("creator: death_year required unless anonymous")
        elif death >= AUTHOR_DEATH_CUTOFF:
            res.errors.append(
                f"creator: death_year {death} is not before {AUTHOR_DEATH_CUTOFF}"
            )

    # 4. Rights status.
    if rights["status"] == "cc0":
        if src["institution"] not in CC0_SOURCES:
            res.errors.append(
                f"source: institution '{src['institution']}' is not an accepted CC0 source"
            )
        if "cc0" not in src["license_text"].lower():
            res.errors.append("source: license_text does not state CC0")
        if "exception" in manifest:
            res.errors.append("rights: exception block present but status is cc0")
    else:  # public_domain_exception
        if src["institution"] not in EXCEPTION_SOURCES:
            res.errors.append(
                f"rights: exceptions are not allowed from '{src['institution']}'"
            )
        exc = manifest.get("exception")
        if exc is None:
            res.errors.append("rights: exception status requires an exception block")
        else:
            res.warnings.append(
                f"EXCEPTION: {exc['basis']} (approved by {exc['approver']})"
            )

    # 5. Rights risks that always block.
    if rights["contains_identifiable_person"]:
        res.errors.append("rights: identifiable real person in image")
    if rights["trademark_or_logo"]:
        res.errors.append("rights: trademark or logo in image")

    # 6. Image quality.
    if img["short_side_px"] < MIN_SHORT_SIDE_PX:
        res.errors.append(
            f"image: short side {img['short_side_px']}px is below {MIN_SHORT_SIDE_PX}px"
        )

    # 7. Maps need a sovereignty check.
    if manifest["theme"] == "maps" and not manifest["map"]["sovereignty_checked"]:
        res.errors.append("map: sovereignty_checked must be true for maps")

    # 8. Text length.
    if not TEXT_MIN_WORDS <= words <= TEXT_MAX_WORDS:
        res.errors.append(
            f"text: {words} words, expected {TEXT_MIN_WORDS}-{TEXT_MAX_WORDS}"
        )

    return res


def check_duplicates(manifests: list[dict]) -> list[str]:
    """Report images whose perceptual hash or sha256 collides with another."""
    errors: list[str] = []
    seen_phash: dict[str, str] = {}
    seen_sha: dict[str, str] = {}
    for m in manifests:
        iid = m.get("image_id", "?")
        ph = m.get("image", {}).get("phash")
        sh = m.get("image", {}).get("sha256")
        if ph:
            if ph in seen_phash:
                errors.append(f"duplicate: {iid} has same phash as {seen_phash[ph]}")
            else:
                seen_phash[ph] = iid
        if sh:
            if sh in seen_sha:
                errors.append(f"duplicate: {iid} has same sha256 as {seen_sha[sh]}")
            else:
                seen_sha[sh] = iid
    return errors


def main(paths: list[str]) -> int:
    failed = 0
    for p in paths:
        manifest = json.loads(Path(p).read_text(encoding="utf-8"))
        res = validate(manifest)
        status = "PASS" if res.ok else "FAIL"
        print(f"{status} {p}")
        for e in res.errors:
            print(f"  error: {e}")
        for w in res.warnings:
            print(f"  warning: {w}")
        failed += 0 if res.ok else 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
