// Run only with explicit authorization against a selected Firebase project.
// Uses the Admin SDK's normal credentials; never loads repository env files.
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {aggregateFan} = require('./aggregate.js');
const teamIds = require('./team-ids.json');
const projectId = process.argv[2];
if (!projectId || !process.argv.includes('--apply')) {
    console.error('Usage: node functions/backfill-clicks.cjs PROJECT_ID --apply');
    process.exitCode = 1;
} else {
    const db = getFirestore(initializeApp({projectId}));
    (async () => {
        // Existing ledgers without clicks contribute their full click count once.
        // Re-running uses the ledger and does not double-count.
        for (const teamId of teamIds) {
            const ref = db.doc(`teamStandings/${teamId}`);
            await db.runTransaction(async tx => {
                const snapshot = await tx.get(ref);
                if (!snapshot.exists) tx.set(ref, {teamId, points: 0, clicks: 0, fans: 0, updatedAt: FieldValue.serverTimestamp()});
                else if (!Number.isSafeInteger(snapshot.data().clicks)) tx.update(ref, {clicks: 0});
            });
        }
        const fans = await db.collection('leagueFans').get();
        for (const fan of fans.docs) await aggregateFan(db, fan.id, teamIds, () => FieldValue.serverTimestamp());
        console.log(`Updated click contributions for ${fans.size} fan/team records across 32 teams.`);
    })().catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    }).finally(() => db.terminate());
}
