// Update the browser's panel crops after reviewing the generated cover manifest.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(await readFile('public/assets/game-covers/sprite-plays-v1/manifest.json', 'utf8'));
assert.equal(Object.keys(manifest.teams).length, 32);
const frames = {};
for (const [id, team] of Object.entries(manifest.teams)) {
    assert.equal(team.reviewed, true, `${id}: visual review required`);
    assert.equal(team.boundaries.length, 4);
    assert.equal(team.boundaries[0], 0);
    assert.equal(team.boundaries[3], team.height);
    const bytes = await readFile(`public/${team.src}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), team.sha256, `${id}: image changed since review`);
    assert.equal(bytes.readUInt32BE(16), team.width);
    assert.equal(bytes.readUInt32BE(20), team.height);
    frames[id] = team.boundaries.map((y, index) => {
        if (index) assert.ok(y > team.boundaries[index - 1], `${id}: panel order`);
        return Number((y / team.height).toFixed(8));
    });
}
const path = 'public/scripts/game-personality.js';
const source = await readFile(path, 'utf8');
const start = source.indexOf('    // BEGIN SPRITE PLAY FRAMES');
const end = source.indexOf('    // END SPRITE PLAY FRAMES', start);
assert.ok(start >= 0 && end > start);
const entries = Object.entries(frames).map(([id, crop]) => `        '${id}': ${JSON.stringify(crop)}`);
const block = `    // BEGIN SPRITE PLAY FRAMES\n    const playSceneFrames = {\n${entries.join(',\n')}\n    };\n`;
await writeFile(path, source.slice(0, start) + block + source.slice(end));
console.log('Updated 96 panel crops from 32 reviewed sprite-style team atlases.');
