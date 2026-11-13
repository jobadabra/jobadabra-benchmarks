"""Guards the judge's profile line for a persona with an `area` (13 Nov 2026, owner via sa: d07 "Monthey + 100km"): the area is said in the title, a persona without one gets the line it always had.
Run: python3 -I search-bench/test_judge_area.py. A fake asker stands in for the AI: no network."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import judge  # noqa: E402

POOL = [{'tool': 'ours', 'title': 'IT Project Manager', 'company': 'Example AG', 'location': 'Geneva'}]


def profile_line(persona):
    seen = []

    def ask(key, profile, jobs):
        seen.append(profile)
        return {j['n']: {'n': j['n'], 'role': 'yes', 'place': 'yes'} for j in jobs}, {'input_tokens': 0, 'output_tokens': 0, 'paid': False, 'usd': 0.0}
    judge.judge(persona, 1, [dict(r) for r in POOL], '/nonexistent/ledger.json', ask, plan=True)
    return seen[0]


class AreaInTheProfileLine(unittest.TestCase):
    base = {'title': 'IT Project Manager', 'city': 'Monthey', 'country': 'Switzerland', 'language': 'French'}

    def test_an_area_is_in_the_title(self):
        line = profile_line({**self.base, 'area': 'within 100 km of Monthey, including Geneva'})
        self.assertEqual(line, 'Profile: IT Project Manager (willing to work within 100 km of Monthey, including Geneva), 6 years of experience, living in Monthey, Switzerland; on-site or hybrid; speaks French and English.')

    def test_a_persona_without_an_area_gets_the_line_it_always_had(self):
        self.assertEqual(profile_line(self.base), 'Profile: IT Project Manager, 6 years of experience, living in Monthey, Switzerland; on-site or hybrid; speaks French and English.')


if __name__ == '__main__':
    unittest.main()
