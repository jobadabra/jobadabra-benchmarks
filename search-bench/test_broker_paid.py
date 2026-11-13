"""Guards the paid-lane marker (13 Nov 2026, sa for the owner): the broker's reply may say `paid: true`; the benchmark reads it defensively (absent or not exactly true = not paid) and the judge counts the batches.
Run: python3 -I search-bench/test_broker_paid.py. Fake poster and opener: no network."""
import io
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import broker  # noqa: E402
import judge  # noqa: E402

ENV = {'ACTIONS_ID_TOKEN_REQUEST_URL': 'https://token.invalid/?a=1', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN': 't'}


def ask_with(reply):
    poster = lambda url, headers, body: io.BytesIO(json.dumps(reply).encode())
    opener = lambda url, headers: io.BytesIO(json.dumps({'value': 'jwt'}).encode())
    return broker.ask('p', env=ENV, poster=poster, opener=opener)


class PaidLane(unittest.TestCase):
    def test_paid_is_true_only_when_the_reply_says_true(self):
        base = {'reply': 'ok', 'model': 'm', 'engine': 'claude'}
        self.assertIs(ask_with({**base, 'paid': True})['paid'], True)
        self.assertIs(ask_with(base)['paid'], False, 'absent = not paid')
        self.assertIs(ask_with({**base, 'paid': 'true'})['paid'], False, "a string is not the broker's marker")

    def test_the_judge_counts_paid_batches(self):
        calls = []

        def ask(key, profile, jobs):
            calls.append(1)
            return {j['n']: {'n': j['n'], 'role': 'yes', 'place': 'yes'} for j in jobs}, {'input_tokens': 0, 'output_tokens': 0, 'paid': len(calls) == 1}
        persona = {'title': 'Nurse', 'city': 'Town', 'country': 'Land', 'language': 'L'}
        pool = [{'tool': 'ours', 'title': f'N{i}', 'company': 'C', 'location': 'T'} for i in range(judge.BATCH + 1)]
        _rows, _count, tokens, _cost = judge.judge(persona, 1, pool, '/nonexistent/ledger.json', ask, plan=True)
        self.assertEqual((len(calls), tokens[2]), (2, 1), 'two batches, one of them paid')


if __name__ == '__main__':
    unittest.main()
