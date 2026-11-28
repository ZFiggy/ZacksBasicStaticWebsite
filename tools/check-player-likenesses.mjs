// Gate roster releases on actual identity art, rather than generic stand-ins.
import {readFile, access} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../public/', import.meta.url);
const roster = JSON.parse(await readFile(new URL('assets/characters/current-rosters.json', root)));
const manifest = JSON.parse(await readFile(new URL('assets/characters/likenesses/manifest.json', root)));
const counts = {quarterback:1, receiver:3, lineman:2, corner:3, safety:2, rusher:3, kicker:1, holder:1, snapper:1};
const missing = [];
const files = new Set();
let total = 0;
for (const [team, data] of Object.entries(roster.teams)) {
    const seen = new Set();
    for (const [role, count] of Object.entries(counts)) for (const player of data.cast[role].slice(0, count)) {
        assert.ok(!seen.has(player.id), `${team}: duplicated on-field player ${player.name}`);
        seen.add(player.id); total++;
        const art = manifest.players[player.id];
        if (!art) { missing.push(`${team}/${role}: ${player.name} (${player.id})`); continue; }
        assert.equal(art.name, player.name, `${player.id}: artwork name mismatch`);
        assert.ok(art.crop.length === 4 && art.crop.every(Number.isFinite));
        assert.ok(/^#[0-9a-f]{6}$/i.test(art.skin));
        files.add(art.src);
    }
}
for (const src of files) await access(new URL(src, root));
assert.deepEqual(missing, [], 'Illustrated likenesses needed before releasing this roster. Prepare references with node tools/prepare-player-likenesses.mjs; generate and review the listed new players.');
const browser = await readFile(new URL('scripts/player-likenesses.js', root), 'utf8');
const context = {window: {}};
const {runInNewContext} = await import('node:vm');
runInNewContext(browser, context);
assert.equal(JSON.stringify(context.window.playerLikenesses), JSON.stringify(manifest.players));
console.log(`PASS ${total} unique on-field identities have individualized illustrated artwork across all 32 teams.`);
