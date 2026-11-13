"""The search benchmark's side of the AI broker: one prompt in, the answer text out, on this run's GitHub OIDC token (the job needs `permissions: id-token: write`).
Why (12 Nov 2026, owner: "Broker, Claude plan, Haiku"): the judge no longer holds the plan token; the broker answers any run token of this repo on the owner's Claude plan.
Port of the contract in jobadabra's desktop/e2e/lib/broker-client.mjs (audience, /call, {prompt, tier, engine, only}, the answer's {reply, model, engine}); no system field: fold it into the prompt.
Invariants: a refusal or a cut-off answer raises BrokerError with the broker's own reason (never an empty verdict); the OIDC token and the prompt are never printed."""
import json
import os
import time
import urllib.error
import urllib.request

AUDIENCE = 'jobadabra-ai-broker'
BROKER_URL = os.environ.get('AI_BROKER_URL') or 'https://jobadabra-ai-broker.jobpilotto.workers.dev'
GATEWAY = (502, 503, 504)   # GitHub's gateway on the run token: one more try after RETRY_TOKEN_S (the product's client does the same)
RETRY_TOKEN_S = 10
RETRY_BROKER_S = 30   # Why (4 Nov 2026, jobadabra's client): a 5xx WITHOUT a reason of the broker's is the platform swapping its container; one more try after 30 s. A refusal with a reason is a decision, never asked again.


class BrokerError(Exception):
    """The broker did not answer; the message names why (no run token, HTTP status, the broker's reason)."""


# Why (12 Nov 2026, run 43297527466: the judge got "HTTP 403" on all 10 people): the broker sits behind Cloudflare, which refuses Python's default User-Agent with error 1010 before the
# broker's own auth runs (measured: urllib's default -> 403 "error code: 1010", the same call with another UA -> the broker's 401). Every request names this client.
USER_AGENT = 'jobadabra-benchmarks-search-judge'


def _get(url, headers, timeout=60):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'user-agent': USER_AGENT, **headers}), timeout=timeout)


def run_token(env=None, opener=_get, sleep=time.sleep):
    """This run's OIDC token for the broker; raises BrokerError outside a job that has `id-token: write`."""
    env = os.environ if env is None else env
    base, bearer = env.get('ACTIONS_ID_TOKEN_REQUEST_URL'), env.get('ACTIONS_ID_TOKEN_REQUEST_TOKEN')
    if not base or not bearer:
        raise BrokerError('no GitHub OIDC token here (the job needs permissions: id-token: write; a fork run has none)')
    for attempt in (0, 1):
        try:
            return json.load(opener(f'{base}&audience={AUDIENCE}', {'authorization': f'Bearer {bearer}'}))['value']
        except urllib.error.HTTPError as error:
            if error.code in GATEWAY and attempt == 0:
                sleep(RETRY_TOKEN_S)
                continue
            raise BrokerError(f'no run token from GitHub: HTTP {error.code}') from None
        except (OSError, ValueError, KeyError) as error:
            raise BrokerError(f'no run token from GitHub: {type(error).__name__}') from None


def _post(url, headers, body, timeout=300):
    return urllib.request.urlopen(urllib.request.Request(url, json.dumps(body).encode(), {'user-agent': USER_AGENT, **headers, 'content-type': 'application/json'}), timeout=timeout)


def ask(prompt, tier='mid', env=None, poster=_post, opener=_get, sleep=time.sleep):
    """One call on the Claude engine only (this repo's broker is Claude-only; `only` keeps a fallback from answering): returns {'reply', 'model', 'engine', 'paid'} (paid: the broker marked the answer as the paid lane's).
    tier: 'small' = Haiku, 'mid' = Sonnet."""
    env = os.environ if env is None else env
    token = run_token(env, opener, sleep)
    headers = {'authorization': f'Bearer {token}'}
    if env.get('GITHUB_JOB'):
        headers['x-jobadabra-job'] = ''.join(c for c in env['GITHUB_JOB'].lower() if c.isalnum() or c == '-')[:40] or 'job'   # a display label in the AI cost admin only
    body = {'prompt': prompt, 'tier': tier, 'engine': 'claude', 'only': True}
    for attempt in (0, 1):
        try:
            data = json.load(poster(f'{BROKER_URL}/call', headers, body))
            break
        except urllib.error.HTTPError as error:
            why = ''
            raw = error.read().decode('utf8', 'replace')
            try:
                said = json.loads(raw)
                why = str(said.get('why') or said.get('error') or '')
            except (ValueError, AttributeError):
                why = raw.strip()[:80]   # a refusal that is not the broker's JSON (Cloudflare's "error code: 1010") says what it says
            if error.code >= 500 and not why and attempt == 0:
                sleep(RETRY_BROKER_S)
                continue
            raise BrokerError(f'broker: HTTP {error.code} {" ".join(why.split())[:200]}'.strip()) from None
        except (OSError, ValueError) as error:
            raise BrokerError(f'no answer from the broker: {type(error).__name__}') from None
    reply = data.get('reply')
    if not isinstance(reply, str) or not reply.strip():
        raise BrokerError('the broker answered with no text')
    # Why (13 Nov 2026, sa for the owner: the broker's paid lane, `paid: true` and `usd` at the top level of its reply, bl; both absent on plan or Codex answers): read defensively; absent or anything but true = not paid, usd 0
    paid = data.get('paid') is True
    usd = data.get('usd') if paid and isinstance(data.get('usd'), (int, float)) and not isinstance(data.get('usd'), bool) and data['usd'] >= 0 else 0.0   # bl's marker: top-level `usd` = that call's list-price cost, only on paid answers
    return {'reply': reply, 'model': data.get('model') or '', 'engine': data.get('engine') or '', 'paid': paid, 'usd': float(usd)}
