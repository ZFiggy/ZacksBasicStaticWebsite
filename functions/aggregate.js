// Shared by the trigger and emulator tests. Read current source state rather than
// trusting event ordering: Firestore can deliver events more than once/out of order.
async function aggregateFan(db, entryId, teamIds, serverTimestamp) {
    const sourceRef = db.doc(`leagueFans/${entryId}`);
    const appliedRef = db.doc(`leagueContributions/${entryId}`);
    return db.runTransaction(async transaction => {
        const [source, applied] = await Promise.all([transaction.get(sourceRef), transaction.get(appliedRef)]);
        const current = source.exists ? source.data() : null;
        const previous = applied.exists ? applied.data() : null;
        const teamId = current?.teamId || previous?.teamId;
        if (!teamIds.includes(teamId)) return;
        if (current && (!Number.isInteger(current.points) || current.points < 0 || current.points > 1000)) return;
        const points = current?.points || 0;
        const before = previous?.points || 0;
        const clicks = current?.clicks || 0;
        const previousClicks = previous?.clicks || 0;
        if (!Number.isSafeInteger(clicks) || clicks < 0) return;
        const membership = current ? 1 : 0;
        const previousMembership = previous?.active ? 1 : 0;
        if (previous && before === points && previousClicks === clicks && membership === previousMembership) return;
        const teamRef = db.doc(`teamStandings/${teamId}`);
        const team = await transaction.get(teamRef);
        const total = team.exists ? team.data() : {points: 0, fans: 0};
        transaction.set(teamRef, {
            teamId,
            clicks: Math.max(0, (total.clicks || 0) + clicks - previousClicks),
            points: Math.max(0, total.points + points - before),
            fans: Math.max(0, total.fans + membership - previousMembership),
            updatedAt: serverTimestamp()
        });
        transaction.set(appliedRef, {teamId, points, clicks, active: Boolean(current)});
    });
}
module.exports = {aggregateFan};
