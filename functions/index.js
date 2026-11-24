const {onDocumentWritten} = require('firebase-functions/v2/firestore');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {aggregateFan} = require('./aggregate');
const teamIds = require('./team-ids.json');
initializeApp();
exports.updateTeamStandings = onDocumentWritten({
    document: 'leagueFans/{entryId}',
    region: 'us-central1',
    retry: true,
    maxInstances: 4
}, event => aggregateFan(getFirestore(), event.params.entryId, teamIds, () => FieldValue.serverTimestamp()));
