import assert from 'node:assert/strict';
import '../public/scripts/touchdown-rules.js';
const r = globalThis.TouchdownRules;
let count = 0, fallback = 0;
for (const level of [1, 2, 3, 5, 8, 12, 13, 20, 50, 100, 1000]) {
    for (let seed = 0; seed < 25; seed++) {
        const field = r.generate(level, seed);
        if (!field.walls.length) fallback++;
        let state = r.initial(field);
        assert.ok(field.solution.length <= field.budget);
        assert.equal(field.solution.length, field.par);
        for (const move of field.solution) {
            state = r.step(field, state, ...move);
            assert.ok(state && !state.caught, `Valid chase route: level ${level}, seed ${seed}`);
        }
        assert.equal(state.x, r.cols - 1);
        assert.equal(state.carrying, true);
        assert.ok(field.rushers.length >= 2);
        if (seed < 2) assert.deepEqual(r.generate(level, seed), field, 'Retries reproduce the same field');
        count++;
    }
}
const f = r.generate(1, 42);
assert.equal(r.step(f, {...r.initial(f), x: 0, y: 0}, -1, 0), null);
const simple = {walls: [], allies: [], rushers: [{x: 6, y: 1}], burstEvery: 6, ball: {x: 10, y: 4}};
let state = {...r.initial(simple), x: 2, y: 1};
const chased = r.step(simple, state, 1, 0);
assert.deepEqual(chased.defenders, [{x: 5, y: 1}], 'Chaser closes horizontally toward the player');
const downward = r.step(simple, {...state, y: 4, defenders: [{x: 3, y: 1}]}, 1, 0);
assert.deepEqual(downward.defenders, [{x: 3, y: 2}], 'Chaser turns vertically toward the player');
const burst = r.step(simple, {...state, turn: 5}, 1, 0);
assert.deepEqual(burst.defenders, [{x: 4, y: 1}], 'Burst turn moves twice');
const protectedField = {...simple, allies: [{x: 3, y: 4}], rushers: [{x: 3, y: 2}]};
assert.equal(r.step(protectedField, {...r.initial(protectedField), x: 2}, 1, 0).caught, false);
const caught = r.step(simple, {...state, y: 4, defenders: [{x: 3, y: 4}]}, 1, 0);
assert.equal(caught.caught, true);
assert.equal(caught.captor, 0);
const walls = {...simple, walls: [{x: 4, y: 2}, {x: 3, y: 3}]};
assert.equal(r.step(walls, {...state, x: 3, y: 2}, 1, 0), null);
const route = r.returnRoute(walls, {x: 12, y: 4});
assert.equal(route.at(-1).x, 0);
for (let i = 1; i < route.length; i++) {
    assert.ok(r.walkable(walls, route[i]));
    assert.equal(Math.abs(route[i].x-route[i-1].x)+Math.abs(route[i].y-route[i-1].y),1);
}
assert.equal(r.rating(f, f.par).stars, 3);
assert.equal(r.rating(f, f.par + 2).stars, 2);
assert.equal(r.rating(f, f.par + 3).stars, 1);
assert.equal(r.rating(f, f.par, 1).stars, 1);
assert.equal(r.rating(f, f.par).points - r.rating(f, f.par + 1).points, 100);
assert.equal(r.rating(f, f.par).points - r.rating(f, f.par, 1).points, 250);
console.log(`PASS ${count} chase fields and winning routes (${fallback} fallbacks), pursuit in both axes, bursts, collision, protection, return paths, and efficiency rewards.`);
const previewField = {walls: [{x: 4, y: 3}], allies: [], rushers: [{x: 6, y: 4}], burstEvery: 6, budget: 40, ball: {x: 12, y: 4}};
const previewState = {...r.initial(previewField), x: 4, y: 4};
const prediction = (field, state, dx, dy) => r.preview(field, state).find(p => p.dx === dx && p.dy === dy).outcome;
assert.equal(prediction(previewField, previewState, 1, 0), 'tackle', 'Moving into chase range is marked as a tackle');
assert.equal(prediction(previewField, previewState, 0, 0), 'safe', 'Adjacent after chase is safe');
assert.equal(prediction(previewField, {...previewState, turn: 5}, 0, 0), 'tackle', 'Preview includes second burst move');
assert.equal(prediction(previewField, previewState, 0, -1), 'blocked', 'Static blocker stops movement');
assert.equal(prediction({...previewField, budget: 1}, previewState, -1, 0), 'expired', 'Clock expiration is distinct from contact');
assert.equal(prediction({...previewField, allies: [{x: 5, y: 4}]}, {...previewState, defenders: [{x: 7, y: 4}]}, 1, 0), 'protected');
assert.equal(r.protectedAt({...previewField, allies: [{x: 5, y: 4}]}, {x: 4, y: 3}), false, 'Diagonal tiles have no shield');
assert.equal(r.step(previewField, {...previewState, defenders: [{x: 5, y: 4}]}, 1, 0).tackleReason, 'contact');
assert.equal(r.step(previewField, previewState, 1, 0).tackleReason, 'chase');
assert.equal(prediction(previewField, {...previewState, x: 17, carrying: true}, 1, 0), 'touchdown');
console.log('PASS exact next-move previews: contact, pursuit, bursts, adjacent safety, shields, blocked moves, touchdown, and clock expiration.');
