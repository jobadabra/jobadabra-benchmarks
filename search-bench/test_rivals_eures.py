"""Guards the EURES rival's place (Gitar on benchmarks#12, 2 Nov 2026): a job in another town of the same NUTS-2 region must not be kept, and each kept row's place is built from its own codes.
Run: python3 -m unittest search-bench/test_rivals_eures.py. A fake `post` stands in for the EURES API: no network."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rivals  # noqa: E402

SOFIA = {'title': 'Truck Driver', 'city': 'Sofia', 'country': 'Bulgaria'}


def job(title, codes):
    return {'title': title, 'employer': {'name': 'Co'}, 'locationMap': {'BG': codes}}


class EuresPlace(unittest.TestCase):
    def run_eures(self, jobs):
        calls = []

        def fake(url, body):
            calls.append(body)
            return {'numberRecords': len(jobs), 'jvs': jobs}
        real, rivals.post = rivals.post, fake
        try:
            return rivals.eures(SOFIA)
        finally:
            rivals.post = real

    def test_other_town_of_the_same_region_is_dropped(self):
        rows = self.run_eures([job('In Sofia', ['BG411']), job('In Blagoevgrad', ['BG413'])])
        self.assertEqual([r['title'] for r in rows], ['In Sofia'])

    def test_place_is_built_from_the_rows_own_codes(self):
        rows = self.run_eures([job('In Sofia', ['BG411', 'BG413'])])
        self.assertIn('BG411', rows[0]['location'])
        self.assertNotIn('BG413', rows[0]['location'])
        self.assertTrue(rows[0]['location'].startswith('Sofia area ('))

    def test_region_only_codes_are_not_measured_never_zero(self):
        # Krakow (2 Nov 2026, coordinator): rows carrying only PL21 do not say which town, so the result is unknown (None), not an empty list.
        krakow = {'title': 'Chef', 'city': 'Krakow', 'country': 'Poland'}
        real, rivals.post = rivals.post, lambda url, body: {'numberRecords': 2, 'jvs': [job('Chef', ['PL21']), job('Cook', ['PL21'])]}
        try:
            self.assertIsNone(rivals.eures(krakow))
        finally:
            rivals.post = real

    def test_a_region_only_job_beside_an_in_area_job_keeps_the_in_area_one(self):
        rows = self.run_eures([job('Region only', ['BG41']), job('In Sofia', ['BG411'])])
        self.assertEqual([r['title'] for r in rows], ['In Sofia'])

    def test_no_job_at_all_is_zero_not_unknown(self):
        self.assertEqual(self.run_eures([job('Elsewhere', ['BG413'])]), [])


if __name__ == '__main__':
    unittest.main()
