import assert from 'node:assert/strict';
import '../public/scripts/passing-rules.js';
const r = globalThis.PassingRules;
let d = r.initial();
const first = r.resolve(d, {kind: 'run', yards: 12, thrown: true, complete: true});
assert.deepEqual([first.spot, first.down, first.toGo, first.completions, first.attempts], [37, 1, 10, 1, 1]);
assert.equal(d.spot, 25, 'Resolution does not mutate prior drive state');
d = r.resolve(first, {kind: 'sack', yards: -7});
assert.deepEqual([d.spot, d.down, d.toGo], [30, 2, 17]);
d = r.resolve(d, {kind: 'incomplete', thrown: true});
assert.deepEqual([d.spot, d.down, d.toGo, d.attempts], [30, 3, 17, 2]);
d = r.resolve(d, {kind: 'run', yards: 2, thrown: true, complete: true});
assert.equal(d.down, 4);
d = r.resolve(d, {kind: 'incomplete', thrown: true});
assert.equal(d.outcome, 'downs');
assert.equal(r.resolve(d, {kind: 'run', yards: 99}), d, 'A dead drive cannot score twice');
const next = r.nextDrive(d);
assert.deepEqual([next.spot, next.down, next.drive, next.completions], [25, 1, 2, 2]);
assert.equal(r.resolve(r.initial(), {kind: 'interception', thrown: true}).outcome, 'interception');
const red = {...r.initial(), spot: 94, toGo: 6};
const td = r.resolve(red, {kind: 'run', yards: 10, thrown: true, complete: true});
assert.deepEqual([td.spot, td.points, td.outcome], [100, 6, 'touchdown']);
assert.equal(r.resolve(red, {kind: 'incomplete', thrown: true, yards: 99}).points, 0);
assert.equal(r.resolve({...red, down: 4}, {kind: 'run', yards: 6}).outcome, 'touchdown');
assert.equal(r.resolve({...r.initial(), spot: 2}, {kind: 'sack', yards: -5}).outcome, 'safety');
const tendencies = {...d, recentTargets: [2, 2, 1]};
const possession = r.nextDrive(tendencies);
assert.deepEqual(possession.recentTargets, [2, 2, 1], 'Defensive scouting carries across drives');
possession.recentTargets.push(0);
assert.deepEqual(tendencies.recentTargets, [2, 2, 1], 'New drive does not mutate prior target history');
console.log('PASS drive state: completions, first downs, sacks, incompletions, fourth down, interceptions, touchdown, safety, next possession, duplicate protection.');

const calls = Array.from({length: 120}, (_, seed) => r.callFor('slants', seed * 7919));
assert.ok(new Set(calls.map(c => JSON.stringify(c.receivers))).size > 30, 'Slants change geometry and alignment');
assert.equal(new Set(calls.map(c => c.look.name)).size, 6, 'All six defensive looks occur');
for (const concept of Object.keys(r.concepts)) for (let seed = 0; seed < 100; seed++) {
    const call = r.callFor(concept, seed * 7919);
    assert.deepEqual(call, r.callFor(concept, seed * 7919), 'Audibles preserve a reproducible call');
    for (const receiver of call.receivers) for (const [x, y] of receiver.route) {
        assert.ok(x > 0 && receiver.startY + y >= 2.99 && receiver.startY + y <= 50.01, 'Routes remain in bounds');
    }
}
let stamina = 1;
for (let t = 0; t < 4; t += 1 / 60) stamina = r.energy(stamina, true, true, 1 / 60).stamina;
assert.equal(stamina, 0, 'Holding sprint drains the entire burst');
assert.equal(r.energy(stamina, true, true, 1).sprinting, false, 'Held Shift cannot sprint indefinitely');
assert.equal(r.energy(stamina, false, false, 10).stamina, 0, 'Resting cannot refill energy within a play');
assert.equal(r.energy(1, true, false, 5).stamina, 1, 'Standing still does not consume burst');
assert.ok(r.movement.pursuit > r.movement.carrier, 'Pursuit catches a jogging receiver');
assert.ok(r.movement.pursuit > r.movement.quarterback * r.movement.sprint, 'Quarterbacks cannot outrun pursuit indefinitely');
assert.ok(r.movement.carrier * r.movement.sprint > r.movement.pursuit, 'A receiver burst can create brief separation');
console.log('PASS varied bounded routes, six stable defensive looks, finite burst energy and pursuit balance.');
