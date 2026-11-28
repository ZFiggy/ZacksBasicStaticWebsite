import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const teamData = readFileSync('public/scripts/teams-data.js', 'utf8');
const source = readFileSync('public/scripts/teams.js', 'utf8');
const saved = new Map();
function load(team = 'eagles') {
    const context = vm.createContext({
        URL, URLSearchParams, Map,
        location: {pathname:'/index.html', search:`?team=${team}`, href:`http://localhost/index.html?team=${team}`, origin:'http://localhost', hostname:'localhost'},
        localStorage: {getItem:key => saved.get(key) ?? null, setItem:(key, value) => saved.set(key, String(value))},
        document: {querySelector:() => null, documentElement:{dataset:{}, style:{setProperty(){}}}},
        addEventListener() {}
    });
    context.window = context;
    vm.runInContext(teamData, context);
    vm.runInContext(source, context);
    return context.teamArcade;
}
const api = load();
assert.equal(api.maxPoints, 1000);
assert.equal(api.scoringGames.length, 6);
const targets = {game:10, bird:25, search:5, kick:15, pocket:18};
assert.equal(api.normalizeRecords(targets, 1400).points, 1000);
assert.equal(api.normalizeRecords(Object.fromEntries(Object.keys(targets).map(id => [id, 1000000])), 9007199254740991).points, 1000);
const partial = api.normalizeRecords({game:3, bird:10, search:1, kick:1, pocket:6}, 4);
assert.equal(JSON.stringify(partial.scores), JSON.stringify({game:60, bird:80, search:20, kick:7, pocket:67, scoreboard:1}));
assert.equal(partial.points, 235); // Sum each rounded contribution.
assert.equal(api.normalizeRecords({shove:5, recall:8, punt:500, blitz:3, signal:1}).points, 0);
for (const value of [-1, NaN, Infinity, 1.5, '25', undefined]) {
    for (const game of api.scoringGames) assert.equal(api.scoreRecord(game, value), 0);
}
for (const team of api.teams) {
    const current = load(team.id);
    for (const game of current.scoringGames) current.storage.setItem(game.key, game.target);
    assert.equal(current.points().points, 1000, team.id);
    current.storage.setItem('barkleyBest', 10);
    assert.equal(current.points().scores.bird, 80, team.id);
    current.storage.setItem('fieldRunWins', 999999);
    current.storage.setItem('playbook-pocket-best', 999999);
    current.storage.setItem('touchdownRushBest', 3);
    current.storage.setItem('passingPointsBest', 6);
    assert.equal(current.points().scores.game, 60, team.id);
    assert.equal(current.points().scores.pocket, 67, team.id);
}
const eagles = load();
eagles.storage.setItem('clickCount', 3);
assert.equal(eagles.points().scores.scoreboard, 0);
assert.equal(eagles.points('cowboys').scores.scoreboard, 200);
assert.equal(eagles.points('cowboys').points, load('cowboys').points().points);
console.log('PASS all six targets, partial credit, rounding, caps, invalid records, retired games, correct record keys, and 32-team isolation.');
