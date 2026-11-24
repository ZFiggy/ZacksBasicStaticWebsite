// Requires local Auth/Firestore emulators for demo-eagles-leaderboard.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const project = 'demo-eagles-leaderboard';
const base = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;
const goals = {game:5,bird:20,search:5,kick:15,pocket:10,shove:5,recall:8,punt:500,blitz:3,signal:1};
async function visitor() {
    const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
    assert.equal(response.status,200);return response.json();
}
function entry(user,teamId='eagles',bird=4) {
    const records=Object.fromEntries(Object.keys(goals).map(key=>[key,key==='bird'?bird:0]));
    const scores=Object.fromEntries(Object.keys(goals).map(key=>[key,Math.min(100,Math.floor(records[key]*100/goals[key]))]));
    return {uid:user.localId,teamId,nickname:'SundayTester',records,scores,points:Object.values(scores).reduce((sum,value)=>sum+value,0),clicks:7};
}
function fields(object) {
    return Object.fromEntries(Object.entries(object).map(([key,value])=>[key,typeof value==='string'?{stringValue:value}:typeof value==='number'?{integerValue:String(value)}:{mapValue:{fields:fields(value)}}]));
}
async function write(user,path,data) {
    return fetch(`${base}:commit`,{method:'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${user.idToken}`}:{})},body:JSON.stringify({writes:[{update:{name:`projects/${project}/databases/(default)/documents/${path}`,fields:fields(data)},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}]})});
}
async function expect(response,status){assert.equal(response.status,status,await response.text());}
const alice=await visitor(),bob=await visitor();
const alicePath=`leagueFans/${alice.localId}_eagles`,bobPath=`leagueFans/${bob.localId}_eagles`;
await expect(await fetch(`${base}/${alicePath}`,{headers:{Authorization:`Bearer ${alice.idToken}`}}),404);
await expect(await write(alice,alicePath,entry(alice)),200);
await expect(await write(bob,bobPath,entry(bob,'eagles',10)),200);
await expect(await write(null,alicePath,entry(alice)),403);
await expect(await write(bob,alicePath,entry(alice)),403);
await expect(await write(alice,alicePath,{...entry(alice),teamId:'fake-team'}),403);
await expect(await write(alice,alicePath,{...entry(alice),points:1000}),403);
await expect(await write(alice,alicePath,{...entry(alice),scores:{...entry(alice).scores,bird:100}}),403);
await expect(await write(alice,alicePath,entry(alice,'eagles',3)),403);
await expect(await write(alice,alicePath,{...entry(alice),nickname:'<script>x</script>'}),403);
await expect(await write(alice,alicePath,{...entry(alice),admin:'yes'}),403);
await expect(await write(alice,alicePath,{...entry(alice),records:{...entry(alice).records,bird:-1}}),403);
await expect(await write(alice,alicePath,{...entry(alice),clicks:6}),403);
await expect(await write(alice,`leagueFans/${alice.localId}_cowboys`,entry(alice,'cowboys',6)),200);
await expect(await write(alice,'teamStandings/eagles',{teamId:'eagles',points:999,fans:20}),403);
await expect(await write(alice,`leagueContributions/${alice.localId}_eagles`,{teamId:'eagles',points:999}),403);
const query={from:[{collectionId:'leagueFans'}],orderBy:[{field:{fieldPath:'points'},direction:'DESCENDING'}],limit:25};
await expect(await fetch(`${base}:runQuery`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:query})}),200);
delete query.limit;
await expect(await fetch(`${base}:runQuery`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:query})}),403);
await expect(await fetch(`${base}/${bobPath}`,{headers:{Authorization:`Bearer ${alice.idToken}`}}),403);
await expect(await fetch(`${base}/${alicePath}`,{headers:{Authorization:`Bearer ${alice.idToken}`}}),200);
await expect(await fetch(`${base}/${alicePath}`,{method:'DELETE',headers:{Authorization:`Bearer ${alice.idToken}`}}),403);
// Server-side aggregation: two fans, another team, duplicate/reordered deliveries.
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {aggregateFan}=require('../functions/aggregate.js');
const teamIds=require('../functions/team-ids.json');
const db=getFirestore(initializeApp({projectId:project},`league-test-${Date.now()}`));
const aggregate=id=>aggregateFan(db,id,teamIds,()=>FieldValue.serverTimestamp());
// Fresh database namespace for the standings assertion, preserving prior test documents.
await db.doc('teamStandings/eagles').set({teamId:'eagles',points:0,fans:0});
await db.doc('teamStandings/cowboys').set({teamId:'cowboys',points:0,fans:0});
await Promise.all([aggregate(`${alice.localId}_eagles`),aggregate(`${bob.localId}_eagles`),aggregate(`${alice.localId}_cowboys`)]);
let standing=(await db.doc('teamStandings/eagles').get()).data();
assert.equal(standing.points,70);assert.equal(standing.fans,2);
assert.equal((await db.doc('teamStandings/cowboys').get()).data().points,30);
await Promise.all([aggregate(`${alice.localId}_eagles`),aggregate(`${alice.localId}_eagles`)]);
assert.equal((await db.doc('teamStandings/eagles').get()).data().points,70);
await expect(await write(alice,alicePath,entry(alice,'eagles',8)),200);
await aggregate(`${alice.localId}_eagles`);await aggregate(`${alice.localId}_eagles`);
standing=(await db.doc('teamStandings/eagles').get()).data();assert.equal(standing.points,90);assert.equal(standing.fans,2);
await db.doc(bobPath).delete();await aggregate(`${bob.localId}_eagles`);await aggregate(`${bob.localId}_eagles`);
standing=(await db.doc('teamStandings/eagles').get()).data();assert.equal(standing.points,40);assert.equal(standing.fans,1);
await db.terminate();
console.log('PASS: team-aware records, raw/normalized score validation, own-entry security, immutable team identity, monotonic scores, bounded reads, server-only team totals, multi-team identities, exact all-fan aggregation, duplicate delivery, updates and removals.');
