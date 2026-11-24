import { firebaseConfig, leaderboardEnabled } from './firebase-config.js';

class LeagueBoard {
    constructor() {
        this.api = window.teamArcade;
        this.team = this.api.team;
        this.rows = document.getElementById('board-rows');
        this.status = document.getElementById('board-status');
        this.empty = document.getElementById('board-empty');
        this.syncStatus = document.getElementById('league-sync');
        this.teamFilter = document.getElementById('board-team');
        this.gameFilter = document.getElementById('board-game');
        this.name = document.getElementById('league-name');
        this.submit = document.getElementById('league-join');
        this.syncButton = document.getElementById('league-sync-button');
        this.mode = 'fans';
        this.entries = [];
        this.emulator = ['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('emulator') === '1';
        for (const team of this.api.teams) { const option = document.createElement('option'); option.value=team.id;option.textContent=team.name;this.teamFilter.append(option); }
        for (const game of this.api.games) { const option=document.createElement('option');option.value=game.id;option.textContent=game.title;this.gameFilter.append(option); }
        const requested = new URLSearchParams(location.search).get('game');
        if (['overall','clicks',...this.api.games.map(game=>game.id)].includes(requested)) this.gameFilter.value=requested;
        this.name.value=this.api.storage.getItem('fanNickname') || '';
        document.querySelectorAll('[data-board]').forEach(button=>button.addEventListener('click',()=>{
            this.mode=button.dataset.board;
            document.querySelectorAll('[data-board]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
            this.gameFilter.disabled=this.mode==='teams';
            this.teamFilter.disabled=this.mode==='teams';
            this.load();
        }));
        this.teamFilter.addEventListener('change',()=>this.load());this.gameFilter.addEventListener('change',()=>this.load());
        document.getElementById('board-refresh').addEventListener('click',()=>this.client?this.load():this.connect());
        document.getElementById('league-profile-form').addEventListener('submit',event=>{event.preventDefault();this.join();});
        this.syncButton.addEventListener('click',()=>this.sync());
        document.addEventListener('arcade:progress',()=>{this.breakdown();if(this.joined)this.schedule();});
        window.addEventListener('online',()=>{if(this.joined)this.sync();if(this.client)this.load();});
        this.breakdown();this.connect();
    }
    rawRecord() {
        const records={};
        for(const game of this.api.games){const value=Number(this.api.storage.getItem(game.key));records[game.id]=Number.isSafeInteger(value)&&value>=0?Math.min(1000000,value):0;}
        const rawClicks=Number(this.api.storage.getItem('clickCount'));
        return {records,clicks:Number.isSafeInteger(rawClicks)&&rawClicks>=0?rawClicks:0};
    }
    normalized(records) {
        const scores={};
        for(const game of this.api.games)scores[game.id]=Math.min(100,Math.floor(records[game.id]*100/game.target));
        return {scores,points:Object.values(scores).reduce((sum,value)=>sum+value,0)};
    }
    breakdown() {
        const root=document.getElementById('score-breakdown');root.replaceChildren();
        const values=this.api.points();
        document.querySelectorAll('[data-arcade-points]').forEach(item=>{item.textContent=values.points;});
        for(const game of this.api.games){const card=document.createElement('a');card.href=this.api.link(game.href);card.className='score-breakdown-card';const name=document.createElement('span');name.textContent=game.title;const score=document.createElement('strong');score.textContent=`${values.scores[game.id]} / 100`;const goal=document.createElement('span');goal.textContent=`Full points: ${game.target} ${game.unit}`;card.append(name,score,goal);root.append(card);}
    }
    async connect() {
        if(this.connecting)return;
        if(!leaderboardEnabled&&!this.emulator){this.unavailable('Shared standings are disabled. Your local records remain available.');return;}
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
                    this.restore(own.data());this.syncButton.hidden=false;this.submit.textContent='Update my public nickname';
                    this.syncStatus.textContent=`Welcome back, ${this.nickname}. Your ${this.team.nickname} record is connected.`;this.schedule();
                }
            }
        }catch{this.unavailable('The shared team board is not connected yet. Its Firebase rules and aggregation function must be deployed. Your browser records still work.');}
        finally{this.connecting=false;}
    }
    unavailable(message){this.status.textContent=message;this.status.classList.add('board-offline');this.empty.textContent='No live rankings available. Choose My browser records to see actual saved scores.';this.submit.textContent='Save nickname locally / retry publishing';}
    load(){
        this.unsubscribe?.();this.unsubscribe=null;this.entries=[];
        this.status.classList.remove('board-offline');
        if(this.mode==='local'){this.local();return;}
        if(!this.client){this.unavailable('Shared standings are unavailable. Local records are kept separately.');return;}
        const {store,db}=this.client;
        const field=this.mode==='teams'?'points':this.gameFilter.value==='overall'?'points':this.gameFilter.value==='clicks'?'clicks':`records.${this.gameFilter.value}`;
        const conditions=[];
        if(this.mode==='fans'&&this.teamFilter.value!=='all')conditions.push(store.where('teamId','==',this.teamFilter.value));
        conditions.push(store.orderBy(field,'desc'),store.limit(this.mode==='teams'?32:25));
        const collection=this.mode==='teams'?'teamStandings':'leagueFans';
        this.status.textContent='Loading live standings…';this.empty.textContent='Loading…';this.empty.hidden=false;this.rows.replaceChildren();
        this.unsubscribe=store.onSnapshot(store.query(store.collection(db,collection),...conditions),snapshot=>{
            this.entries=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
            this.render();this.status.textContent=snapshot.metadata.fromCache?'Cached records; reconnecting to the shared board…':this.mode==='teams'?'Live team totals from every published fan record. Equal totals share a rank.':'Live top 25 fan / team records. Equal scores share a rank.';
        },()=>{this.rows.replaceChildren();this.unavailable('Could not load this shared board. The new rules/indexes/function may still need deployment, or the connection is unavailable.');});
    }
    value(entry){return this.mode==='teams'||this.gameFilter.value==='overall'?entry.points:this.gameFilter.value==='clicks'?entry.clicks:entry.records?.[this.gameFilter.value]||0;}
    local(){
        this.entries=[];
        for(const team of this.api.teams){
            const {scores,points}=this.api.points(team.id);const records={};let hasRecord=false;let clicks=0;
            try{
                for(const game of this.api.games){const value=Number(team.id===this.team.id?this.api.storage.getItem(game.key):localStorage.getItem(`nfl:${team.id}:${game.key}`));records[game.id]=Number.isSafeInteger(value)&&value>=0?value:0;if(value>0)hasRecord=true;}
                clicks=Number(team.id===this.team.id?this.api.storage.getItem('clickCount'):localStorage.getItem(`nfl:${team.id}:clickCount`))||0;
            }catch{ /* Current session points remain available. */ }
            if((hasRecord||clicks>0||team.id===this.team.id)&&(this.teamFilter.value==='all'||this.teamFilter.value===team.id))this.entries.push({id:`local-${team.id}`,teamId:team.id,nickname:this.name.value.trim()||'You (unnamed)',points,scores,records,clicks});
        }
        this.entries.sort((a,b)=>this.value(b)-this.value(a));this.render();this.status.textContent='Only real records from this browser. These are not global rankings or shared team totals.';
    }
    render(){
        const teams=this.mode==='teams';
        document.getElementById('board-head').innerHTML=teams?'<tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Fans</th><th scope="col">Points</th></tr>':'<tr><th scope="col">Rank</th><th scope="col">Fan</th><th scope="col">Team</th><th scope="col">Score</th></tr>';
        document.getElementById('board-caption').textContent=teams?'Overall team standings: sum of published fan arcade points.':`${this.mode==='local'?'Browser records':'Top 25 fans'} ranked by ${this.gameFilter.selectedOptions[0].textContent}. Equal scores share a rank.`;
        this.rows.replaceChildren();this.empty.hidden=this.entries.length>0;this.empty.textContent=teams?'No team totals yet. Totals appear after fans publish and the aggregation function runs.':'No published records for this selection yet.';
        let previous=null,rank=0;
        this.entries.forEach((entry,index)=>{
            const team=this.api.teams.find(team=>team.id===(entry.teamId||entry.id));if(!team)return;
            const value=this.value(entry);if(value!==previous)rank=index+1;previous=value;
            const row=document.createElement('tr');if(entry.uid===this.client?.auth.currentUser?.uid||this.mode==='local')row.className='is-you';
            const cells=teams?[rank,team.name,entry.fans||0,value]:[rank,entry.nickname,team.short,value];
            cells.forEach((value,i)=>{const cell=document.createElement('td');cell.textContent=typeof value==='number'?value.toLocaleString():value;if(!teams&&i===2){const pill=document.createElement('span');pill.className='board-team-pill';pill.style.setProperty('--pill',team.primary);pill.textContent=team.short;pill.title=team.name;cell.replaceChildren(pill);}row.append(cell);});
            this.rows.append(row);
        });
    }
    async join(){
        const nickname=this.name.value.trim();
        if(!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,18}[A-Za-z0-9]$/.test(nickname)){this.syncStatus.textContent='Use 2–20 letters, numbers, spaces, underscores, or hyphens; begin and end with a letter or number.';return;}
        this.api.storage.setItem('fanNickname',nickname);document.dispatchEvent(new Event('arcade:nickname'));this.nickname=nickname;
        if(!this.client){this.syncStatus.textContent='Nickname saved for this browser. Your record has not been published; reconnecting…';await this.connect();if(!this.client)return;}
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
    restore(entry){
        for(const game of this.api.games){const value=entry.records?.[game.id];if(Number.isSafeInteger(value)&&value>Number(this.api.storage.getItem(game.key)))this.api.storage.setItem(game.key,value);}
        if(entry.clicks>Number(this.api.storage.getItem('clickCount')))this.api.storage.setItem('clickCount',entry.clicks);
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
                for(const game of this.api.games)records[game.id]=Math.max(local.records[game.id],previous.records?.[game.id]||0);
                const data={uid,teamId,nickname:this.nickname,records,clicks:Math.max(local.clicks,previous.clicks||0),...this.normalized(records),updatedAt:store.serverTimestamp()};
                tx.set(ref,data);return data;
            });
            this.restore(result);this.submit.textContent='Update my public nickname';this.syncStatus.textContent=`Published ${result.points} arcade points for ${this.team.name} as ${this.nickname}. Team totals update shortly.`;
        }catch(error){this.lastError=error.code;this.syncStatus.textContent='Not published. Your local record is safe. Retry after the shared rules and function are ready.';}
        finally{this.saving=false;this.syncButton.disabled=false;if(this.again){this.again=false;this.schedule();}}
    }
}
window.leagueBoard=new LeagueBoard();
