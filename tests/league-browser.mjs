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

// Only the fixed demo project's local emulator is cleared; never production.
const reset=await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-eagles-leaderboard/databases/(default)/documents',{method:'DELETE'});
assert.equal(reset.status,200);
const alice=await visitor();
async function go(client,page){
    await client.send('Page.navigate',{url:`http://localhost:8000/${page}`});
    await new Promise(resolve=>setTimeout(resolve,150));
    await client.until("document.readyState === 'complete' && !!window.teamArcade");
}
await go(alice,'leaders.html?team=eagles&emulator=1');
await alice.until('!!window.leagueBoard?.client && !window.leagueBoard.connecting');
await alice.evaluate("window.teamArcade.storage.setItem('barkleyBest','10');document.getElementById('league-name').value='BrowserAlice';document.getElementById('league-profile-form').requestSubmit()");
await alice.until("document.getElementById('league-sync').textContent.includes('Published 80')");
await alice.until("document.getElementById('board-rows').textContent.includes('BrowserAlice')");
assert.match(await alice.evaluate("document.getElementById('board-rows').textContent"),/PHI/);
await alice.evaluate("document.getElementById('board-game').value='bird';document.getElementById('board-game').dispatchEvent(new Event('change'))");
await alice.until("window.leagueBoard.entries.some(entry=>entry.nickname==='BrowserAlice')");
assert.equal(await alice.evaluate("window.leagueBoard.value(window.leagueBoard.entries.find(entry=>entry.nickname==='BrowserAlice'))"),10);
await alice.evaluate("document.querySelector('[data-board=teams]').click()");
await alice.until("window.leagueBoard.entries.some(entry=>entry.teamId==='eagles'&&entry.points===80&&entry.fans===1)");
const bob=await visitor();
await go(bob,'leaders.html?team=cowboys&emulator=1');
await bob.until('!!window.leagueBoard?.client && !window.leagueBoard.connecting');
await bob.evaluate("window.teamArcade.storage.setItem('touchdownRushBest','4');document.getElementById('league-name').value='BrowserBob';document.getElementById('league-profile-form').requestSubmit()");
await bob.until("document.getElementById('league-sync').textContent.includes('Published 80')");
await alice.until("window.leagueBoard.entries.some(entry=>entry.teamId==='cowboys'&&entry.points===80&&entry.fans===1)");
await bob.evaluate("document.getElementById('board-team').value='cowboys';document.getElementById('board-team').dispatchEvent(new Event('change'))");
await bob.until("document.getElementById('board-rows').textContent.includes('BrowserBob')");
assert.doesNotMatch(await bob.evaluate("document.getElementById('board-rows').textContent"),/BrowserAlice/);
// Same browser changes teams: no transfer; one identity can publish separate records.
await go(alice,'leaders.html?team=cowboys&emulator=1');
await alice.until('!!window.leagueBoard?.client && !window.leagueBoard.connecting');
assert.equal(await alice.evaluate("window.teamArcade.storage.getItem('barkleyBest')"),null);
await alice.evaluate("window.teamArcade.storage.setItem('passingPointsBest','9');document.getElementById('league-name').value='BrowserAlice';document.getElementById('league-profile-form').requestSubmit()");
await alice.until("document.getElementById('league-sync').textContent.includes('Published 100')");
await alice.evaluate("document.querySelector('[data-board=teams]').click()");
await alice.until("window.leagueBoard.entries.some(entry=>entry.teamId==='cowboys'&&entry.points===180&&entry.fans===2)");
assert.equal(await alice.evaluate("window.leagueBoard.entries.find(entry=>entry.teamId==='eagles').points"),80);
// Opted-in background sync from a game page updates the actual team totals.
await go(alice,'game.html?team=eagles&emulator=1');
await alice.evaluate("window.teamArcade.storage.setItem('touchdownRushBest','2');document.dispatchEvent(new Event('arcade:progress'))");
await new Promise(resolve=>setTimeout(resolve,6500));
await go(alice,'leaders.html?team=eagles&emulator=1');
await alice.until('!!window.leagueBoard?.client && !window.leagueBoard.connecting');
await alice.evaluate("document.querySelector('[data-board=teams]').click()");
await alice.until("window.leagueBoard.entries.some(entry=>entry.teamId==='eagles'&&entry.points===120&&entry.fans===1)");
assert.equal(await alice.evaluate("window.teamArcade.storage.getItem('barkleyBest')"),'10');
// Final layout checks after the four-link navigation and sync status changes.
for(const page of ['choose.html','index.html?team=cowboys','leaders.html?team=eagles&emulator=1','counter.html?team=chargers','jalen.html?team=eagles&photos=1']){
    await go(alice,page);
    for(const width of [1440,390,320]){
        await alice.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
        assert.equal(await alice.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`Final overflow ${page} ${width}`);
    }
}
await go(alice,'jalen.html?team=dolphins');
await alice.until('!!document.jalenGame?.image && !document.jalenGame.loading');
await alice.evaluate("(() => {const g=document.jalenGame;const [x,y,w,h]=g.scenes[g.level].target;g.choosePoint((x+w/2)*g.canvas.width,(y+h/2)*g.canvas.height);})()");
assert.equal(await alice.evaluate('document.jalenGame.found'),true);
await go(alice,'jalen.html?team=dolphins');
assert.equal(await alice.evaluate('document.jalenGame.found'),true);
for(let scene=1;scene<5;scene++){
    await alice.evaluate("document.getElementById('search-next').click()");
    await alice.until(`document.jalenGame.level===${scene} && !document.jalenGame.loading`);
    await alice.evaluate("(() => {const g=document.jalenGame;const [x,y,w,h]=g.scenes[g.level].target;g.choosePoint((x+w/2)*g.canvas.width,(y+h/2)*g.canvas.height);})()");
}
assert.equal(await alice.evaluate("window.teamArcade.storage.getItem('jalenCleared')"),'5');
await go(alice,'counter.html?team=chargers');
await alice.evaluate("for(let i=0;i<7;i++)document.getElementById('increment').click()");
assert.equal(await alice.evaluate('window.eaglesCounter.getCount()'),7);
assert.match(await alice.evaluate("document.getElementById('touchdown-status').textContent"),/Chargers/);
await alice.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
for(const page of ['choose.html','index.html?team=eagles','index.html?team=chargers']){
    await go(alice,page);
    const shot=await alice.send('Page.captureScreenshot',{format:'png'});
    await writeFile(`/private/tmp/sunday-final-${page.replace(/[^a-z]/g,'')}.png`,Buffer.from(shot.data,'base64'));
}
assert.deepEqual(alice.errors,[]);assert.deepEqual(bob.errors,[]);
console.log('PASS: two real browser identities join with names and teams, per-team fan filters, live Firestore trigger aggregates all fans, switching preserves separate records, game-page background sync updates team standings.');
await browser.send('Browser.close');
