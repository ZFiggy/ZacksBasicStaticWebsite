// Rebuild browser identities from the reviewed cast; never changes image assets.
import {readFile, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../public/', import.meta.url);
const roster = JSON.parse(await readFile(new URL('assets/characters/expanded-roster.json', root), 'utf8'));
const teams = Object.entries(roster.teams);
assert.equal(teams.length, 32);
const browser = Object.fromEntries(teams.map(([team, players]) => [team, Object.fromEntries(Object.entries(players).map(([role, player]) => {
    assert.ok(player.name && player.source.startsWith('https://'));
    assert.ok(Number.isInteger(player.number) && player.number >= 0 && player.number <= 99);
    return [role, {name: player.name, number: player.number}];
}))]));
const content = '// Generated from assets/characters/expanded-roster.json by tools/build-player-roster.mjs.\nwindow.playerRoster = ' + JSON.stringify(browser, null, 4) + ';\n';
const destination = new URL('scripts/player-roster.js', root);
if (process.argv.includes('--check')) assert.equal(await readFile(destination, 'utf8'), content, 'Run node tools/build-player-roster.mjs');
else await writeFile(destination, content);
console.log(`PASS ${teams.length} real supporting casts${process.argv.includes('--check') ? ' match the browser data' : ' written'}.`);
