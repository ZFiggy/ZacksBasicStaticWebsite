import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const rules = createRequire(import.meta.url)('../public/scripts/kick-rules.js');
const context = {window: {}};
vm.runInNewContext(readFileSync(new URL('../public/scripts/teams-data.js', import.meta.url), 'utf8'), context);
const teams = context.window.NFL_TEAMS;
for (const team of teams) {
    for (const rush of teams.filter(other => other.id !== team.id && other.conference === team.conference && other.division === team.division)) {
        const rival = rules.rivalFor(teams, team, rush.id);
        assert.ok(rival && rival.id !== rush.id && rival.id !== team.id);
        assert.equal(rival.conference, team.conference);
        assert.equal(rival.division, team.division);
    }
}
const base = {distance: 40, power: 0.8, aim: 0, accuracy: 0, wind: 0, loft: 'balanced', release: 1.6, protection: 5};
assert.equal(rules.resolve(base).outcome, 'good');
assert.equal(rules.resolve({...base, power: 0.1}).outcome, 'short');
assert.equal(rules.resolve({...base, accuracy: -0.3}).outcome, 'left');
assert.equal(rules.resolve({...base, accuracy: 0.3}).outcome, 'right');
assert.equal(rules.resolve({...base, release: 5}).outcome, 'blocked');
assert.equal(rules.resolve({...base, loft: 'drive', release: 3.8}).outcome, 'blocked');
assert.equal(rules.resolve({...base, loft: 'high', release: 3.8}).outcome, 'good');
assert.ok(rules.resolve({...base, loft: 'high'}).range < rules.resolve({...base, loft: 'drive'}).range);
assert.equal(rules.resolve({...base, wind: 0.2, aim: -0.2}).offset, 0);
for (let i = 0; i < 5; i++) {
    assert.equal(rules.resolve({...base, distance: rules.distanceFor(i), power: 0.9, release: 1.6, protection: rules.protectionFor(i)}).outcome, 'good');
}
console.log('PASS division rival exclusion, all five distances, wind compensation, range, accuracy, blocks, and arc tradeoffs.');
for (const random of [() => 0, () => 1]) {
    const spots = rules.situations(random);
    assert.equal(spots.length, 5);
    assert.deepEqual([...new Set(spots.map(s => s.hash))].sort(), [-1, 0, 1]);
    for (let i = 1; i < spots.length; i++) assert.notEqual(spots[i].hash, spots[i - 1].hash, 'Successive kicks move visibly');
}
for (const distance of [25, 33, 40, 47, 55]) for (const hash of [-1, 0, 1]) {
    const bias = rules.hashBias(distance, hash);
    const shot = rules.resolve({...base, distance, hash, aim: -bias, power: 0.95});
    assert.equal(shot.outcome, 'good', `Compensated ${distance} yard hash ${hash} is makeable`);
    assert.equal(shot.offset, 0);
}
assert.ok(Math.abs(rules.hashBias(25, 1)) > Math.abs(rules.hashBias(55, 1)), 'Short hash kicks need a sharper angle');
assert.ok(rules.openingFor(25) > rules.openingFor(55), 'Distant uprights have a smaller angular opening');
assert.equal(rules.resolve({...base, distance: 25, hash: -1}).outcome, 'left', 'An uncompensated near-hash kick hits outside the usable opening');
console.log('PASS assigned hash diversity, distance-dependent angle, aperture and compensation.');

const situations = rules.situations(() => 0.4);
assert.equal(new Set(situations.map(s => s.rush)).size, 3, 'All rush lanes occur in a round');
assert.ok(situations.some(s => s.gust > 0) && situations.some(s => s.headwind > 0) && situations.some(s => s.headwind < 0));
assert.ok(rules.rangeFor(.8, 'balanced', .08) < rules.rangeFor(.8, 'balanced', 0));
assert.ok(rules.rangeFor(.8, 'balanced', -.04) > rules.rangeFor(.8, 'balanced', 0));
assert.ok(rules.protectionBonus(situations[0], situations[0].rush) > rules.protectionBonus(situations[0], (situations[0].rush + 1) % 2));
const gusty = situations.find(s => s.gust > 0);
assert.notEqual(rules.windAt(gusty, .1, .1), rules.windAt(gusty, .1, .6));
assert.equal(rules.windAt(gusty, .1, .6), rules.windAt(gusty, .1, .6), 'Wind is predictable, not rolled at release');
console.log('PASS readable rush/protection choices, evolving deterministic crosswinds, headwind and tailwind range.');
