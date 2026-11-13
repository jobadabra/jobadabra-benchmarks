"""Guards the EURES rival's place (Gitar on benchmarks#12, 2 Nov 2026): a job in another town of the same NUTS-2 region must not be kept, and each kept row's place is built from its own codes.
Run: python3 -m unittest search-bench/test_rivals_eures.py. A fake `post` stands in for the EURES API: no network."""
import json
import os
import subprocess
import sys
import tempfile
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


class ExtraProfileCities(unittest.TestCase):
    """Why (13 Nov 2026, sa for the owner: EURES as a rival of the extra Trello profiles; Gitar on #39): the main round's 10 cities behave as before, the new ones are never a guessed 0."""

    def with_post(self, person, answer):
        real, rivals.post = rivals.post, answer
        try:
            return rivals.eures(person)
        finally:
            rivals.post = real

    def test_a_country_outside_eures_is_not_served_never_zero(self):
        self.assertIsNone(rivals.eures({'title': 'Programmer', 'city': 'Chisinau', 'country': 'Moldova'}))

    def test_an_unknown_city_inside_eures_fails_by_name(self):
        with self.assertRaises(KeyError):
            rivals.eures({'title': 'Chef', 'city': 'Atlantis', 'country': 'Spain'})

    def test_an_unverified_code_that_returns_no_job_of_its_area_is_unknown_not_zero(self):
        amsterdam = {'title': 'Accountant', 'city': 'Amsterdam', 'country': 'Netherlands'}
        elsewhere = lambda url, body: {'numberRecords': 1, 'jvs': [{'title': 'Far', 'employer': {'name': 'Co'}, 'locationMap': {'NL': ['NL411']}}]}
        self.assertIsNone(self.with_post(amsterdam, elsewhere))
        self.assertEqual(self.with_post(amsterdam, lambda url, body: {'numberRecords': 0, 'jvs': []}), None)

    def test_an_unverified_code_that_returns_jobs_keeps_them(self):
        amsterdam = {'title': 'Accountant', 'city': 'Amsterdam', 'country': 'Netherlands'}
        rows = self.with_post(amsterdam, lambda url, body: {'numberRecords': 1, 'jvs': [{'title': 'In town', 'employer': {'name': 'Co'}, 'locationMap': {'NL': ['NL329']}}]})
        self.assertEqual([r['title'] for r in rows], ['In town'])

    def test_a_verified_city_with_no_job_in_its_area_is_still_a_real_zero(self):
        # the main round's behaviour does not change (test_no_job_at_all_is_zero_not_unknown, for Sofia)
        self.assertEqual(self.with_post({'title': 'Chef', 'city': 'Sofia', 'country': 'Bulgaria'}, lambda url, body: {'numberRecords': 1, 'jvs': [job('Elsewhere', ['BG413'])]}), [])

    def test_every_extra_profile_city_has_an_area_or_is_outside_eures(self):
        for p in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'personas-extra.json')))['personas']:
            self.assertTrue(p['city'] in rivals.REGIONS or p['country'] in rivals.OUTSIDE_EURES, f"{p['id']} {p['city']}: add its NUTS-3 area to REGIONS or name its country outside EURES")

    def test_area_codes_look_like_nuts3_of_their_country_and_unverified_ones_have_one(self):
        for city, (code, name) in rivals.REGIONS.items():
            self.assertRegex(code, r'^[a-z]{2}([0-9a-z]{3})?$', city)   # a NUTS-3 code, or the country's own code for a rival place that is the whole country
        self.assertLessEqual(rivals.UNVERIFIED, set(rivals.REGIONS))


class NotServed(unittest.TestCase):
    def test_a_country_adzuna_does_not_serve_is_written_as_null_never_an_empty_list(self):
        # Why (2 Nov 2026, coordinator on benchmarks#14): [] reads as "found 0"; null is unknown (pool.mjs lists it as missing). No network: Adzuna refuses before any call.
        here = os.path.dirname(os.path.abspath(__file__))
        with tempfile.TemporaryDirectory() as folder:
            personas = os.path.join(folder, 'personas.json')
            json.dump({'personas': [{'title': 'Nurse', 'city': 'Sofia', 'country': 'Bulgaria'}]}, open(personas, 'w'))
            out = os.path.join(folder, 'adzuna-p1.json')
            subprocess.run([sys.executable, '-I', os.path.join(here, 'rivals.py'), 'adzuna', personas, '1', out], check=True, capture_output=True)
            self.assertIsNone(json.load(open(out)))
            self.assertTrue(json.load(open(out.replace('.json', '.meta.json')))['notServed'])


if __name__ == '__main__':
    unittest.main()
