// Run with Firebase Auth and Firestore emulators for demo-eagles-leaderboard.
import assert from 'node:assert/strict';

const project = 'demo-eagles-leaderboard';
const base = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;
async function visitor() {
    const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true })
    });
    assert.equal(response.status, 200);
    return response.json();
}
async function write(user, id, nickname, clicks, extra = {}) {
    return fetch(`${base}:commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.idToken}` } : {}) },
        body: JSON.stringify({ writes: [{
            update: { name: `projects/${project}/databases/(default)/documents/clickLeaders/${id}`, fields: {
                nickname: { stringValue: nickname }, clicks: { integerValue: String(clicks) }, ...extra
            } },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }]
        }] })
    });
}
async function expectStatus(response, status) {
    assert.equal(response.status, status, await response.text());
}
const alice = await visitor();
const bob = await visitor();
await expectStatus(await write(alice, alice.localId, 'PhillyAlice', 40), 200);
await expectStatus(await write(bob, bob.localId, 'BirdsBob', 60), 200);
await expectStatus(await write(alice, bob.localId, 'StolenScore', 500), 403);
await expectStatus(await write(null, alice.localId, 'AnonymousWrite', 500), 403);
await expectStatus(await write(alice, alice.localId, 'PhillyAlice', 39), 403);
await expectStatus(await write(alice, alice.localId, 'PhillyAlice', -1), 403);
await expectStatus(await write(alice, alice.localId, 'PhillyAlice', 9007199254740992), 403);
await expectStatus(await write(alice, alice.localId, '<script>alert(1)</script>', 50), 403);
await expectStatus(await write(alice, alice.localId, 'A', 50), 403);
await expectStatus(await write(alice, alice.localId, ' LeadingSpace', 50), 403);
await expectStatus(await write(alice, alice.localId, 'PhillyAlice', 50, { admin: { booleanValue: true } }), 403);
await expectStatus(await write(alice, alice.localId, 'AliceRenamed', 50), 200);
const query = { from: [{ collectionId: 'clickLeaders' }], orderBy: [{ field: { fieldPath: 'clicks' }, direction: 'DESCENDING' }], limit: 25 };
const response = await fetch(`${base}:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery: query }) });
assert.equal(response.status, 200);
const entries = (await response.json()).filter((entry) => entry.document).map((entry) => entry.document.fields);
const ownEntries = entries.filter((entry) => ['BirdsBob', 'AliceRenamed'].includes(entry.nickname.stringValue));
assert.deepEqual(ownEntries.map((entry) => Number(entry.clicks.integerValue)), [60, 50]);
delete query.limit;
await expectStatus(await fetch(`${base}:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery: query }) }), 403);
await expectStatus(await fetch(`${base}/clickLeaders/${bob.localId}`, { headers: { Authorization: `Bearer ${alice.idToken}` } }), 403);
await expectStatus(await fetch(`${base}/clickLeaders/${alice.localId}`, { headers: { Authorization: `Bearer ${alice.idToken}` } }), 200);
await expectStatus(await fetch(`${base}/clickLeaders/${alice.localId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${alice.idToken}` } }), 403);
console.log('PASS: score ordering, own-entry writes, nickname updates, bounded public queries; denied cross-user writes/reads, anonymous writes, decreasing/negative/oversized scores, invalid names, extra fields, deletes, and unlimited queries.');

async function writeBird(user, id, score, nickname = 'BarkleyFan') {
    return fetch(`${base}:commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.idToken}` } : {}) },
        body: JSON.stringify({ writes: [{
            update: { name: `projects/${project}/databases/(default)/documents/barkleyLeaders/${id}`, fields: {
                nickname: { stringValue: nickname }, score: { integerValue: String(score) }
            } },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }]
        }] })
    });
}
await expectStatus(await writeBird(alice, alice.localId, 10), 200);
await expectStatus(await writeBird(bob, alice.localId, 20), 403);
await expectStatus(await writeBird(null, alice.localId, 20), 403);
await expectStatus(await writeBird(alice, alice.localId, 9), 403);
await expectStatus(await writeBird(alice, alice.localId, -1), 403);
await expectStatus(await writeBird(alice, alice.localId, 1000001), 403);
await expectStatus(await writeBird(alice, alice.localId, 20, '<script>'), 403);
await expectStatus(await writeBird(alice, alice.localId, 15), 200);
const birdQuery = { from: [{ collectionId: 'barkleyLeaders' }], orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }], limit: 25 };
await expectStatus(await fetch(`${base}:runQuery`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({structuredQuery: birdQuery})}), 200);
console.log('PASS: Barkley leaderboard ownership, nondecreasing scores, bounded range, nickname validation, and public ranking queries.');
