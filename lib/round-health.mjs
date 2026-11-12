// Whether a round-job.mjs job did its work at all. Why (12 Nov 2026, owner: "Ours –%"): ours' rounds of 6, 9 and 12 Nov ended GREEN while every one of its
// forms died in a second with the same error (no OIDC token for the AI broker), so nothing flagged it until the Telegram note printed a dash.
// A job whose every form that was tried ended in an error is the harness broken, not the tool scoring low: it must end red.
// Guard: test/round-health.test.mjs.

/** rows (round-job.mjs rows) -> true when at least one form was tried and every one of those ended with an error. A form skipped by the cost cap (`notRun`) is not tried. */
export const allFailed = rows => {
  const tried = rows.filter(row => !row.notRun);
  return tried.length > 0 && tried.every(row => row.error);
};
