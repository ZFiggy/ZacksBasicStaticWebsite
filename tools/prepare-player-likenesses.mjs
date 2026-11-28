// Download credited identity references and prepare the exact on-field artwork queue.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
const base = new URL('../', import.meta.url);
const roster = JSON.parse(await readFile(new URL('public/assets/characters/current-rosters.json',base)));
const counts = {quarterback:1,receiver:3,lineman:2,corner:3,safety:2,rusher:3,kicker:1,holder:1,snapper:1};
const pending = [], sheets = [];
let accepted = {};
try { accepted = JSON.parse(await readFile(new URL('public/assets/characters/likenesses/manifest.json', base))).players; } catch { /* First artwork pass. */ }
for (const [teamId, team] of Object.entries(roster.teams)) {
    const players = Object.entries(counts).flatMap(([role,count])=>team.cast[role].slice(0,count).map(p=>({...p,role,teamId})));
    pending.push(...players.filter(p => !accepted[p.id]));
}
await mkdir(new URL('tools/player-likenesses/references/',base),{recursive:true});
for(let start=0;start<pending.length;start+=8) await Promise.all(pending.slice(start,start+8).map(async p=>{
    const source=`https://a.espncdn.com/i/headshots/nfl/players/full/${p.id}.png`;
    const path=new URL(`tools/player-likenesses/references/${p.id}.png`,base);
    try {await readFile(path);} catch {
        const response=await fetch(source,{signal:AbortSignal.timeout(30000)});
        if(!response.ok) throw Error(`Missing reference ${p.name}: ${response.status}`);
        await writeFile(path,Buffer.from(await response.arrayBuffer()));
    }
    p.reference=source;
}));
for(let start=0;start<pending.length;start+=34) sheets.push({index:sheets.length,cols:6,rows:6,players:pending.slice(start,start+34)});
// Accepted queue.json is provenance: future preparations must never overwrite it.
await writeFile(new URL('tools/player-likenesses/pending-queue.json',base),JSON.stringify({sourceRosterDate:roster.updatedAt,sheets},null,4)+'\n');
console.log(`Prepared ${pending.length} missing player identity references in ${sheets.length} sheets; see tools/player-likenesses/pending-queue.json. Existing accepted mappings are unchanged.`);
