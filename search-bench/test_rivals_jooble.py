"""Guards the Jooble rival (owner, 12 Nov 2026): per-country keys from one JSON secret, no key in an error, a missing key is a failure (never "not served", never 0).
Run: python3 -m unittest search-bench/test_rivals_jooble.py. A fake `post` stands in for Jooble's API: no network."""
import io
import os
import sys
import unittest
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rivals  # noqa: E402

DE = {'title': 'Data Analyst', 'city': 'Nuremberg', 'country': 'Germany'}
KEYS = '{"de": "SECRET-DE-KEY", "pl": "SECRET-PL-KEY"}'


def jobs(n, start=0):
    return [{'title': f'Job {start + i}', 'company': 'Co', 'location': 'Nürnberg', 'link': 'https://x'} for i in range(n)]


class JoobleRival(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.real_post, self.real_env = rivals.post, os.environ.get('JOOBLE_API_KEYS')
        os.environ['JOOBLE_API_KEYS'] = KEYS

    def tearDown(self):
        rivals.post = self.real_post
        if self.real_env is None:
            os.environ.pop('JOOBLE_API_KEYS', None)
        else:
            os.environ['JOOBLE_API_KEYS'] = self.real_env

    def fake(self, pages):
        def post(url, body):
            self.calls.append((url, body))
            return {'totalCount': 120, 'jobs': pages[len(self.calls) - 1] if len(self.calls) <= len(pages) else []}
        rivals.post = post

    def test_uses_the_countrys_own_domain_and_key_and_the_pool_row_shape(self):
        self.fake([jobs(3)])
        rows = rivals.jooble(DE)
        self.assertEqual(self.calls[0][0], 'https://de.jooble.org/api/SECRET-DE-KEY')
        self.assertEqual((self.calls[0][1]['keywords'], self.calls[0][1]['location']), ('Data Analyst', 'Nuremberg'))
        self.assertEqual(rows[0], {'tool': 'jooble', 'title': 'Job 0', 'company': 'Co', 'location': 'Nürnberg', 'provider': 'Jooble', 'found': 120})
        self.assertEqual(len(rows), 3)

    def test_keeps_the_first_100_and_stops_asking(self):
        self.fake([jobs(50), jobs(50, 50), jobs(50, 100)])
        rows = rivals.jooble(DE)
        self.assertEqual(len(rows), 100)
        self.assertEqual(len(self.calls), 2, 'no third call once 100 are kept')

    def test_a_short_page_ends_the_search(self):
        self.fake([jobs(10), jobs(10, 10)])
        self.assertEqual(len(rivals.jooble(DE)), 10)
        self.assertEqual(len(self.calls), 1)

    def test_a_country_jooble_has_no_domain_for_is_not_served(self):
        self.fake([])
        self.assertIsNone(rivals.jooble({'title': 'x', 'city': 'Oslo', 'country': 'Norway'}))
        self.assertEqual(self.calls, [])

    def test_a_missing_key_is_a_named_failure_not_a_zero(self):
        self.fake([])
        with self.assertRaisesRegex(RuntimeError, 'no key for fi'):
            rivals.jooble({'title': 'x', 'city': 'Helsinki', 'country': 'Finland'})
        self.assertEqual(self.calls, [])

    def test_an_http_error_never_carries_the_key(self):
        def boom(url, body):
            raise urllib.error.HTTPError(url, 429, 'Too Many Requests', {}, io.BytesIO(b''))
        rivals.post = boom
        with self.assertRaises(RuntimeError) as cm:
            rivals.jooble(DE)
        self.assertIn('HTTP 429', str(cm.exception))
        self.assertNotIn('SECRET', str(cm.exception))
        self.assertIsNone(cm.exception.__cause__)

    def test_every_persona_country_has_a_domain(self):
        import json
        countries = {p['country'] for p in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'personas.json')))['personas']}
        self.assertEqual(countries - set(rivals.JOOBLE), set())


if __name__ == '__main__':
    unittest.main()
