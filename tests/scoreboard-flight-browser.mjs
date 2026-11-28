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
    client.contextId = context.browserContextId;
    return client;
}

const client = await visitor();

async function go(page,team) {
    await client.send('Page.navigate',{url:`http://localhost:8000/${page}${page.includes('?')?'&':'?'}team=${team}`});
    await client.until(`document.readyState==='complete' && !!window.teamArcade && !!document.querySelector('[data-game-fullscreen]')`);
    await client.evaluate(`for(const id of ['touchdown-rush','field-goal','passing-drive'])localStorage.setItem('sundayArcade.demo.'+id,'answered');document.querySelector('dialog[open]')?.close()`);
    if(page==='jalen.html')await client.until('!document.jalenGame.loading');
    await new Promise(r=>setTimeout(r,200));
}
const {createRequire} = await import('node:module');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const {initializeApp} = require('firebase-admin/app');
const {getFirestore,FieldValue} = require('firebase-admin/firestore');
const {aggregateFan} = require('../functions/aggregate.js');
const teamIds = require('../functions/team-ids.json');
const db = getFirestore(initializeApp({projectId:'demo-eagles-leaderboard'},`rankings-browser-${Date.now()}`));
async function navigate(page, team) {
    await client.send('Page.navigate',{url:`http://localhost:8000/${page}?team=${team}&emulator=1`});
    await client.until(`document.readyState==='complete' && !!window.leagueBoard?.client`);
    await client.until(`!leagueBoard.connecting`);
}
try {
    await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await navigate('barkley.html','eagles');
    await client.evaluate(`teamArcade.storage.setItem('barkleyBest','83');document.getElementById('league-name').value='FlightTester';leagueBoard.join()`);
    await client.until(`document.getElementById('league-sync').textContent.includes('Published 83 flight points')`);
    await client.until(`document.getElementById('board-rows').innerText.includes('FlightTester')`);
    const first = await client.evaluate(`({uid:leagueBoard.client.auth.currentUser.uid,rows:document.getElementById('board-rows').innerText})`);
    assert.match(first.rows,/FlightTester/);assert.match(first.rows,/PHI/);assert.match(first.rows,/83/);
    await navigate('barkley.html','cowboys');
    await client.evaluate(`teamArcade.storage.setItem('barkleyBest','91');document.getElementById('league-name').value='DallasFlyer';leagueBoard.join()`);
    await client.until(`document.getElementById('league-sync').textContent.includes('Published 91 flight points')`);
    await client.until(`document.getElementById('board-rows').innerText.includes('DallasFlyer')`);
    const flights = await client.evaluate(`document.getElementById('board-rows').innerText`);
    assert.match(flights,/PHI/);assert.match(flights,/DAL/);assert.match(flights,/91/);
    await navigate('counter.html','cowboys');
    await client.evaluate(`teamArcade.storage.setItem('clickCount','12345');leagueBoard.sync()`);
    await client.until(`document.getElementById('league-sync').textContent.includes('12,345 scoreboard clicks')`);
    const uid=await client.evaluate('leagueBoard.client.auth.currentUser.uid');
    const standing = await db.doc('teamStandings/cowboys').get();
    const before = standing.data()?.clicks || 0;
    await aggregateFan(db,`${uid}_cowboys`,teamIds,()=>FieldValue.serverTimestamp());
    await client.until(`document.getElementById('board-rows').innerText.includes('Dallas Cowboys')`);
    const actual=(await db.doc('teamStandings/cowboys').get()).data();
    assert.equal(actual.clicks,before+12345);
    const table=await client.evaluate(`({head:document.getElementById('board-head').innerText,rows:document.getElementById('board-rows').innerText})`);
    assert.match(table.head,/Total clicks/);assert.ok(!table.head.includes('Fan'));assert.ok(!table.rows.includes('DallasFlyer'));assert.ok(table.rows.includes(actual.clicks.toLocaleString()));
    await navigate('barkley.html','cowboys');
    assert.equal(await client.evaluate(`teamArcade.storage.getItem('barkleyBest')`),'91');
    assert.equal(await client.evaluate('document.barkleyGame.best'),91);
    // Equal points share a rank; nickname strings are rendered as text.
    const rendered=await client.evaluate(`(() => {
        leagueBoard.entries=[{teamId:'eagles',nickname:'<b>Literal</b>',records:{bird:100}},{teamId:'cowboys',nickname:'Tie',records:{bird:100}}];leagueBoard.render();
        return {ranks:[...document.querySelectorAll('#board-rows tr')].map(r=>r.cells[0].textContent),html:!!document.querySelector('#board-rows b'),text:document.getElementById('board-rows').innerText};
    })()`);
    assert.deepEqual(rendered.ranks,['1','1']);assert.equal(rendered.html,false);assert.match(rendered.text,/<b>Literal<\/b>/);
    const photos = await client.evaluate(`Promise.all(NFL_TEAMS.map(team => new Promise((resolve, reject) => {
        const photo = NFL_TEAM_MEDIA[team.id].scoreboard;
        const image = new Image();
        image.onload = () => resolve({team:team.id,width:image.naturalWidth,height:image.naturalHeight,credit:photo.credit,source:photo.sourcePage,src:photo.src});
        image.onerror = () => reject(new Error('Missing scoreboard photo: ' + team.id));
        image.src=photo.src;
    })))`);
    assert.equal(photos.length,32);
    for (const photo of photos) {
        assert.ok(photo.width>=1280 && photo.height>=640,JSON.stringify(photo));
        assert.ok(photo.credit && /^https:\/\//.test(photo.source));
    }
    console.log('PASS all 32 scoreboard photos load at high resolution with source attribution.');
    assert.deepEqual(client.errors,[]);
    console.log('PASS real emulator publication, two team flight rows, raw flight points, click-only team total, reload restoration, ties, safe nicknames, and no runtime exceptions.');
} finally {
    await db.terminate();await browser.send('Target.disposeBrowserContext',{browserContextId:client.contextId});client.ws.close();browser.ws.close();
}
