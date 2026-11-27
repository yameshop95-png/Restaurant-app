"""Tests for validate_manifest.py.

BASE uses real metadata from The Met Open Access API for object 436535
(Vincent van Gogh, "Wheat Field with Cypresses", 1889; retrieved 2026-11-27).
The image hashes are placeholders: the image file is not downloaded yet,
so these tests cover rule logic only, not image processing.
"""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from validate_manifest import check_duplicates, validate  # noqa: E402

TEXT_60_WORDS = " ".join(
    ["Van Gogh painted this field in the summer of 1889, while he was staying at the asylum in Saint-Remy."]
    * 4
)  # 4 sentences of 17 words each: 68 words, inside the 40-150 range

BASE = {
    "image_id": "lan-001",
    "theme": "landscapes",
    "level": 1,
    "title": "Wheat Field with Cypresses",
    "creator": {"name": "Vincent van Gogh", "anonymous": False, "death_year": 1890},
    "creation_year": 1889,
    "publication_year": None,
    "source": {
        "institution": "the_met",
        "object_url": "https://www.metmuseum.org/art/collection/search/436535",
        "record_id": "436535",
        "license_text": "CC0 1.0 (The Met Open Access policy)",
        "license_evidence_url": "https://www.metmuseum.org/about-the-met/policies-and-documents/open-access",
        "retrieved_on": "2026-11-27",
    },
    "rights": {
        "status": "cc0",
        "contains_identifiable_person": False,
        "trademark_or_logo": False,
    },
    "image": {
        "file": "images/lan-001.jpg",
        "sha256": "0" * 64,
        "short_side_px": 2400,
        "phash": "0" * 16,
        "flat_color_ratio": 0.2,
    },
    "text": {"en": TEXT_60_WORDS},
    "reviewed_by": "reviewer-1",
    "reviewed_on": "2026-11-27",
}


def make(**changes):
    m = copy.deepcopy(BASE)
    for path, value in changes.items():
        keys = path.split("__")
        target = m
        for k in keys[:-1]:
            target = target[k]
        if value is _DELETE:
            del target[keys[-1]]
        else:
            target[keys[-1]] = value
    return m


_DELETE = object()


class ValidateTests(unittest.TestCase):
    def assertError(self, manifest, fragment):
        res = validate(manifest)
        self.assertFalse(res.ok, "expected failure")
        self.assertTrue(
            any(fragment in e for e in res.errors),
            f"no error containing {fragment!r}: {res.errors}",
        )

    def test_valid_cc0_manifest_passes(self):
        res = validate(copy.deepcopy(BASE))
        self.assertTrue(res.ok, res.errors)
        self.assertEqual(res.warnings, [])

    def test_creation_year_after_cutoff_fails(self):
        self.assertError(make(creation_year=1931), "creation_year")

    def test_publication_year_after_cutoff_fails(self):
        self.assertError(make(publication_year=1935), "publication_year")

    def test_author_died_after_1926_fails(self):
        self.assertError(make(creator__death_year=1940), "death_year")

    def test_missing_author_death_year_fails(self):
        self.assertError(make(creator__death_year=_DELETE), "death_year")

    def test_anonymous_author_without_death_year_passes(self):
        m = make(creator__anonymous=True, creator__death_year=_DELETE)
        self.assertTrue(validate(m).ok)

    def test_license_without_cc0_fails(self):
        self.assertError(make(source__license_text="All rights reserved"), "CC0")

    def test_unknown_institution_fails_for_cc0(self):
        self.assertError(make(source__institution="wikimedia_commons"), "accepted CC0")

    def test_nasa_cannot_use_exception(self):
        m = make(
            rights__status="public_domain_exception",
            source__institution="nasa",
            exception={"basis": "US federal work", "approver": "reviewer-1", "reviewed_on": "2026-11-27"},
        )
        self.assertError(m, "exceptions are not allowed from 'nasa'")

    def test_bhl_exception_with_basis_passes_and_warns(self):
        m = make(
            rights__status="public_domain_exception",
            source__institution="biodiversity_heritage_library",
            exception={"basis": "Illustrator died 1880; published 1850", "approver": "reviewer-1", "reviewed_on": "2026-11-27"},
        )
        res = validate(m)
        self.assertTrue(res.ok, res.errors)
        self.assertTrue(any(w.startswith("EXCEPTION") for w in res.warnings))

    def test_exception_without_block_fails(self):
        m = make(
            rights__status="public_domain_exception",
            source__institution="biodiversity_heritage_library",
        )
        self.assertError(m, "requires an exception block")

    def test_exception_block_on_cc0_fails(self):
        m = make(exception={"basis": "x", "approver": "y", "reviewed_on": "2026-11-27"})
        self.assertError(m, "exception block present")

    def test_identifiable_person_blocks(self):
        self.assertError(make(rights__contains_identifiable_person=True), "identifiable real person")

    def test_trademark_blocks(self):
        self.assertError(make(rights__trademark_or_logo=True), "trademark")

    def test_small_image_fails(self):
        self.assertError(make(image__short_side_px=1500), "short side")

    def test_map_without_sovereignty_check_fails(self):
        m = make(theme="maps", map={"sovereignty_checked": False})
        self.assertError(m, "sovereignty_checked")

    def test_map_missing_map_block_fails_schema(self):
        m = make(theme="maps")
        res = validate(m)
        self.assertFalse(res.ok)

    def test_text_too_short_fails(self):
        self.assertError(make(text__en="Too short."), "words")

    def test_text_too_long_fails(self):
        self.assertError(make(text__en=" ".join(["word"] * 200)), "words")

    def test_bad_sha256_fails_schema(self):
        self.assertError(make(image__sha256="XYZ"), "schema")

    def test_unknown_field_fails_schema(self):
        self.assertError(make(extra_field="x"), "schema")

    def test_invalid_theme_fails_schema(self):
        self.assertError(make(theme="nasa_photos"), "schema")


class DuplicateTests(unittest.TestCase):
    def test_same_phash_is_reported(self):
        a = make(image_id="lan-001")
        b = make(image_id="lan-002", image__sha256="1" * 64)
        errors = check_duplicates([a, b])
        self.assertTrue(any("same phash" in e for e in errors))

    def test_same_sha256_is_reported(self):
        a = make(image_id="lan-001")
        b = make(image_id="lan-002", image__phash="f" * 16)
        errors = check_duplicates([a, b])
        self.assertTrue(any("same sha256" in e for e in errors))

    def test_distinct_images_pass(self):
        a = make(image_id="lan-001")
        b = make(image_id="lan-002", image__sha256="1" * 64, image__phash="f" * 16)
        self.assertEqual(check_duplicates([a, b]), [])


if __name__ == "__main__":
    unittest.main()
