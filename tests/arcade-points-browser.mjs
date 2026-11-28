import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
class Cdp {
    constructor(url) {
        this.ws = new WebSocket(url);
        this.id = 0;
        this.pending = new Map();
        this.errors = [];
        this.ready = new Promise(resolve => this.ws.addEventListener('open', resolve, {once: true}));
        this.ws.addEventListener('message', ({data}) => {
            const message = JSON.parse(data);
            if (message.method === 'Runtime.exceptionThrown') this.errors.push(message.params.exceptionDetails);
            if (message.id) {
                const handler = this.pending.get(message.id);
                this.pending.delete(message.id);
                message.error ? handler.reject(message.error) : handler.resolve(message.result);
            }
        });
    }
    async send(method, params = {}) {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.pending.set(++this.id, {resolve, reject});
            this.ws.send(JSON.stringify({id: this.id, method, params}));
        });
    }
    async evaluate(expression) {
        const response = await this.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
        if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
        return response.result.value;
    }
    async until(expression) {
        for (let i = 0; i < 200; i++) {
            if (await this.evaluate(expression)) return;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Timed out: ${expression}\n${await this.evaluate('document.body.innerText')}`);
    }
    async navigate(emulator = true) {
        await this.send('Page.navigate', {url: `http://localhost:8000/counter.html?${emulator ? 'emulator=1&' : ''}qa=${Date.now()}`});
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.until("document.readyState === 'complete' && !!document.clickLeaderboard");
    }
}
const browserInfo = await (await fetch('http://localhost:9224/json/version')).json();
const browser = new Cdp(browserInfo.webSocketDebuggerUrl);
async function visitor() {
    const context = await browser.send('Target.createBrowserContext');
    const {targetId} = await browser.send('Target.createTarget', {url: 'about:blank', browserContextId: context.browserContextId});
    const targets = await (await fetch('http://localhost:9224/json/list')).json();
    const client = new Cdp(targets.find(t => t.id === targetId).webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', {cacheDisabled: true});
    return client;
}

const client = await visitor();
async function go(page) {
    await client.send('Page.navigate',{url:`http://localhost:8000/${page}`});
    await new Promise(resolve=>setTimeout(resolve,100));
    await client.until("document.readyState==='complete' && !!window.teamArcade && !!window.teamArcade.personality");
}

await go('index.html?team=eagles');
const teams = await client.evaluate('teamArcade.teams.map(team => team.id)');
for (const team of teams) {
    await go(`index.html?team=${team}`);
    await client.until('document.querySelectorAll(".home-game-points").length===6');
    const result = await client.evaluate(`(() => {
        const api=teamArcade;
        for (const game of api.scoringGames) api.storage.setItem(game.key, game.target);
        api.storage.setItem('playbook-shove-best', 100);
        document.dispatchEvent(new Event('arcade:progress'));
        return {points:api.points().points, total:document.getElementById('home-points-progress').value, targets:document.getElementById('home-points-detail').textContent, cards:Array.from(document.querySelectorAll('.home-game-points'), e=>e.textContent), links:Array.from(document.querySelectorAll('.home-mini-game'),e=>e.href), badges:document.getElementById('badge-count').textContent};
    })()`);
    assert.equal(result.points, 1000, team);
    assert.equal(result.total, 1000, team);
    assert.match(result.targets, /6 \/ 6 targets/);
    assert.equal(result.cards.length, 6);
    assert.ok(result.links.every(link=>link.includes(`team=${team}`)));
    assert.equal(result.badges, '6 / 6 earned');
    await client.evaluate(`teamArcade.storage.setItem('barkleyBest',10);teamArcade.storage.setItem('passingPointsBest',6);teamArcade.storage.setItem('touchdownRushBest',3);teamArcade.storage.setItem('fieldGoalBest',1);teamArcade.storage.setItem('jalenCleared',1);teamArcade.storage.setItem('clickCount',4);document.dispatchEvent(new Event('arcade:progress'))`);
    assert.equal(await client.evaluate('document.getElementById("home-points-progress").value'),235);
    await go(`index.html?team=${team}`);
    assert.equal(await client.evaluate('document.getElementById("home-points-progress").value'),235);
}
console.log('PASS all 32 team home totals, six cards, records, badges, partial credit, links, and reload persistence.');
await go('leaders.html?team=eagles');
await client.until('!!window.leagueBoard');
assert.equal(await client.evaluate('document.querySelectorAll(".score-breakdown-card").length'),6);
assert.equal(await client.evaluate('leagueBoard.normalized(teamArcade.points().records,teamArcade.points().clicks).points'),235);
assert.equal(await client.evaluate('leagueBoard.previousRecords({records:{game:99,pocket:10,bird:4}}).game'),undefined);
assert.equal(await client.evaluate('leagueBoard.previousRecords({scoringVersion:2,records:{game:3,pocket:6}}).pocket'),6);
for (const team of ['eagles','bears','packers','cowboys']) {
    await go(`jalen.html?team=${team}`);
    await client.until('!document.jalenGame.loading');
    await client.evaluate('document.jalenGame.reset()');
    await client.until('!document.jalenGame.loading');
    for (let i=0;i<5;i++) {
        await client.until(`document.jalenGame.level===${i}&&!document.jalenGame.loading`);
        await client.evaluate(`(() => { const g=document.jalenGame; const [x,y,w,h]=g.scenes[g.level].target; g.choosePoint((x+w/2)*g.canvas.width,(y+h/2)*g.canvas.height); })()`);
        assert.equal(await client.evaluate('document.getElementById("search-points").textContent'),`${(i+1)*20} / 100 search points`);
        if (i<4) await client.evaluate('document.getElementById("search-next").click()');
    }
    await client.evaluate('document.jalenGame.reset()');
    assert.equal(await client.evaluate('teamArcade.points().scores.search'),100);
}
for (const width of [1440,768,390,320]) {
    await client.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    for (const page of ['index.html?team=eagles','index.html?team=bears','index.html?team=packers','leaders.html?team=bears','jalen.html?team=eagles']) {
        await go(page);
        if (page.startsWith('index')) await client.until('document.querySelectorAll(".mini-team-art[data-art-ready=true]").length===5');
        for (const theme of ['light','dark']) {
            await client.evaluate(`document.documentElement.dataset.theme='${theme}'`);
            assert.equal(await client.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${page}/${width}/${theme}`);
            if (page.startsWith('index')) {
                const sizes=await client.evaluate(`Array.from(document.querySelectorAll('.mini-team-art'),e=>{const r=e.getBoundingClientRect();return [r.width,r.height]})`);
                assert.ok(sizes.every(([w,h])=>Math.abs(w/h-1.6)<.02),`Equal landscape ${page}/${width}`);
            }
        }
    }
}
await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await go('index.html?team=bears');
await client.until('document.querySelectorAll(".mini-team-art[data-art-ready=true]").length===5');
await new Promise(resolve=>setTimeout(resolve,500));
const screenshot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
await writeFile('/private/tmp/arcade-points-home.png',Buffer.from(screenshot.data,'base64'));
// Optional integration checks need Auth/Firestore emulators, without Functions.
if (process.argv.includes('--sync')) {
    await go('leaders.html?team=eagles&emulator=1');
    await client.until('!!window.leagueBoard?.client && !window.leagueBoard.connecting');
    await client.evaluate(`(() => {
        const values={touchdownRushBest:3,barkleyBest:10,jalenCleared:1,fieldGoalBest:1,passingPointsBest:6,clickCount:4};
        for(const [key,value] of Object.entries(values)) teamArcade.storage.setItem(key,value);
        document.getElementById('league-name').value='PointsTester';
        document.getElementById('league-profile-form').requestSubmit();
    })()`);
    await client.until('document.getElementById("league-sync").textContent.includes("Published 235")');
    const readOwn = `(async () => {
        const {db,store,auth}=leagueBoard.client;
        const doc=await store.getDoc(store.doc(db,'leagueFans',auth.currentUser.uid+'_eagles'));
        return doc.data();
    })()`;
    const published=await client.evaluate(readOwn);
    assert.equal(published.scoringVersion,2);
    assert.deepEqual(published.scores,{game:60,bird:80,search:20,kick:7,pocket:67,scoreboard:1});
    assert.deepEqual(Object.keys(published.records).sort(),['bird','game','kick','pocket','search']);
    await go('game.html?team=eagles&emulator=1');
    await client.evaluate(`teamArcade.storage.setItem('passingPointsBest',12);teamArcade.storage.setItem('clickCount',1400);document.dispatchEvent(new Event('arcade:progress'))`);
    await new Promise(resolve=>setTimeout(resolve,6500));
    await go('leaders.html?team=eagles&emulator=1');
    await client.until('!!window.leagueBoard?.joined && !window.leagueBoard.connecting');
    await client.until(`(${readOwn}).then(entry=>entry.points===500)`);
    // Remove local bests and restore the new record keys from the published entry.
    await client.evaluate(`for(const game of teamArcade.scoringGames) teamArcade.storage.removeItem(game.key)`);
    await go('leaders.html?team=eagles&emulator=1');
    await client.until('!!window.leagueBoard?.joined && !window.leagueBoard.connecting');
    assert.equal(await client.evaluate('teamArcade.points().points'),500);
    assert.equal(await client.evaluate('teamArcade.storage.getItem("passingPointsBest")'),'12');
    assert.equal(await client.evaluate('teamArcade.storage.getItem("touchdownRushBest")'),'3');
    console.log('PASS real app publication, rounded database scores, background sync, and restoration of version 2 records.');
}
assert.deepEqual(client.errors.map(e=>e.exception?.description||e.text),[]);
console.log('PASS leaderboard breakdown, migration guards, five-scene search scoring, best retention, responsive light/dark layouts, landscape art, and no browser exceptions.');
client.ws.close();browser.ws.close();
