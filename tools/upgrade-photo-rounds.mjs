// Assemble reviewed full-size search rounds without reading private environment files.
import assert from 'node:assert/strict';
import {readFile, writeFile, stat, readdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(root, 'public');
const photoRoot = resolve(publicRoot, 'assets/photo-search');
const metadataRoot = resolve(root, 'tools/photo-search-rounds');
const partial = process.argv.includes('--partial');
const targets = {};
const clues = {};
const approved = new Set();
const rejected = new Set();
for (const file of await readdir(resolve(root, 'tools'))) {
    if (/^photo-qa-.+\.json$/.test(file)) {
        const qa = JSON.parse(await readFile(resolve(root, 'tools', file), 'utf8'));
        for (const round of qa.accepted || []) approved.add(round);
        for (const round of Object.keys(qa.rejected || {})) rejected.add(round);
    }
    if (/^photo-targets-.+\.json$/.test(file)) Object.assign(targets, JSON.parse(await readFile(resolve(root, 'tools', file), 'utf8')));
    if (/^photo-clues-.+\.json$/.test(file)) Object.assign(clues, JSON.parse(await readFile(resolve(root, 'tools', file), 'utf8')));
}
const portraits = JSON.parse(await readFile(resolve(publicRoot, 'assets/player-references/sources.json'), 'utf8'));
const prompts = [];
for (const conference of ['afc', 'nfc']) {
    const file = resolve(photoRoot, `${conference}-scenes.json`);
    const sets = JSON.parse(await readFile(file, 'utf8'));
    for (const [team, set] of Object.entries(sets)) {
        const reviewed = Array.from({length: 5}, (_, i) => `${team}-${i + 1}`).every(round => approved.has(round) && !rejected.has(round));
        if (partial && (!targets[team] || targets[team].some(target => !target) || !reviewed)) continue;
        assert.ok(reviewed, `Five approved visual reviews required: ${team}`);
        assert.equal(targets[team]?.length, 5, `Five visually reviewed targets required: ${team}`);
        for (let level = 0; level < 5; level++) {
            const record = JSON.parse(await readFile(resolve(metadataRoot, `${team}-${level + 1}.json`), 'utf8'));
            const target = targets[team][level];
            const [x, y, width, height] = target;
            assert.ok(target.length === 4 && target.every(Number.isFinite) && x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1 && y + height <= 1, `Invalid target: ${team}/${level}`);
            assert.ok((await stat(resolve(publicRoot, record.src))).size > 0);
            set.scenes[level] = {...set.scenes[level], src: record.src, target, clue: clues[team]?.[level] || record.clue, kind: record.kind || 'edited'};
            prompts.push({team, round: level + 1, src: record.src, prompt: record.prompt, revisions: record.revisions || []});
        }
        // Each portrait is the original identity reference, independent of scene resolution.
        const source = JSON.parse(await readFile(resolve(photoRoot, `${conference}-prompts.json`), 'utf8'))[team];
        const suppliedReference = source.reference?.file;
        if (suppliedReference) set.referenceSrc = suppliedReference;
        else {
            const reference = (await readdir(resolve(publicRoot, 'assets/player-references'))).find(file => file.split('.')[0] === team);
            assert.ok(reference, `Missing portrait: ${team}`);
            set.referenceSrc = `assets/player-references/${reference}`;
        }
        const portrait = portraits.find(item => item.teamId === team);
        if (portrait) {
            set.referenceSrc = portrait.file;
            set.referencePage = portrait.sourcePage;
            set.referenceCredit = portrait.credit;
        }
        set.version = 2;
        set.disclosure = 'AI-created fictional crowd scenes and edited fan photographs. These scenes do not document a real player appearance.';
    }
    await writeFile(file, JSON.stringify(sets, null, 4) + '\n');
}
await writeFile(resolve(root, 'tools/photo-search-targets.json'), JSON.stringify(targets, null, 4) + '\n');
await writeFile(resolve(root, 'tools/photo-search-prompts.json'), JSON.stringify({tool: 'Built-in Imagegen', prompts}, null, 4) + '\n');
console.log(`Prepared ${prompts.length} full-size photo rounds with visually reviewed targets.`);
