// The tools of a search-bench round and their page names (owner via 6e, 27 Oct 2026: "Yes, small job for 4e": publish the 6-tool
// comparison, "the page shows where we stand honestly"). Ours first, then the known rivals in a fixed order, then any other tool by its own name.
// Why (12 Nov 2026, owner: "Instead of \"Jobadabra\" put \"Jobadabra Search Engine\" because Jobadabra is not a search engine/api/product. It's an end-to-end product"): a job-search round names our row the engine. The site names it again by key + round kind when its page is read (jobadabra-web shared/benchmark-names.js), so this label is only what Admin and the notes show.
// Guard: test/search-publish.test.mjs.
export const NAME = {ours: 'Jobadabra Search Engine', 'ours-all': 'Jobadabra Search Engine (with every source)', jobspy: 'JobSpy', eures: 'EURES', adzuna: 'Adzuna', jooble: 'Jooble', 'career-ops': 'career-ops', 'career-ops-docs': 'career-ops (set up per its docs)'};
export const toolsOf = rows => ['ours', ...Object.keys(NAME).filter(t => t !== 'ours' && rows.some(row => row.tool === t)),
  ...[...new Set(rows.map(row => row.tool))].filter(t => !(t in NAME))];
