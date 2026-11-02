// The ONE applicant every tool gets: the pool's fake applicant as the harness builds it (contact, Profile, standard answers, CV facts) rendered to a text file, plus the CV pdf and the shared instruction.
import fs from 'node:fs'; import path from 'node:path';
const REPO = process.env.JP_REPO || path.join(process.env.HOME, 'jobadabra', 'desktop', 'e2e');   // the Jobadabra checkout: fake applicant, site ledger, the extension harness (use a worktree on main, never the owner's live checkout)
export const CV_PDF = path.join(REPO, 'fixtures', 'cv.pdf');
export async function buildApplicant(outDir) {
  const {applicantDraft} = await import(path.join(REPO, 'lib/applicant-seed.mjs'));
  const {CONTACT} = await import(path.join(REPO, 'lib/apply-fixtures.mjs'));
  const draft = applicantDraft(), cv = JSON.parse(fs.readFileSync(path.join(REPO, 'fixtures/cv.json'), 'utf8'));
  const text = `# Applicant facts (fake person)\n\n## Contact\n${Object.entries(CONTACT).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n## Profile\n${draft.profile_markdown}\n\n## Standard answers\n${draft.answers_markdown}\n\n## CV facts\n${JSON.stringify(cv, null, 1)}\n\nThe CV file to upload is: ${CV_PDF}\n`.replace(/❓/g, '(unknown)');
  fs.mkdirSync(outDir, {recursive: true}); fs.writeFileSync(path.join(outDir, 'applicant.md'), text);
  return {text, file: path.join(outDir, 'applicant.md'), cv: CV_PDF};
}
// The same words for both agents (the owner's text).
export const instruction = (facts, url, flow = false) => `Fill this job application with these facts; never submit; leave a field empty when the facts don't answer it.\n${flow ? `The job posting is at ${url} (it is already open in the browser; if you cannot see it, open that address). Find the way to apply (the Apply button or link), open the application form and fill it.` : `The application form is at ${url} (it is already open in the browser; if you cannot see it, open that address).`} Stay on this site: do not open the applicant's links or any other website. Do not press Submit/Apply/Send. To upload the CV use the file ${CV_PDF}.\n\nFACTS:\n${facts}`;
