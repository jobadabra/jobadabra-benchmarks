// The draw of a form set: `per` slots per platform, from companies nobody has tested, in seeded order.
// Why (12 Nov 2026, owner: "Fill the gap from other platforms"): the career-ops list has only 5 Workable companies and each is drawn once ever,
// so from week 45 the Workable slot could not be filled and the weekly draw failed (run 42643759482, "Draw this week's 6 forms", 5 picks).
// A slot a platform cannot fill goes to the next platform that still has an unseen company (in `per` order, round by round); the pick says so (`fillsFor`).
/**
 * @param {{ats:string,slug:string,key:string}[]} companies
 * @param {string} excluded  lower-cased text of every company already tested or drawn
 * @param {Record<string,number>} per  slots per platform, in draw order
 * @param {Record<string,(slug:string)=>Promise<{title:string,location:string,url:string}[]>>} feeds
 * @param {(list:any[])=>any[]} shuffled  seeded order
 * @param {number} first  id of the first pick
 */
export async function draw({companies, excluded, per, feeds, shuffled, first}) {
  const picks = [], skipped = [];
  const queue = Object.fromEntries(Object.keys(per).map(ats => [ats, shuffled(companies.filter(c => c.ats === ats))]));
  async function one(ats, fillsFor) {   // the next unseen company of `ats` with an open posting, or false
    while (queue[ats].length) {
      const c = queue[ats].shift();
      if (excluded.includes(c.slug)) { skipped.push({...c, why: 'tested or fixed on before'}); continue; }
      let posts;
      try { posts = await feeds[ats](c.slug); } catch (e) { skipped.push({...c, why: `feed: ${e.message}`}); continue; }
      if (!posts.length) { skipped.push({...c, why: 'no open postings'}); continue; }
      const post = shuffled(posts.map(p => ({...p, key: p.url})))[0];
      picks.push({id: first + picks.length, platform: ats, company: c.slug, host: new URL(post.url).host, title: post.title, location: post.location, url: post.url, ...(fillsFor ? {fillsFor} : {})});
      return true;
    }
    return false;
  }
  const short = [];
  for (const [ats, n] of Object.entries(per)) for (let i = 0; i < n; i++) if (!await one(ats)) short.push(ats);
  const platforms = Object.keys(per);
  for (const lacking of short) {
    let filled = false;
    for (const ats of platforms) { if (ats !== lacking && await one(ats, lacking)) { filled = true; break; } }
    if (!filled) break;
  }
  return {picks, skipped};
}
