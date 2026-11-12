// The forms a round runs. A forms file is a pick-forms.mjs output ({picks: [...]}) or a plain list.
// Why (12 Nov 2026, owner via the coordinator, "Replace with a live form"): a form whose posting was taken down is `retired: <date>` in the file and stays there, so the judge still
// finds its title for the rivals' frozen rows (judge-blind.mjs jobOf) and the exclusion list still names its company, but no job runs it. Guard: test/forms-objective.test.mjs.

/** forms file (parsed) -> the forms to run: every pick that is not retired, in file order. */
export const activeForms = file => (file.picks || file).filter(form => !form.retired);
