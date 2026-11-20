import { firebaseConfig, leaderboardEnabled } from './firebase-config.js';

class ClickLeaderboard {
    constructor() {
        this.rows = document.getElementById('leaderboard-rows');
        this.empty = document.getElementById('leaderboard-empty');
        this.status = document.getElementById('leaderboard-status');
        this.syncStatus = document.getElementById('leaderboard-sync');
        this.form = document.getElementById('leaderboard-form');
        this.nameInput = document.getElementById('fan-name');
        this.submit = document.getElementById('leaderboard-submit');
        this.retry = document.getElementById('leaderboard-retry');
        this.save = document.getElementById('leaderboard-save');
        this.nameInput.disabled = false;
        this.submit.disabled = false;
        try {
            this.nameInput.value = localStorage.getItem('fanNickname') || '';
        } catch {
            // Typing and playing must still work with storage disabled.
        }
        this.bird = document.body.dataset.leaderboard === 'barkley';
        this.source = this.bird ? window.barkleyScores : window.eaglesCounter;
        this.collectionName = this.bird ? 'barkleyLeaders' : 'clickLeaders';
        this.scoreField = this.bird ? 'score' : 'clicks';
        this.unit = this.bird ? 'points' : 'clicks';
        this.joined = false;
        this.savedCount = -1;
        this.entries = [];
        this.emulator = ['localhost', '127.0.0.1'].includes(location.hostname)
            && new URLSearchParams(location.search).get('emulator') === '1';
        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.join();
        });
        this.retry.addEventListener('click', () => this.initialize());
        this.save.addEventListener('click', () => this.sync());
        document.addEventListener(this.bird ? 'barkley:change' : 'counter:change', () => this.scheduleSync());
        window.addEventListener('online', () => {
            if (this.joined) this.sync();
        });
        window.addEventListener('offline', () => {
            if (this.joined) this.syncStatus.textContent = 'You are offline. Scores are saved on this browser and will sync when you reconnect.';
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.joined) this.sync();
        });
        this.initialize();
    }

    async initialize() {
        if (this.initializing) return;
        if (!leaderboardEnabled && !this.emulator) {
            this.empty.textContent = 'Global rankings are not connected yet.';
            this.status.textContent = 'The global leaderboard needs to be activated. You can save your nickname and scores on this browser now.';
            this.submit.textContent = 'Save nickname on this browser';
            this.syncStatus.textContent = this.nameInput.value ? `Your nickname: ${this.nameInput.value}. Saved here; not yet published to the global board.` : 'Enter a nickname to save it here. Global ranking becomes available when the shared board is connected.';
            return;
        }
        this.initializing = true;
        this.retry.hidden = true;
        this.status.textContent = 'Connecting to the shared leaderboard…';
        try {
            if (!this.client) {
                const base = 'https://www.gstatic.com/firebasejs/13.4.0';
                const [appSdk, authSdk, storeSdk] = await Promise.all([
                    import(`${base}/firebase-app.js`),
                    import(`${base}/firebase-auth.js`),
                    import(`${base}/firebase-firestore.js`)
                ]);
                const config = this.emulator ? { apiKey: 'demo-key', projectId: 'demo-eagles-leaderboard' } : firebaseConfig;
                const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(config);
                const auth = authSdk.getAuth(app);
                const db = storeSdk.getFirestore(app);
                if (this.emulator) {
                    authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
                    storeSdk.connectFirestoreEmulator(db, '127.0.0.1', 8080);
                }
                this.client = { auth, db, authSdk, storeSdk };
            }
            const { auth, db, storeSdk } = this.client;
            this.unsubscribe?.();
            const leaders = storeSdk.query(storeSdk.collection(db, this.collectionName), storeSdk.orderBy(this.scoreField, 'desc'), storeSdk.limit(25));
            this.unsubscribe = storeSdk.onSnapshot(leaders, (snapshot) => {
                this.entries = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data(), clicks: entry.data()[this.scoreField] }));
                this.render();
                this.status.textContent = snapshot.metadata.fromCache ? 'Showing cached scores. Waiting for the shared board…' : `Live top 25 · Equal ${this.unit} share a rank.`;
                this.retry.hidden = false;
                this.retry.textContent = 'Refresh leaderboard';
            }, () => {
                this.empty.hidden = this.entries.length > 0;
                this.empty.textContent = 'The shared leaderboard is temporarily unavailable.';
                this.status.textContent = 'Could not load shared scores. Your local scores are unaffected.';
                this.retry.hidden = false;
                this.retry.textContent = 'Try connecting again';
            });
            await auth.authStateReady();
            if (auth.currentUser) {
                const own = await storeSdk.getDoc(storeSdk.doc(db, this.collectionName, auth.currentUser.uid));
                if (own.exists()) {
                    this.joined = true;
                    this.nickname = own.data().nickname;
                    this.savedCount = own.data()[this.scoreField];
                    this.nameInput.value = this.nickname;
                    this.nameInput.disabled = false;
                    this.submit.textContent = 'Update nickname';
                    this.save.hidden = false;
                    this.source.restoreCount(this.savedCount);
                    this.render();
                    this.scheduleSync();
                    this.syncStatus.textContent = `Welcome back, ${this.nickname}. Your shared total is ${this.savedCount.toLocaleString()}.`;
                }
            }
            this.nameInput.disabled = false;
            this.submit.disabled = false;
        } catch {
            this.status.textContent = 'Could not connect to the shared leaderboard. Your scores still save locally.';
            this.retry.hidden = false;
            this.retry.textContent = 'Try connecting again';
        } finally {
            this.initializing = false;
        }
    }

    render() {
        this.rows.replaceChildren();
        this.empty.hidden = this.entries.length > 0;
        this.empty.textContent = 'No fans on the board yet. Be the first to join.';
        let previousScore = null;
        let rank = 0;
        this.entries.forEach((entry, index) => {
            if (entry.clicks !== previousScore) rank = index + 1;
            previousScore = entry.clicks;
            const row = document.createElement('tr');
            const own = entry.id === this.client?.auth.currentUser?.uid;
            if (own) row.classList.add('is-you');
            for (const value of [rank.toString().padStart(2, '0'), `${entry.nickname}${own ? ' (you)' : ''}`, entry.clicks.toLocaleString()]) {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            this.rows.append(row);
        });
    }

    async join() {
        const nickname = this.nameInput.value.trim();
        if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,18}[A-Za-z0-9]$/.test(nickname)) {
            this.syncStatus.textContent = 'Use 2–20 characters, starting and ending with a letter or number.';
            return;
        }
        let savedLocally = false;
        try {
            localStorage.setItem('fanNickname', nickname);
            document.dispatchEvent(new Event('arcade:nickname'));
            savedLocally = true;
        } catch {
            // A blocked storage setting must not turn into a broken form.
        }
        if ((!leaderboardEnabled && !this.emulator) || !this.client) {
            this.syncStatus.textContent = savedLocally ? `${nickname} is saved on this browser. The global board is not connected yet; your score has not been published.` : `${nickname} is selected for this session. Browser storage is blocked and the global board is not connected.`;
            return;
        }
        this.submit.disabled = true;
        this.syncStatus.textContent = 'Joining the shared leaderboard…';
        try {
            const { auth, authSdk } = this.client;
            // A stable browser identity keeps visitors from editing each other's entries.
            await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
            if (!auth.currentUser) await authSdk.signInAnonymously(auth);
            this.nickname = nickname;
            this.joined = true;
            this.save.hidden = false;
            await this.sync();
        } catch {
            this.syncStatus.textContent = 'Could not join. Check your connection and allow browser storage, then try again.';
        } finally {
            this.submit.disabled = false;
        }
    }

    scheduleSync() {
        if (!this.joined || this.source.getCount() <= this.savedCount) return;
        this.syncStatus.textContent = 'New score saved locally. Syncing your shared score in a few seconds…';
        if (!this.syncTimer) {
            this.syncTimer = window.setTimeout(() => {
                this.syncTimer = null;
                this.sync();
            }, 5000);
        }
    }

    async sync() {
        window.clearTimeout(this.syncTimer);
        this.syncTimer = null;
        if (!this.joined) return;
        if (!navigator.onLine) {
            this.syncStatus.textContent = 'You are offline. Scores are saved on this browser and will sync when you reconnect.';
            return;
        }
        if (this.saving) {
            this.syncAgain = true;
            return;
        }
        this.saving = true;
        this.save.disabled = true;
        this.syncStatus.textContent = 'Syncing your score…';
        try {
            const { db, auth, storeSdk } = this.client;
            const ref = storeSdk.doc(db, this.collectionName, auth.currentUser.uid);
            const nickname = this.nickname;
            const localCount = this.source.getCount();
            const saved = await storeSdk.runTransaction(db, async (transaction) => {
                const existing = await transaction.get(ref);
                const clicks = Math.max(localCount, existing.exists() ? existing.data()[this.scoreField] : 0);
                if (!existing.exists() || existing.data()[this.scoreField] !== clicks || existing.data().nickname !== nickname) {
                    transaction.set(ref, { nickname, [this.scoreField]: clicks, updatedAt: storeSdk.serverTimestamp() });
                }
                return clicks;
            });
            this.savedCount = saved;
            this.source.restoreCount(saved);
            this.submit.textContent = 'Update nickname';
            this.syncStatus.textContent = `${nickname}: ${saved.toLocaleString()} ${this.unit} shared. Scores auto-sync while this page is open.`;
            this.render();
            this.scheduleSync();
        } catch {
            this.syncStatus.textContent = 'Score not synced. Your scores remain on this browser. Use Sync score now to retry.';
        } finally {
            this.saving = false;
            this.save.disabled = false;
            if (this.syncAgain) {
                this.syncAgain = false;
                this.scheduleSync();
            }
        }
    }
}

const fanLeaderboard = new ClickLeaderboard();
if (fanLeaderboard.bird) document.birdLeaderboard = fanLeaderboard;
else document.clickLeaderboard = fanLeaderboard;
