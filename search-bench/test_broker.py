"""The AI broker client (broker.py) and the judge's broker engine: fake HTTP only, no token, no call. Run: python3 -m unittest search-bench/test_broker.py
Cases: the run token is asked for the broker's audience; no OIDC env says so; a gateway error on the token is asked once more; the call carries tier, engine claude, only; an answer without text, a refusal with its reason,
a 5xx without a reason (one retry) and a refusal with one (none); the judge's verdicts come out of the reply; the token and the prompt never reach an error."""
import io
import json
import os
import sys
import unittest
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import broker  # noqa: E402
import judge  # noqa: E402

ENV = {'ACTIONS_ID_TOKEN_REQUEST_URL': 'https://token.example/req?x=1', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN': 'req-secret', 'GITHUB_JOB': 'Blind-Judge'}


def reply(data):
    return io.BytesIO(json.dumps(data).encode())


def http_error(code, body=None):
    return urllib.error.HTTPError('https://x', code, 'x', {}, io.BytesIO(json.dumps(body).encode() if body is not None else b''))


class Opener:
    """The token service: records the URL and header it was asked with, answers from a list of values or errors."""
    def __init__(self, *answers):
        self.answers, self.calls = list(answers), []

    def __call__(self, url, headers, timeout=60):
        self.calls.append((url, headers))
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return reply({'value': answer})


class Poster:
    def __init__(self, *answers):
        self.answers, self.calls = list(answers), []

    def __call__(self, url, headers, body, timeout=300):
        self.calls.append((url, headers, body))
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return reply(answer)


class Broker(unittest.TestCase):
    def test_token_is_asked_for_the_brokers_audience_and_the_call_is_claude_only(self):
        opener, poster = Opener('jwt-1'), Poster({'reply': 'ok', 'model': 'claude-sonnet-5-5', 'engine': 'claude'})
        out = broker.ask('hi', tier='mid', env=ENV, poster=poster, opener=opener, sleep=lambda s: None)
        self.assertEqual(out, {'reply': 'ok', 'model': 'claude-sonnet-5-5', 'engine': 'claude'})
        self.assertTrue(opener.calls[0][0].endswith('&audience=jobadabra-ai-broker'))
        url, headers, body = poster.calls[0]
        self.assertTrue(url.endswith('/call'))
        self.assertEqual(headers['authorization'], 'Bearer jwt-1')
        self.assertEqual(headers['x-jobadabra-job'], 'blind-judge')
        self.assertEqual(body, {'prompt': 'hi', 'tier': 'mid', 'engine': 'claude', 'only': True})

    def test_no_oidc_env_says_so(self):
        with self.assertRaisesRegex(broker.BrokerError, 'id-token: write'):
            broker.run_token({})

    def test_a_gateway_error_on_the_token_is_asked_once_more_and_other_errors_are_not(self):
        sleeps = []
        self.assertEqual(broker.run_token(ENV, Opener(http_error(502), 'jwt-2'), sleeps.append), 'jwt-2')
        self.assertEqual(sleeps, [broker.RETRY_TOKEN_S])
        with self.assertRaisesRegex(broker.BrokerError, 'HTTP 500'):
            broker.run_token(ENV, Opener(http_error(500)), lambda s: None)

    def test_an_answer_without_text_fails(self):
        with self.assertRaisesRegex(broker.BrokerError, 'no text'):
            broker.ask('hi', env=ENV, poster=Poster({'reply': '  '}), opener=Opener('j'), sleep=lambda s: None)

    def test_a_refusal_with_a_reason_is_not_asked_again_and_a_bare_5xx_is_asked_once_more(self):
        refused = Poster(http_error(503, {'why': 'budget: the day is used'}))
        with self.assertRaisesRegex(broker.BrokerError, 'HTTP 503 budget: the day is used'):
            broker.ask('secret prompt text', env=ENV, poster=refused, opener=Opener('j'), sleep=lambda s: None)
        self.assertEqual(len(refused.calls), 1)
        swap = Poster(http_error(502), {'reply': 'fine'})
        self.assertEqual(broker.ask('x', env=ENV, poster=swap, opener=Opener('j'), sleep=lambda s: None)['reply'], 'fine')
        self.assertEqual(len(swap.calls), 2)

    def test_errors_never_carry_the_token_or_the_prompt(self):
        try:
            broker.ask('PROMPT-WORDS', env=ENV, poster=Poster(http_error(400, {'error': 'bad'})), opener=Opener('JWT-WORDS'), sleep=lambda s: None)
        except broker.BrokerError as error:
            self.assertNotIn('JWT-WORDS', str(error))
            self.assertNotIn('PROMPT-WORDS', str(error))
            self.assertNotIn('req-secret', str(error))


class Cloudflare(unittest.TestCase):
    def test_every_request_names_the_client_and_a_non_json_refusal_is_said(self):
        # Why (12 Nov 2026, run 43297527466): urllib's default User-Agent got Cloudflare's 403 "error code: 1010"; the judge then failed with a bare "HTTP 403".
        import unittest.mock as mock
        seen = []

        def fake_urlopen(request, timeout=0):
            seen.append(request.get_header('User-agent'))
            raise http_error(403, None)

        with mock.patch.object(broker.urllib.request, 'urlopen', fake_urlopen):
            with self.assertRaises(urllib.error.HTTPError):
                broker._get('https://x', {})
            with self.assertRaises(urllib.error.HTTPError):
                broker._post('https://x', {}, {})
        self.assertEqual(seen, [broker.USER_AGENT, broker.USER_AGENT])
        self.assertNotIn('python-urllib', broker.USER_AGENT.lower())
        refused = urllib.error.HTTPError('https://x', 403, 'x', {}, io.BytesIO(b'error code: 1010\n'))
        with self.assertRaisesRegex(broker.BrokerError, 'HTTP 403 error code: 1010'):
            broker.ask('p', env=ENV, poster=Poster(refused), opener=Opener('j'), sleep=lambda s: None)


class JudgeOnTheBroker(unittest.TestCase):
    def test_verdicts_come_out_of_the_reply_and_the_rules_lead_the_prompt(self):
        seen = {}

        def fake_ask(prompt, tier='mid'):
            seen.update(prompt=prompt, tier=tier)
            return {'reply': 'Sure. {"jobs":[{"n":1,"role":"yes","place":"no"},{"n":2,"role":"no","place":"unknown"}]}', 'model': 'm', 'engine': 'claude'}

        real, broker.ask = broker.ask, fake_ask
        try:
            verdicts, usage = judge.ask_broker('Profile: Nurse', [{'n': 1, 'title': 'A', 'company': 'C', 'location': 'L'}, {'n': 2, 'title': 'B', 'company': None, 'location': None}])
        finally:
            broker.ask = real
        self.assertEqual((verdicts[1]['role'], verdicts[1]['place'], verdicts[2]['role']), ('yes', 'no', 'no'))
        self.assertEqual(usage, {'input_tokens': 0, 'output_tokens': 0})
        self.assertTrue(seen['prompt'].startswith(judge.SYSTEM))
        self.assertIn('2. B | ? | (no place)', seen['prompt'])
        self.assertEqual(seen['tier'], 'mid')


if __name__ == '__main__':
    unittest.main()
