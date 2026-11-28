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

const teams=await (await import('node:fs/promises')).readFile('public/assets/photo-search/consistent-crowd-scenes.json','utf8').then(JSON.parse);
await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
for(const team of ['eagles', ...Object.keys(teams)]) {
    await go(`index.html?team=${team}`);
    await client.until('document.querySelectorAll(".mini-team-art[data-art-ready=true]").length===5');
    const sizes=await client.evaluate(`Array.from(document.querySelectorAll('.mini-team-art'),e=>{const r=e.getBoundingClientRect();return [r.width,r.height]})`);
    assert.ok(sizes.every(([w,h])=>Math.abs(w/h-1.6)<.02),`Landscape ${team}`);
    assert.ok(sizes.every(([w,h])=>Math.abs(w-sizes[0][0])<1&&Math.abs(h-sizes[0][1])<1),`Equal frames ${team}`);
    await go(`jalen.html?team=${team}`);
    await client.until('!document.jalenGame.loading');
    await client.evaluate('document.jalenGame.reset()');
    if(team==='eagles') assert.equal(await client.evaluate('document.jalenGame.photoSet'),null);
    else {
        assert.equal(await client.evaluate('document.jalenGame.photoSet.consistentPerson'),true);
        assert.equal(await client.evaluate('document.jalenGame.playerName'),teams[team].playerName);
        assert.ok(await client.evaluate('!!document.jalenGame.referenceCanvas'));
        assert.equal(teams[team].referenceSrc, `assets/photo-search/real-players/${team}.png`, `Full portrait ${team}`);
    }
    for(let level=0;level<5;level++) {
        await client.until(`document.jalenGame.level===${level}&&!document.jalenGame.loading`);
        const result=await client.evaluate(`(()=>{const g=document.jalenGame;g.choosePoint(0,0);const rejected=!g.found;const [x,y,w,h]=g.scenes[g.level].target;g.choosePoint((x+w/2)*g.canvas.width,(y+h/2)*g.canvas.height);return {rejected,found:g.found,area:w*h,src:g.image.src};})()`);
        assert.ok(result.rejected&&result.found,`Search input ${team}/${level}`);
        if(team!=='eagles') {assert.ok(result.area<=.35,`Bounded target ${team}/${level}`);if(level===4)assert.ok(result.area<=.1,`Final target ${team}`);assert.ok(result.src.includes(`/photo-search/rounds/${team}-`));
            assert.equal(await client.evaluate('document.jalenGame.playerName'),teams[team].playerName);}
        if(level<4) await client.evaluate('document.getElementById("search-next").click()');
    }
}
console.log('PASS all 32 home frames; all 160 search rounds load, reject misses and accept targets; one named person per team; Eagles originals preserved.');
if (process.argv.includes('--search-only')) { client.ws.close(); browser.ws.close(); process.exit(0); }
for(const team of ['eagles', ...Object.keys(teams)]) {
    await go(`games.html?team=${team}`);
    assert.deepEqual(await client.evaluate('teamArcade.games.map(game => game.id)'), ['game', 'bird', 'search', 'kick', 'pocket']);
    assert.equal(await client.evaluate('document.querySelectorAll(".library-game").length'), 5);
    assert.equal(await client.evaluate('window.fanArcade.badges.some(b => ["playbook-shove", "playbook-recall", "playbook-punt", "playbook-signal"].includes(b.id))'), false);
    await go(`playbook.html?team=${team}&game=pocket`);
    await client.evaluate('document.playbook.reset()');
    assert.equal(await client.evaluate('document.passingGame.phase'), 'ready');
    assert.equal(await client.evaluate('document.passingGame.rival.id !== teamArcade.team.id'), true);
    assert.equal(await client.evaluate('document.querySelectorAll(".passing-calls button").length'), 3);
    await go(`barkley.html?team=${team}`);
    await client.until('!!document.barkleyGame');
    assert.equal(await client.evaluate(`(() => {
        document.getElementById('bird-flap').click();
        const playing = document.barkleyGame.state === 'playing';
        document.getElementById('bird-pause').click();
        return playing && document.barkleyGame.state === 'paused';
    })()`), true, `Flight start/pause ${team}`);
    await client.evaluate('document.getElementById("bird-reset").click()');
    assert.equal(await client.evaluate('document.barkleyGame.state'), 'ready');
}
for (const mode of ['shove', 'recall', 'punt', 'signal']) {
    await go(`playbook.html?team=bears&game=${mode}`);
    await client.until('location.pathname.endsWith("games.html") && !!document.gamesLobby');
    assert.equal(await client.evaluate('teamArcade.team.id'), 'bears');
}
console.log('PASS five-game lineup, retired links, Passing Drive, and flight start/pause/restart for all teams.');
for(const team of ['eagles','cowboys','packers','lions']) {
    await go(`game.html?team=${team}`);
    const result=await client.evaluate(`(()=>{const g=document.myGame;g.action();for(const move of g.field.solution)g.move(...move);return g.phase==='won'&&g.player.carrying})()`);
    assert.equal(result,true,`Touchdown Rush clear ${team}`);
    await go(`kick.html?team=${team}`);
    await client.evaluate('document.kickGame.act()');
    assert.equal(await client.evaluate('document.kickGame.state'),'running');
}
for(const width of [1440,768,390,320]) {
    await client.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    for(const page of ['index.html','counter.html','jalen.html','playbook.html?game=pocket','barkley.html']) {
        await go(page+(page.includes('?')?'&':'?')+'team=bears');
        if(page.startsWith('playbook'))await client.evaluate('document.playbook.reset()');
        for(const theme of ['light','dark']) {
            await client.evaluate(`document.documentElement.dataset.theme='${theme}'`);
            assert.equal(await client.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`No overflow ${page}/${width}`);
            if(page==='counter.html'&&theme==='dark')assert.notEqual(await client.evaluate('getComputedStyle(document.querySelector(".team-leaderboard-link")).backgroundColor'),'rgb(255, 255, 255)');
        }
    }
}
await go('choose.html');
await client.until('document.querySelectorAll(".team-choice-art img").length===32');
for(const width of [1440,768,390,320]) {
    await client.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    const sizes=await client.evaluate(`Array.from(document.querySelectorAll('.team-choice-art'),el=>{const r=el.getBoundingClientRect();return [r.width,r.height,getComputedStyle(el.querySelector('img')).objectFit]})`);
    assert.ok(sizes.every(([w,h,fit])=>Math.abs(w/h-1.6)<.02&&fit==='cover'),`Picker landscape at ${width}`);
    assert.ok(sizes.every(([w,h])=>Math.abs(w-sizes[0][0])<1&&Math.abs(h-sizes[0][1])<1),`Picker equal size ${width}`);
}
console.log('PASS all 32 picker images have equal landscape frames at desktop, tablet, and mobile widths.');
assert.deepEqual(client.errors.map(e=>e.exception?.description||e.text),[]);
console.log('PASS Touchdown Rush scoring, kicking, responsive layouts, dark leaderboard panel; no browser exceptions.');
client.ws.close();browser.ws.close();
