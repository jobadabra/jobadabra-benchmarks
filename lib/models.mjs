import {execFileSync} from 'node:child_process';
// The one model every tool runs in a round (BENCH_MODEL; default Sonnet 5.5, the 13-15 Oct rounds) and its price.
// The objective round (27 Oct 2026, owner: "CI with Haiku 5.5 ... 2-3$ everything"): BENCH_MODEL=claude-haiku-5-5 for the agents AND ours
// (ours through JOBADABRA_MODEL_OVERRIDE, run.mjs). Prices: the product's src/ai/cost.py ($ per million tokens).
export const AGENT_MODEL = process.env.BENCH_MODEL || 'claude-sonnet-5-5';
const PRICES = {
  'claude-sonnet-5-5': {in: 2.00, out: 10.00, longOver: Infinity},
  'claude-haiku-5-5': {in: 0.10, out: 0.50, longOver: 100_000},   // a call above 100k input tokens costs 5x (cost.py)
};
export const priceOf = model => PRICES[model] || PRICES['claude-sonnet-5-5'];

// One call's dollars from its usage block (cache reads 0.1x, cache writes 1.25x of the input price).
export function callUsd(model, u = {}) {
  const p = priceOf(model), input = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  const x = input > p.longOver ? 5 : 1;
  return x * ((u.input_tokens || 0) * p.in + (u.output_tokens || 0) * p.out + (u.cache_read_input_tokens || 0) * p.in * 0.1 + (u.cache_creation_input_tokens || 0) * p.in * 1.25) / 1e6;
}

// The agents' Anthropic key: its own Benchmarks workspace, $5 a month limit (owner, 27 Oct 2026: "a separate API Key for the benchmarks").
// CI's secret BENCH_ANTHROPIC_KEY, else this Mac's Keychain item jobadabra-benchmarks.anthropic.api_key (same key).
export const anthropicKey = () => process.env.BENCH_ANTHROPIC_KEY
  || execFileSync('security', ['find-generic-password', '-a', 'jobadabra-benchmarks', '-s', 'jobadabra-benchmarks.anthropic.api_key', '-w'], {encoding: 'utf8'}).trim();
