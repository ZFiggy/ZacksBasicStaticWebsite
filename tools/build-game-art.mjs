// Build static artwork metadata only. Never load dotenv or private environment files.
import assert from 'node:assert/strict';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, dirname, sep} from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(root, 'public');
const partial = process.argv.includes('--partial');
const searchOnly = process.argv.includes('--search-only');
const ids = ['game','bird','search','kick','pocket','shove','recall','punt','blitz','signal'];
const focusY = {game:0.18,bird:0.3,search:0.5,kick:0.4,pocket:0.6,shove:0.5,recall:0.45,punt:0.2,blitz:0.2,signal:0.5};
const eaglesIds = ['game','kick','pocket','shove','recall','punt','blitz','signal'];
const readJson = async path => JSON.parse(await readFile(resolve(publicRoot, path), 'utf8'));
const profiles = await readJson('assets/game-covers/personality-sources.json');
const context = {window: {}};
vm.runInNewContext(await readFile(resolve(publicRoot, 'scripts/teams-data.js'), 'utf8'), context);
const teams = context.window.NFL_TEAMS;
assert.equal(teams.length, 32);
assert.equal(profiles.length, 32);
assert.equal(new Set(profiles.map(profile => profile.teamId)).size, 32);
const media = Object.fromEntries((await readJson('assets/team-photos/sources.json')).map(item => [item.teamId, item]));
const selection = await readJson('assets/team-photos/clean-selection.json');
for (const [id, photo] of Object.entries(selection)) { media[id].selection = photo; media[id].hero = photo; }
const currentSearches = {...await readJson('assets/photo-search/current-nfc-scenes.json'), ...await readJson('assets/photo-search/current-afc-scenes.json')};
const photos = {...await readJson('assets/photo-search/afc-scenes.json'), ...await readJson('assets/photo-search/nfc-scenes.json'), ...await readJson('assets/team-photos/search-scenes.json'), ...currentSearches, ...await readJson('assets/photo-search/consistent-crowd-scenes.json')};
const fliers = await readJson('assets/player-sprites/current-flight.json');

async function checkImage(src) {
    assert.match(src, /^assets\/[a-z0-9_./-]+\.(png|jpe?g|webp|svg)$/i);
    const path = resolve(publicRoot, src);
    assert.ok(path.startsWith(publicRoot + sep));
    assert.ok((await stat(path)).size > 0, `Empty artwork: ${src}`);
    if (src.includes('/rounds/') || src.includes('/team-photos/')) {
        // Verify actual encoded pixels, not the display size of an upscaled canvas.
        const bytes = await readFile(path);
        assert.equal(bytes.readUInt16BE(0), 0xffd8, `Expected a JPEG photo: ${src}`);
        let dimensions;
        for (let offset = 2; offset + 8 < bytes.length;) {
            if (bytes[offset] !== 0xff) { offset++; continue; }
            const marker = bytes[offset + 1];
            offset += 2;
            if ([0xc0, 0xc1, 0xc2].includes(marker)) {
                dimensions = {height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5)};
                break;
            }
            const length = bytes.readUInt16BE(offset);
            assert.ok(length >= 2, `Invalid JPEG segment: ${src}`);
            offset += length;
        }
        assert.ok(dimensions && dimensions.width >= 1280 && dimensions.height >= (src.includes('/rounds/') ? 720 : 640), `Photo resolution is too small: ${src}`);
    }
}

