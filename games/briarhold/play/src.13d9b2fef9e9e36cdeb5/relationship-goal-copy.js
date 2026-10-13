// Local presentation only. These strings never enter save data or co-op wire.
export const GOAL_OWNERS = Object.freeze({
  bellkeeper: ['Nell', 'Bell Platform'], mason: ['Orin', "Mason’s Bench"],
  quartermaster: ['Tamsin', 'Quartermaster Stores'], trapper: ['Fen', 'Trapper’s Workshop'],
  greenwarden: ['Edda', 'Greenwarden’s Shrine'],
});
export const GOAL_REQUIREMENTS = Object.freeze({
  'nell-briefing': 'Review Nell’s briefing, then complete that night.',
  'nell-outer-gates': 'Complete a night with neither outer gate breached.',
  'nell-all-survive': 'Complete Night 5 or later with everyone who started the night alive.',
  'orin-repair-600': 'Restore 600 actual gate integrity after accepting this goal, across any number of attempts.',
  'orin-gates-half': 'Complete a night with both outer gates above 50% integrity.',
  'orin-heart-strong': 'Complete Night 4 or later with the Heart Gate at least 75% intact and neither outer gate destroyed.',
  'tamsin-knife-21': 'One Warden must make 21 knife kills without taking damage or killing with another weapon.',
  'tamsin-sunfire-40': 'Make 40 Sunfire kills in one night without overheating. Overheating resets this count.',
  'tamsin-full-rack': 'In one night, make 15 Arbalest kills, 15 Sunfire kills, 15 Runebolt kills and 1 knife kill.',
  'fen-snare-21': 'Snare 21 distinct targets in one night.',
  'fen-firepot-12': 'Kill 12 enemies with one Fire Pot detonation.',
  'fen-defence-50': 'Make 50 fortification kills in one night.',
  'edda-boon-night': 'Complete a night carrying an active boon.',
  'edda-all-survive': 'Complete a night with an active boon and everyone who started the night alive.',
  'edda-end-debt': 'With Edda at the hold, complete Night 7 and keep her alive to end the debt, or complete its Echo if the debt is already broken.',
});

export const GOAL_NEXT_ACTIONS = Object.freeze({
  'nell-briefing': 'Ask Nell for the briefing, then ring the bell and survive the night.',
  'nell-outer-gates': 'Repair and defend both outer gates through the next night.',
  'nell-all-survive': 'Reach Night 5 or later and protect every holdfolk through the final assault.',
  'orin-repair-600': 'Ask Orin to repair damaged gates. Repairs need Supplies.',
  'orin-gates-half': 'Repair both outer gates, then keep each above half integrity until dawn.',
  'orin-heart-strong': 'Reach Night 4 or later; defend the outer gates and keep the Heart Gate strong.',
  'tamsin-knife-21': 'Use the knife and avoid damage until your streak reaches 21.',
  'tamsin-sunfire-40': 'Use Sunfire this night; release it to cool before it overheats.',
  'tamsin-full-rack': 'Use each weapon this night and fill all four counters below.',
  'fen-snare-21': 'Install snares where new enemies will enter them this night.',
  'fen-firepot-12': 'Detonate a Fire Pot when at least 12 enemies are in its blast.',
  'fen-defence-50': 'Install and use fortifications to defeat 50 enemies this night.',
  'edda-boon-night': 'Choose a boon from Edda, then carry it through the night.',
  'edda-all-survive': 'Carry a boon and protect every holdfolk through the final assault.',
  'edda-end-debt': 'Keep Edda alive through Night 7’s final assault.',
});

export function goalProgressText(goal) {
  return goal.progressBreakdown?.length
    ? goal.progressBreakdown.map(p => `${p.label} ${p.current} / ${p.target}`).join(' · ')
    : `${goal.progress.current} / ${goal.progress.target}`;
}
