import { firebaseConfig, leaderboardEnabled } from './firebase-config.js';

class LeagueBoard {
    constructor() {
        this.api = window.teamArcade;
        this.team = this.api.team;
        this.rows = document.getElementById('board-rows');
        this.status = document.getElementById('board-status');
        this.empty = document.getElementById('board-empty');
        this.syncStatus = document.getElementById('league-sync');
        this.name = document.getElementById('league-name');
        this.submit = document.getElementById('league-join');
        this.syncButton = document.getElementById('league-sync-button');
        this.bird = document.body.dataset.rankings === 'bird';
        this.mode = this.bird ? 'fans' : 'teams';
        this.entries = [];
        this.emulator = ['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('emulator') === '1';
        this.name.value=this.api.storage.getItem('fanNickname') || (this.bird ? '' : 'TeamFan');
        document.getElementById('board-refresh').addEventListener('click',()=>this.client?this.load():this.connect());
        document.getElementById('league-profile-form').addEventListener('submit',event=>{event.preventDefault();this.join();});
        this.syncButton.addEventListener('click',()=>this.sync());
        document.addEventListener('arcade:progress',()=>{this.breakdown();if(this.joined)this.schedule();});
        window.addEventListener('online',()=>{if(this.joined)this.sync();if(this.client)this.load();});
        this.breakdown();this.render();this.connect();
    }
    rawRecord() {
        const records={};
        for(const game of this.api.recordGames){const value=Number(this.api.storage.getItem(game.key));records[game.id]=Number.isSafeInteger(value)&&value>=0?Math.min(1000000,value):0;}
        const rawClicks=Number(this.api.storage.getItem('clickCount'));
        return {records,clicks:Number.isSafeInteger(rawClicks)&&rawClicks>=0?rawClicks:0};
    }
    normalized(records, clicks) {
        return this.api.normalizeRecords(records, clicks);
    }
    breakdown() {
        const best = Number(this.api.storage.getItem('barkleyBest')) || 0;
        if (this.bird) this.submit.textContent = this.joined ? 'Update my public nickname' : `Publish my flight · ${best} pts`;
    }
    async connect() {
        if(this.connecting)return;
        if(!leaderboardEnabled&&!this.emulator){this.unavailable('Shared rankings are not connected yet. Your progress stays saved here.');return;}
        this.connecting=true;this.status.textContent='Connecting to shared standings…';
        try{
            if(!this.client){
                const base='https://www.gstatic.com/firebasejs/13.4.0';
                const [appSdk,authSdk,store]=await Promise.all([import(`${base}/firebase-app.js`),import(`${base}/firebase-auth.js`),import(`${base}/firebase-firestore.js`)]);
                const app=appSdk.getApps().length?appSdk.getApp():appSdk.initializeApp(this.emulator?{apiKey:'demo-key',projectId:'demo-eagles-leaderboard'}:firebaseConfig);
                const auth=authSdk.getAuth(app),db=store.getFirestore(app);
                if(this.emulator){authSdk.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});store.connectFirestoreEmulator(db,'127.0.0.1',8080);}
                this.client={auth,db,store,authSdk};
            }
            this.load();
            await this.client.auth.authStateReady();
            if(this.client.auth.currentUser){
                const {store,db,auth}=this.client;
                const own=await store.getDoc(store.doc(db,'leagueFans',`${auth.currentUser.uid}_${this.team.id}`));
                if(own.exists()){
                    this.joined=true;this.api.storage.setItem('leagueJoined','1');this.nickname=own.data().nickname;this.name.value=this.nickname;
                    this.restore(own.data());this.syncButton.hidden=false;this.submit.textContent=this.bird?'Update my public nickname':'Contribute my team clicks';
                    this.syncStatus.textContent=`Welcome back, ${this.nickname}. Your ${this.team.nickname} record is connected.`;this.schedule();
                }
            }
        }catch{this.unavailable('Could not connect to shared rankings. Your progress stays saved on this browser.');}
        finally{this.connecting=false;}
    }
    unavailable(message){this.empty.hidden=true;this.status.textContent=message;this.status.classList.add('board-offline');this.empty.textContent='Live rankings are unavailable. Your progress remains saved on this browser.';this.submit.textContent=this.bird?'Save nickname / retry publishing':'Contribute clicks / retry';}
    load(){
        this.unsubscribe?.();this.unsubscribe=null;this.entries=[];
        this.status.classList.remove('board-offline');
        if(!this.client){this.unavailable('Shared standings are unavailable. Local records are kept separately.');return;}
        const {store,db}=this.client;
        const field=this.mode==='teams'?'clicks':'records.bird';
        const conditions=[];
        conditions.push(store.orderBy(field,'desc'),store.limit(this.mode==='teams'?32:25));
        const collection=this.mode==='teams'?'teamStandings':'leagueFans';
        this.status.textContent='Loading live standings…';this.empty.textContent='Loading…';this.empty.hidden=false;this.rows.replaceChildren();
        this.unsubscribe=store.onSnapshot(store.query(store.collection(db,collection),...conditions),snapshot=>{
            this.entries=snapshot.docs.map(doc=>({id:doc.id,...doc.data()})).filter(entry => this.bird ? entry.records?.bird > 0 : true);
            this.render();this.status.textContent=snapshot.metadata.fromCache?'Cached records; reconnecting to the shared board…':this.mode==='teams'?'Live totals of published scoreboard clicks. Equal totals share a rank.':'Live top 25 flights across all teams. Equal points share a rank.';
        },()=>{this.rows.replaceChildren();this.unavailable('Could not load live rankings. Use Refresh standings to try again.');});
    }
    value(entry) { return this.bird ? entry.records?.bird || 0 : entry.clicks || 0; }
    render(){
        const teams=this.mode==='teams';
        document.getElementById('board-head').innerHTML=teams?'<tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Total clicks</th></tr>':'<tr><th scope="col">Rank</th><th scope="col">Fan</th><th scope="col">Team</th><th scope="col">Points</th></tr>';
        document.getElementById('board-caption').textContent=teams?'Teams ranked by total scoreboard clicks. Equal totals share a rank.':'Top 25 flights: fan, represented team, and points. Equal points share a rank.';
        this.rows.replaceChildren();this.empty.hidden=this.entries.length>0;this.empty.textContent=teams?'No team click totals yet. Contribute your clicks to start the board.':'No published records for this selection yet.';
        let previous=null,rank=0;
        this.entries.forEach((entry,index)=>{
            const team=this.api.teams.find(team=>team.id===(entry.teamId||entry.id));if(!team)return;
            const value=this.value(entry);if(value!==previous)rank=index+1;previous=value;
            const row=document.createElement('tr');if(this.bird && entry.uid===this.client?.auth.currentUser?.uid)row.className='is-you';
            const cells=teams?[rank,team.name,value]:[rank,entry.nickname,team.short,value];
            cells.forEach((value,i)=>{const cell=document.createElement('td');cell.textContent=typeof value==='number'?value.toLocaleString():value;if(!teams&&i===2){const pill=document.createElement('span');pill.className='board-team-pill';pill.style.setProperty('--pill',team.primary);pill.textContent=team.short;pill.title=team.name;cell.replaceChildren(pill);}row.append(cell);});
            this.rows.append(row);
        });
    }
    async join(){
        const nickname=this.name.value.trim();
        if(!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,18}[A-Za-z0-9]$/.test(nickname)){this.syncStatus.textContent='Use 2–20 letters, numbers, spaces, underscores, or hyphens; begin and end with a letter or number.';return;}
        this.api.storage.setItem('fanNickname',nickname);document.dispatchEvent(new Event('arcade:nickname'));this.nickname=nickname;
        if(!this.client){this.syncStatus.textContent=this.bird?'Nickname saved here. Your flight is not published; reconnecting…':'Your clicks stay saved here. Reconnecting to share your team total…';await this.connect();if(!this.client)return;}
        this.submit.disabled=true;
        try{
            const {auth,authSdk}=this.client;
            await authSdk.setPersistence(auth,authSdk.browserLocalPersistence);
            if(!auth.currentUser)await authSdk.signInAnonymously(auth);
            this.joined=true;
            this.api.storage.setItem('leagueJoined','1');
            this.syncButton.hidden=false;await this.sync();
        }catch{this.syncStatus.textContent='Could not join. Your nickname and scores remain on this browser. Retry when the shared service is ready.';}
        finally{this.submit.disabled=false;}
    }
    previousRecords(entry) {
        if (entry.scoringVersion === this.api.scoringVersion) return entry.records || {};
        // Legacy Rush wins and passing completions cannot become levels or points.
        const {bird = 0, search = 0, kick = 0} = entry.records || {};
        return {bird, search, kick};
    }
    restore(entry){
        for(const game of this.api.recordGames){const value=this.previousRecords(entry)[game.id];if(Number.isSafeInteger(value)&&value>Number(this.api.storage.getItem(game.key)))this.api.storage.setItem(game.key,value);}
        if(entry.clicks>Number(this.api.storage.getItem('clickCount')))this.api.storage.setItem('clickCount',entry.clicks);
        if (this.bird) window.barkleyScores?.restoreCount(this.previousRecords(entry).bird || 0);
        else window.eaglesCounter?.restoreCount(entry.clicks || 0);
        this.breakdown();
    }
    schedule(){if(this.timer)return;this.timer=setTimeout(()=>{this.timer=null;this.sync();},2000);}
    async sync(){
        if(!this.joined||!this.client)return;
        if(this.saving){this.again=true;return;}
        if(!navigator.onLine){this.syncStatus.textContent='Offline. Scores stay here; they will retry when you reconnect.';return;}
        this.saving=true;this.syncButton.disabled=true;this.syncStatus.textContent='Publishing your team record…';
        try{
            const {store,db,auth}=this.client;const uid=auth.currentUser.uid,teamId=this.team.id;
            const ref=store.doc(db,'leagueFans',`${uid}_${teamId}`);const local=this.rawRecord();
            const result=await store.runTransaction(db,async tx=>{
                const existing=await tx.get(ref),previous=existing.exists()?existing.data():{};const records={};
                for(const game of this.api.recordGames)records[game.id]=Math.max(local.records[game.id],this.previousRecords(previous)[game.id]||0);
                const data={uid,teamId,nickname:this.nickname,records,clicks:Math.max(local.clicks,previous.clicks||0),...this.normalized(records, Math.max(local.clicks,previous.clicks||0)),scoringVersion:this.api.scoringVersion,updatedAt:store.serverTimestamp()};
                tx.set(ref,data);return data;
            });
            this.restore(result);this.submit.textContent=this.bird?'Update my public nickname':'Contribute my team clicks';this.syncStatus.textContent=this.bird ? `Published ${result.records.bird} flight points for ${this.team.name} as ${this.nickname}.` : `Published ${result.clicks.toLocaleString()} scoreboard clicks for ${this.team.name}. Team totals update shortly.`;
        }catch(error){this.lastError=error.code;this.syncStatus.textContent='Your score was not published. It stays saved here; use Sync now to try again.';}
        finally{this.saving=false;this.syncButton.disabled=false;if(this.again){this.again=false;this.schedule();}}
    }
}
window.leagueBoard=new LeagueBoard();
