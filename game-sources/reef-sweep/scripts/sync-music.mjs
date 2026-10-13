import fs from 'node:fs';
const score=JSON.parse(fs.readFileSync(new URL('../public/music/room-for-life.pcs.json',import.meta.url),'utf8'));
if(score.projectVersion!==16||score.timeSig!==4||score.resolution!==4||!Number.isFinite(score.bpm)||score.bpm<60||score.bpm>180)throw Error('Reef Sweep music requires a schema-16, 4/4, resolution-4 Pocket Chordsmith project at 60–180 BPM.');
for(const k of ['A','B'])if(score['melodyTracks'+k]?.[0]?.length!==64||score['progression'+k]?.length!==4)throw Error('Music sections A and B must each contain four bars (64 cells).');
fs.writeFileSync(new URL('../src/audio/score.ts',import.meta.url),'// Generated from public/music/room-for-life.pcs.json. Run npm run build after editing.\nexport const SCORE:any='+JSON.stringify(score)+';\n');
console.log('Synced editable Pocket Chordsmith score.');
