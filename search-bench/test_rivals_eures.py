"""Guards EURES as a rival of the extra Trello profiles (13 Nov 2026, sa for the owner): a city EURES has no area for (Chisinau, Moldova) is "not served" (None), never an empty list that reads as 0;
every extra profile's city is either in REGIONS or named here as outside EURES. Run: python3 -m unittest search-bench/test_rivals_eures.py. No network."""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rivals  # noqa: E402

OUTSIDE_EURES = {'Chisinau'}


class EuresServes(unittest.TestCase):
    def test_a_city_outside_eures_is_not_served_never_zero(self):
        self.assertIsNone(rivals.eures({'title': 'Programmer', 'city': 'Chisinau', 'country': 'Moldova'}))

    def test_every_extra_profile_city_has_an_area_or_is_named_outside(self):
        for p in json.load(open(os.path.join(HERE, 'personas-extra.json')))['personas']:
            self.assertTrue(p['city'] in rivals.REGIONS or p['city'] in OUTSIDE_EURES, f"{p['id']} {p['city']}: add its NUTS-3 area to REGIONS or name it outside EURES")

    def test_area_codes_look_like_nuts3_of_their_country(self):
        for city, (code, name) in rivals.REGIONS.items():
            self.assertRegex(code, r'^[a-z]{2}[0-9a-z]{3}$', city)
            self.assertTrue(name, city)


if __name__ == '__main__':
    unittest.main()
