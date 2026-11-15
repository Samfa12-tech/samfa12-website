export const withdrawnItchSlugs = new Set(['toknight','toknight-2-the-fire-beneath','free-to-a-good-home','a-place-of-his-own','colossal','concubine']);
export function isWithdrawnItch(project) {
 if (project.listingStatus === 'withdrawn') return true;
 try { const url = new URL(project.url); return url.hostname === 'samfa12.itch.io' && withdrawnItchSlugs.has(url.pathname.replace(/^\/+|\/+$/g,'')); } catch { return false; }
}
export function preserveWithdrawnItch(current, previous = []) {
 const projects = current.projects.map(project => isWithdrawnItch(project) ? {...project,url:'',listingStatus:'withdrawn'} : project);
 const ids = new Set(projects.map(project => project.id));
 for (const old of previous) if (isWithdrawnItch(old) && !ids.has(old.id)) { projects.push({...old,url:'',listingStatus:'withdrawn'}); ids.add(old.id); }
 projects.sort((a,b)=>a.title.localeCompare(b.title));
 return {projects,totals:projects.reduce((sum,p)=>({views:sum.views+p.views,downloads:sum.downloads+p.downloads,purchases:sum.purchases+p.purchases}),{views:0,downloads:0,purchases:0})};
}
