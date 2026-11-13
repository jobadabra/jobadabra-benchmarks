"""Guards the judge's reading of the model's reply (run 43314316021, 12 Nov 2026: 'JSONDecodeError: Extra data' on person 10 through the broker). Run: python3 -m unittest search-bench/test_judge_parse.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import judge  # noqa: E402

VERDICT = '{"jobs": [{"n": 1, "role": "yes", "place": "yes"}]}'


class ParseJobs(unittest.TestCase):
    def test_plain_object(self):
        self.assertEqual(judge.parse_jobs(VERDICT)['jobs'][0]['n'], 1)

    def test_text_and_a_second_object_after_the_verdict(self):   # the failing shape: the old greedy regex ran to the last brace
        self.assertEqual(judge.parse_jobs(VERDICT + '\n\nNote: I used {place} loosely.\n{"extra": 1}')['jobs'][0]['n'], 1)

    def test_prose_with_braces_before_the_verdict_and_a_code_fence(self):
        self.assertEqual(judge.parse_jobs('Here {is} the answer:\n```json\n' + VERDICT + '\n```')['jobs'][0]['n'], 1)

    def test_an_object_without_jobs_is_skipped(self):
        self.assertEqual(judge.parse_jobs('{"note": 1} ' + VERDICT)['jobs'][0]['n'], 1)

    def test_no_verdict_says_what_the_reply_ended_with(self):
        with self.assertRaisesRegex(ValueError, 'no JSON object with a "jobs" list.*ends'):
            judge.parse_jobs('I cannot judge these.')


if __name__ == '__main__':
    unittest.main()
