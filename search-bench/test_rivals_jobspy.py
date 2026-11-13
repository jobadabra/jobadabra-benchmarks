"""Guards the JobSpy rival for a country Indeed's list lacks (13 Nov 2026, run 43432473083, c09 Tallinn): LinkedIn and Google still run, Indeed and Glassdoor stay a named error, never a silent 0.
Run: python3 -m unittest search-bench/test_rivals_jobspy.py. A fake `jobspy` module stands in for the sites: no network."""
import os
import sys
import types
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rivals  # noqa: E402


class Frame:
    def __init__(self, n):
        self.n = n

    def iterrows(self):
        return iter([(i, {'title': f'Job {i}', 'company': 'Co', 'location': 'Tallinn'}) for i in range(self.n)])


class JobSpyUnsupportedCountry(unittest.TestCase):
    def test_linkedin_and_google_run_without_the_indeed_country(self):
        def scrape_jobs(**kw):
            if 'country_indeed' in kw:
                raise ValueError("Invalid country_indeed: 'estonia'")
            return Frame(2)
        sys.modules['jobspy'] = types.SimpleNamespace(scrape_jobs=scrape_jobs)
        try:
            rows, errors = rivals.jobspy({'title': 'Hotel Receptionist', 'city': 'Tallinn', 'country': 'Estonia'})
        finally:
            del sys.modules['jobspy']
        self.assertEqual(len(rows), 4, 'LinkedIn and Google gave 2 each')
        self.assertEqual(sorted(errors), ['glassdoor', 'indeed'])
        self.assertEqual(sorted({r['provider'] for r in rows}), ['JobSpy/google', 'JobSpy/linkedin'])


if __name__ == '__main__':
    unittest.main()
