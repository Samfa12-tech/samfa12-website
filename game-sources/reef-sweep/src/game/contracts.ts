import type { Profile, Run, SiteId } from './types.js';
import { contractOptions, researchEligibility } from './campaign.js';
export function eventTheme(profile: Profile, site: SiteId): 'catch'|'cleanup'|'research' {
 const preferred=(['catch','cleanup','research'] as const)[(Math.floor(profile.day/3)-1)%3];
 if(preferred==='research'&&!researchEligibility(profile).eligible)return 'catch';
 if(preferred==='cleanup'&&!contractOptions(profile,site).find(o=>o.kind==='cleanup')?.available)return researchEligibility(profile).eligible?'research':'catch';
 return preferred;
}
export function contractProgress(run: Run) {
 const researchRoute=run.site==='passage'&&(run.siteRevision??1)>=2;
 const amount=run.order==='catch'?run.cargo.filter(c=>c.value>0).length:run.order==='cleanup'?run.cleaned:run.order==='restore'?run.restored:run.order==='research'?(researchRoute?['survey-0','survey-1'].filter(id=>run.jobs.some(j=>j.id===id&&j.done)).length:run.surveyed):0;
 const target=run.order==='catch'?4:run.order==='none'?0:2;
 const label=run.order==='catch'?'Kitchen':run.order==='cleanup'?'Cleanup':run.order==='restore'?'Restoration':run.order==='research'?(researchRoute?'Flow gauges':'Research'):'Free exploration';
 return {label,amount,target,ready:target>0&&amount>=target,text:target?`${label} ${Math.min(amount,target)}/${target}${run.order==='catch'?' secured · sell 4 at the dock':''}`:label};
}
export function eventScore(run: Run) {if(run.rescued)return 0;return Math.max(0,run.removed*(run.eventTheme==='catch'?125:100)+run.cleaned*(run.eventTheme==='cleanup'?200:150)+run.restored*180+run.surveyed*(run.eventTheme==='research'?120:80)-run.nativeHits*300-run.coralHits*40);}
export function eventReward(score:number){return score>=1200?80:score>=650?50:score>=250?25:0;}
export function filletGrade(q:number){return q>=.85?'Excellent':q>=.6?'Good':q>=.3?'Fair':'Rough cuts';}
