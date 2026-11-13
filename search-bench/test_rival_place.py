"""Guards the rivals' one place for a persona with an area (13 Nov 2026, owner via sa: d07 "If we have to choose just one. Let's choose Lausanne"; d06 "the entire Switzerland" has no town chosen):
the rivals search the rival_place, an area without one is not searched (None + reason), and a persona without an area is searched as it is. Run: python3 -I search-bench/test_rival_place.py. No network."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rivals  # noqa: E402

BASE = {'title': 'IT Project Manager', 'city': 'Monthey', 'country': 'Switzerland', 'language': 'French'}


class RivalPlace(unittest.TestCase):
    def test_an_area_is_searched_at_its_rival_place(self):
        searched, why = rivals.rival_persona({**BASE, 'area': 'within 100 km of Monthey', 'rival_place': 'Lausanne'})
        self.assertEqual((searched['city'], searched['title'], why), ('Lausanne', 'IT Project Manager', None))

    def test_an_area_without_a_rival_place_is_not_searched_never_a_guessed_town(self):
        searched, why = rivals.rival_persona({**BASE, 'area': 'anywhere in Switzerland'})
        self.assertIsNone(searched)
        self.assertIn('no rival_place', why)

    def test_a_persona_without_an_area_is_searched_as_it_is(self):
        searched, why = rivals.rival_persona(BASE)
        self.assertIs(searched, BASE)
        self.assertIsNone(why)

    def test_lausanne_has_a_eures_area(self):
        self.assertIn('Lausanne', rivals.REGIONS)

    def test_every_extra_persona_with_an_area_has_a_rival_place_or_is_named_here(self):
        import json
        for p in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'personas-extra.json')))['personas']:
            if p.get('area'):
                self.assertTrue(p.get('rival_place') or p['id'] == 'd06', f"{p['id']}: an area needs a rival_place (d06's is not chosen yet)")


if __name__ == '__main__':
    unittest.main()
