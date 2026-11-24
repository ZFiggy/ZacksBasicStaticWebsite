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
    await client.until("document.readyState === 'complete' && !!window.teamArcade");
}
await go('choose.html');await client.evaluate('localStorage.clear()');
await go('index.html');await client.until("location.pathname === '/choose.html' && document.querySelectorAll('.team-choice').length===32");
assert.equal(await client.evaluate("document.querySelectorAll('.team-choice').length"),32);
await client.evaluate("document.querySelector('[data-conference=AFC]').click()");
assert.equal(await client.evaluate("document.querySelectorAll('.team-choice').length"),16);
await client.evaluate("document.querySelector('[data-conference=all]').click();document.getElementById('team-search').value='Seattle';document.getElementById('team-search').dispatchEvent(new Event('input'))");
assert.equal(await client.evaluate("document.querySelectorAll('.team-choice').length"),1);
await client.evaluate("document.querySelector('.team-choice').click()");await client.until("location.pathname==='/index.html' && window.teamArcade?.team.id==='seahawks'");
assert.equal(await client.evaluate("localStorage.getItem('nflTeam')"),'seahawks');
await client.evaluate("window.teamArcade.storage.setItem('barkleyBest','8');window.teamArcade.storage.setItem('playbook-pocket-best','7')");
await go('index.html?team=eagles');
assert.equal(await client.evaluate("window.teamArcade.storage.getItem('barkleyBest')"),null);
await go('index.html?team=seahawks');
assert.equal(await client.evaluate("window.teamArcade.storage.getItem('barkleyBest')"),'8');
const teams=await client.evaluate('window.NFL_TEAMS.map(team=>({id:team.id,name:team.name,games:team.games}))');
assert.equal(new Set(teams.map(team=>team.id)).size,32);
assert.equal(new Set(teams.flatMap(team=>Object.values(team.games))).size,320);
for(const team of teams){
    await go(`index.html?team=${team.id}`);
    assert.equal(await client.evaluate('window.teamArcade.team.id'),team.id);
    assert.match(await client.evaluate('document.title'),new RegExp(team.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.equal(await client.evaluate("document.querySelectorAll('.home-mini-game').length"),3);
    await go(`games.html?team=${team.id}`);
    assert.equal(await client.evaluate("document.querySelectorAll('.library-game').length"),10);
    const titles=await client.evaluate("Array.from(document.querySelectorAll('.library-game h3'),item=>item.textContent)");
    assert.deepEqual(titles,Object.values(team.games));
    for(const [category,count] of Object.entries({all:10,action:3,timing:3,strategy:3,search:1})){
        await client.evaluate(`document.querySelector('[data-game-filter=${category}]').click()`);
        assert.equal(await client.evaluate("document.querySelectorAll('[data-game-category]:not([hidden])').length"),count);
    }
    for(const page of ['game.html','kick.html','barkley.html','jalen.html',...['pocket','shove','recall','punt','blitz','signal'].map(id=>'playbook.html?game='+id)]){
        await go(page+(page.includes('?')?'&':'?')+'team='+team.id);
        if(page.startsWith('playbook'))await client.evaluate("document.getElementById('playbook-start').click()");
        assert.equal(await client.evaluate('window.teamArcade.team.id'),team.id);
        assert.equal(await client.evaluate("!!document.querySelector('.switch-team')"),true);
        assert.equal(await client.evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`Overflow ${team.id} ${page}`);
    }
}
console.log('PASS: first visit, team chooser/search/filter, team switching and isolated records, 320 unique titles, all 32 home pages, all 32 lobbies, all 320 game variants initialize.');
for(const team of ['eagles','cowboys','packers','raiders','dolphins','chargers']){
    for(const page of ['index.html','games.html','leaders.html','counter.html','jalen.html','barkley.html','playbook.html?game=punt']){
        await go(page+(page.includes('?')?'&':'?')+'team='+team);
        for(const width of [1440,768,390,320]){
            await client.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
            for(const theme of ['light','dark']){
                await client.evaluate(`document.documentElement.dataset.theme='${theme}'`);
                assert.equal(await client.evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`Overflow ${team} ${page} ${width} ${theme}`);
                if(team==='eagles'&&width===390&&theme==='light'&&['index.html','games.html','jalen.html'].includes(page)){
                    const shot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
                    await writeFile(`/private/tmp/nfl-${page}-390.png`,Buffer.from(shot.data,'base64'));
                }
            }
        }
    }
}
console.log('PASS: six representative teams, seven pages, four widths and both themes without overflow.');
await go('leaders.html?team=seahawks');await client.until('!!window.leagueBoard');
await client.evaluate("document.querySelector('[data-board=local]').click()");
assert.match(await client.evaluate("document.getElementById('board-status').textContent"),/not global/);
assert.match(await client.evaluate("document.getElementById('board-rows').textContent"),/SEA/);
assert.equal(await client.evaluate("window.teamArcade.safeNext('https://evil.example')"),'index.html');
await client.send('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})"});
await go('games.html?team=bills');
assert.equal(await client.evaluate("document.querySelectorAll('.library-game').length"),10);
assert.match(await client.evaluate("document.querySelector('.library-play').href"),/team=bills/);
await go('playbook.html?game=signal&team=bills');await client.evaluate('document.playbook.reset();document.playbook.guess=[...document.playbook.code];document.playbook.sendCall()');
assert.equal(await client.evaluate('document.playbook.score'),1);
assert.equal(await client.evaluate("window.teamArcade.storage.getItem('playbook-signal-best')"),'1');
assert.deepEqual(client.errors,[]);
console.log('PASS: browser-only rankings are explicit, safe internal redirects, blocked-storage team links/session scores, no JavaScript exceptions.');
await browser.send('Browser.close');
