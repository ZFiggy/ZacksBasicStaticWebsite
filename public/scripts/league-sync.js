// Opted-in records continue syncing while a game or the fan scoreboard is open.
// Never create an anonymous identity or publish until the visitor has joined.
import {firebaseConfig, leaderboardEnabled} from './firebase-config.js';
const api = window.teamArcade;
if (api && api.storage.getItem('leagueJoined') === '1') {
    const emulator = ['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('emulator') === '1';
    let client, timer, saving = false, again = false;
    async function sync() {
        if (saving) { again = true; return; }
        if (!navigator.onLine || (!leaderboardEnabled && !emulator)) return;
        const nickname = api.storage.getItem('fanNickname');
        if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,18}[A-Za-z0-9]$/.test(nickname || '')) return;
        saving = true;
        try {
            if (!client) {
                const base = 'https://www.gstatic.com/firebasejs/13.4.0';
                const [appSdk, authSdk, store] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)]);
                const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(emulator ? {apiKey:'demo-key',projectId:'demo-eagles-leaderboard'} : firebaseConfig);
                const auth = authSdk.getAuth(app), db = store.getFirestore(app);
                if (emulator) { authSdk.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});store.connectFirestoreEmulator(db,'127.0.0.1',8080); }
                client = {auth,db,store};
            }
            const {auth,db,store} = client;
            await auth.authStateReady();
            if (!auth.currentUser) return;
            const uid = auth.currentUser.uid, teamId = api.team.id;
            const ref = store.doc(db,'leagueFans',`${uid}_${teamId}`);
            await store.runTransaction(db, async transaction => {
                const existing = await transaction.get(ref);
                if (!existing.exists()) return;
                const previous = existing.data(), records = {}, scores = {};
                for (const game of api.recordGames) {
                    const raw = Number(api.storage.getItem(game.key));
                    const value = Number.isSafeInteger(raw) && raw >= 0 ? Math.min(1000000,raw) : 0;
                    records[game.id] = Math.max(value,previous.records[game.id]);
                    scores[game.id] = Math.min(100,Math.floor(records[game.id]*100/game.target));
                }
                const rawClicks = Number(api.storage.getItem('clickCount'));
                const clicks = Math.max(Number.isSafeInteger(rawClicks) && rawClicks >= 0 ? rawClicks : 0,previous.clicks);
                if (clicks === previous.clicks && nickname === previous.nickname && api.recordGames.every(game => records[game.id] === previous.records[game.id])) return;
                transaction.set(ref,{uid,teamId,nickname,records,scores,points:Object.values(scores).reduce((sum,value)=>sum+value,0),clicks,updatedAt:store.serverTimestamp()});
            });
            const notice = document.getElementById('team-sync-status');
            if (notice) notice.textContent = 'Team record synced. Play on.';
        } catch {
            const notice = document.getElementById('team-sync-status');
            if (notice) notice.textContent = 'Shared sync unavailable. Your records remain on this browser.';
        } finally {
            saving = false;
            if (again) { again = false; schedule(); }
        }
    }
    function schedule() { if (!timer) timer = setTimeout(() => {timer = null; sync();},5000); }
    document.addEventListener('arcade:progress',schedule);
    window.addEventListener('online',schedule);
    schedule();
}