if (searchOnly) {
    const playerSources = await readJson('assets/photo-search/real-player-sources.json');
    assert.equal(playerSources.length, 31);
    for (const team of teams.filter(team => team.id !== 'eagles')) {
        const set = photos[team.id];
        const player = playerSources.find(source => source.team === team.id);
        assert.ok(player && player.player === set.playerName);
        assert.ok(player.teamJoined >= 2015 && player.verifiedTeamSeasons.some(year => year >= 2015));
        assert.equal(set.photographicComposite, true);
        assert.equal(set.consistentPerson, true);
        assert.equal(set.scenes.length, 5);
        assert.equal(new Set(set.scenes.map(scene => scene.sourceImage)).size, 5, `Distinct original photos: ${team.id}`);
        await checkImage(set.referenceSrc);
        for (const scene of set.scenes) {
            assert.equal(scene.kind, set.aiIntegrated ? 'ai-integrated-photo' : 'photographic-composite');
            assert.match(scene.sourcePage, /^https:\/\//);
            assert.match(scene.sourceImage, /^https:\/\/static\.clubs\.nfl\.com\//);
            const [x, y, width, height] = scene.target;
            assert.ok(scene.target.every(Number.isFinite) && x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1 && y + height <= 1);
            await checkImage(scene.src);
        }
    }
    await writeFile(resolve(publicRoot, 'scripts/photo-scenes.js'), '// Team crowd photo edits; original Eagles scenes remain in jalen.js.\nwindow.NFL_PHOTO_SCENES = ' + JSON.stringify(photos, null, 4) + ';\n');
    const aiTeams = Object.values(photos).filter(set => set.aiIntegrated).length;
    console.log(`Validated 31 recent player associations and 155 search rounds (${aiTeams} complete AI-edited teams); wrote photo-scenes.js.`);
    process.exit(0);
}

const manifest = {};
for (const team of teams) {
    const profile = profiles.find(profile => profile.teamId === team.id);
    assert.ok(profile, `Missing player profile: ${team.id}`);
    if (fliers[team.id]) {
        profile.runner = fliers[team.id].player;
        profile.flightSprite = fliers[team.id].flightSprite;
        profile.flierTitle = fliers[team.id].flierTitle;
    }
    if (photos[team.id] && !photos[team.id].authentic) {
        profile.searchPlayer = {name: photos[team.id].playerName, number: photos[team.id].number, era: photos[team.id].era, source: photos[team.id].sourcePage};
        profile.searchTitle = `Where’s ${profile.searchPlayer.name.split(' ')[0]}?`;
    }
    if (media[team.id]) {
        assert.notEqual(media[team.id].hero.src, media[team.id].scoreboard.src, `Repeated hero/scoreboard: ${team.id}`);
        for (const role of ['hero', 'scoreboard']) {
            await checkImage(media[team.id][role].src);
            assert.match(media[team.id][role].sourcePage, /^https:\/\//);
        }
    }
    for (const role of ['quarterback','runner','kicker','defender']) {
        assert.equal(typeof profile[role].name, 'string');
        assert.ok(Number.isInteger(profile[role].number) && profile[role].number >= 0 && profile[role].number <= 99);
        assert.match(profile[role].source, /^https:\/\//);
        assert.equal(typeof profile[role].era, 'string');
    }
    for (const id of ids) assert.equal(typeof profile.gameHooks[id], 'string');
    await checkImage(profile.flightSprite.src);
    const photoSet = photos[team.id];
    if (team.id !== 'eagles') {
        if (!partial) {
            assert.ok(Object.hasOwn(currentSearches, team.id), `Named-player crowd scenes are required: ${team.id}`);
            assert.equal(photoSet.authentic, false);
            assert.equal(photoSet.photographicComposite, true);
            assert.ok(photoSet.scenes.every(scene => scene.kind === (photoSet.aiIntegrated ? 'ai-integrated-photo' : 'photographic-composite')));
            assert.ok(photoSet.teamJoined >= 2015, `Recent team association required: ${team.id}`);
        }
        if (!partial) assert.ok(photoSet, `Missing photographic search: ${team.id}`);
        if (photoSet) {
            assert.equal(photoSet.cols, photoSet.authentic || photoSet.photographicComposite ? 1 : 3);
            assert.equal(photoSet.rows, photoSet.authentic || photoSet.photographicComposite ? 1 : 2);
            assert.equal(photoSet.referenceIndex, photoSet.authentic || photoSet.photographicComposite ? 0 : 5);
            assert.equal(photoSet.scenes.length, 5);
            if (!photoSet.authentic) assert.equal(photoSet.playerName, profile.searchPlayer.name);
            assert.match(photoSet.sourcePage, /^https:\/\//);
            await checkImage(photoSet.src);
            if (photoSet.referenceSrc) await checkImage(photoSet.referenceSrc);
            for (const scene of photoSet.scenes) if (scene.src) await checkImage(scene.src);
            photoSet.scenes.forEach((scene, index) => {
                assert.equal(scene.index, index);
                assert.equal(scene.target.length, 4);
                const [x,y,width,height] = scene.target;
                assert.ok([x,y,width,height].every(Number.isFinite));
                assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1.00001 && y + height <= 1.00001, `Invalid photo target: ${team.id}/${index}`);
                assert.equal(typeof scene.clue, 'string');
                for (const region of [scene.region, photoSet.referenceRegion].filter(Boolean)) {
                    assert.equal(region.length, 4);
                    const [rx, ry, rw, rh] = region;
                    assert.ok(region.every(Number.isFinite) && rx >= 0 && ry >= 0 && rw > 0 && rh > 0 && rx + rw <= 1.00001 && ry + rh <= 1.00001, `Invalid atlas crop: ${team.id}/${index}`);
                }
            });
        }
    }
    const covers = {};
    for (const id of ids) {
        if (id === 'bird') covers[id] = {...profile.flightSprite, cutout:true};
        else if (team.id === 'eagles' && id === 'search') covers[id] = {src:'assets/search-level-3-v2.jpg',cols:1,rows:1,index:0};
        else if (id === 'search' && photoSet) covers[id] = photoSet.scenes[0].src
            ? {src:photoSet.scenes[0].src,cols:1,rows:1,index:0}
            : {src:photoSet.src,cols:photoSet.cols,rows:photoSet.rows,index:0,region:photoSet.scenes[0].region};
        else if (team.id !== 'eagles') covers[id] = {src:`assets/game-covers/previews/${team.id}-${id}.svg`,cols:1,rows:1,index:0,preview:true};
        else covers[id] = {src:`assets/game-covers/${team.id}.png`,cols:team.id==='eagles'?4:5,rows:2,index:(team.id==='eagles'?eaglesIds:ids).indexOf(id),focusY:focusY[id]};
        await checkImage(covers[id].src);
    }
    assert.equal(new Set(Object.values(covers).map(cover => `${cover.src}#${cover.index}`)).size, 10, `Repeated cover: ${team.id}`);
    manifest[team.id] = {covers,flightSprite:profile.flightSprite,photoSearch:team.id==='eagles'?'original-five-photo-round':photoSet?.scenes[0]?.src||photoSet?.src||null};
}
await writeFile(resolve(publicRoot,'scripts/personality-data.js'), '// Verified franchise associations. Source credits: assets/game-covers/personality-sources.json.\nwindow.NFL_PERSONALITIES = '+JSON.stringify(Object.fromEntries(profiles.map(profile=>[profile.teamId,profile])),null,4)+';\nwindow.NFL_TEAM_MEDIA = '+JSON.stringify(Object.fromEntries(Object.entries(media).map(([id, {galleryPhotos, ...item}]) => [id, item])),null,4)+';\n');
await writeFile(resolve(publicRoot,'scripts/photo-scenes.js'), '// Named-player search scenes and reviewed hit areas; Eagles original photo edits retained.\nwindow.NFL_PHOTO_SCENES = '+JSON.stringify(photos,null,4)+';\n');
await writeFile(resolve(publicRoot,'assets/game-covers/manifest.json'), JSON.stringify(manifest,null,4)+'\n');
await writeFile(resolve(publicRoot,'assets/photo-search/current-scenes.json'), JSON.stringify(currentSearches,null,4)+'\n');
console.log(`Validated 32 player profiles, 320 different cover selections, 32 flight sprites, and ${Object.keys(photos).length + 1}/32 photographic search games${partial?' (partial preview)':''}.`);
