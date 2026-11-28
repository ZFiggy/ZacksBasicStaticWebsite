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
    // First-use prompts are covered separately in game-demo-browser.mjs.
    await client.evaluate('localStorage.setItem("sundayArcade.demo.touchdown-rush","answered")');
    await client.send('Page.reload');
    await new Promise(resolve=>setTimeout(resolve,100));
    await client.until("document.readyState==='complete' && !!window.teamArcade && !!window.teamArcade.personality");
}


await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
const teamIds = ['eagles', 'cowboys', 'giants', 'commanders', 'bears', 'lions', 'packers', 'vikings', 'falcons', 'panthers', 'saints', 'buccaneers', 'cardinals', 'rams', '49ers', 'seahawks', 'bills', 'dolphins', 'patriots', 'jets', 'ravens', 'bengals', 'browns', 'steelers', 'texans', 'colts', 'jaguars', 'titans', 'broncos', 'chiefs', 'raiders', 'chargers'];
for (const team of teamIds) {
    await go(`game.html?team=${team}`);
    await client.until('!!document.myGame');
    assert.equal(await client.evaluate('document.myGame.phase'), 'ready');
    assert.equal(await client.evaluate('document.myGame.rival.id !== teamArcade.team.id'), true);
    assert.equal(await client.evaluate('teamArcade.games.length'), 5);
    assert.equal(await client.evaluate('Object.keys(teamArcade.points().scores).length'), 6);
    const result = await client.evaluate(`(() => {
        const g = document.myGame;
        const before = fanArcade.number('fieldRunWins');
        g.action();
        for (const move of g.field.solution) g.move(...move);
        const won = g.phase === 'won' && g.player.carrying;
        const score = fanArcade.number('fieldRunWins');
        g.move(1, 0);
        return {won, delta: score - before, duplicate: fanArcade.number('fieldRunWins') - score, level: JSON.parse(teamArcade.storage.getItem('touchdownRushProgress')).level};
    })()`);
    assert.deepEqual(result, {won: true, delta: 1, duplicate: 0, level: 2}, team);
    assert.equal(await client.evaluate('document.myGame.result.stars'), 3, 'Optimal route earns three stars');
    assert.ok(await client.evaluate("fanArcade.number('touchdownRushPointsBest')") > 0);
    await client.send('Page.reload');
    await new Promise(resolve => setTimeout(resolve, 100));
    await client.until('!!document.myGame');
    assert.equal(await client.evaluate('document.myGame.level'), 2, `Saved next level ${team}`);
}
console.log('PASS all 32 teams: rival mapping, winning route, possession, single score award, next-level persistence, current ranking schema.');
await go('game.html?team=eagles');
await client.evaluate('(()=>{const g=document.myGame;g.field={...g.field,walls:[],allies:[],rushers:[{x:18,y:8}]};g.player=g.rules.initial(g.field);g.action()})()');
await client.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight'});
await new Promise(resolve => setTimeout(resolve, 230));
await client.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight'});
assert.ok(await client.evaluate('document.myGame.player.turn >= 2'), 'Held keyboard input');
await client.evaluate('document.myGame.pause()');
const paused = await client.evaluate('document.myGame.player.turn');
await client.evaluate('document.myGame.move(1,0)');
assert.equal(await client.evaluate('document.myGame.player.turn'), paused);
await client.evaluate('document.myGame.load(); document.myGame.action(); document.myGame.hint()');
assert.ok(await client.evaluate('!!document.myGame.hintCell'));
await client.evaluate('document.myGame.player={...document.myGame.player,x:TouchdownRules.goalColumn,y:TouchdownRules.centerRow,turn:0,carrying:false,defenders:[{x:0,y:0}]};document.myGame.move(0,0)');
assert.equal(await client.evaluate('document.myGame.phase'), 'playing', 'Cannot score without ball');
await client.evaluate('document.myGame.player={...document.myGame.player,x:TouchdownRules.goalColumn,y:TouchdownRules.centerRow,turn:document.myGame.field.budget-1,carrying:false,defenders:[{x:0,y:0}]};document.myGame.move(0,0)');
assert.equal(await client.evaluate('document.myGame.phase'), 'turnover', 'Move budget triggers turnover');
const seed = await client.evaluate('document.myGame.field.seed');
await client.evaluate('document.myGame.load()');
assert.equal(await client.evaluate('document.myGame.field.seed'), seed, 'Retry same field');
await client.evaluate(`document.myGame.action(); document.myGame.field={...document.myGame.field,allies:[],walls:[],rushers:[{x:1,y:4}]};document.myGame.player={...document.myGame.player,x:9,y:4,carrying:true,defenders:[{x:10,y:4}]};document.myGame.move(1,0)`);
assert.equal(await client.evaluate('document.myGame.phase'), 'turnover', 'Rival tackle begins return');
assert.equal(await client.evaluate('document.myGame.turnover.captured'), false);
await new Promise(resolve => setTimeout(resolve, 850));
assert.equal(await client.evaluate('document.myGame.turnover.captured'), true, 'Defender takes possession');
assert.ok(await client.evaluate('document.myGame.turnover.position.x < document.myGame.turnover.pickup.x'), 'Defender runs toward opposite end zone');
const returnShot = await client.send('Page.captureScreenshot', {format:'png',captureBeyondViewport:true});
await writeFile('/private/tmp/touchdown-return.png', Buffer.from(returnShot.data,'base64'));
await client.until("document.myGame.phase==='lost'");
assert.equal(await client.evaluate('document.myGame.turnover.position.x'), 1, 'Defensive touchdown at left end zone');
assert.equal(await client.evaluate('document.myGame.turnover.scored'), true);

await client.evaluate(`document.myGame.load();document.myGame.action();document.myGame.field={...document.myGame.field,allies:[{x:1,y:4}],walls:[],rushers:[{x:1,y:2}]};document.myGame.player.defenders=[{x:1,y:2}];document.myGame.move(1,0)`);
assert.equal(await client.evaluate('document.myGame.phase'), 'playing', 'Friendly blocker protection');
await client.evaluate(`(()=>{const g=document.myGame;g.load();g.reducedMotion=true;g.action();g.player={...g.player,x:9,y:4,carrying:true,defenders:[{x:10,y:4}]};g.move(1,0)})()`);
await client.until("document.myGame.phase==='lost'");
assert.equal(await client.evaluate('document.myGame.turnover.position.x'), 1, 'Reduced-motion defensive TD');
await client.evaluate(`(()=>{const g=document.myGame;g.load();g.reducedMotion=false;g.action();g.player={...g.player,x:9,y:4,carrying:true,defenders:[{x:10,y:4}]};g.move(1,0);g.load()})()`);
await new Promise(resolve => setTimeout(resolve, 850));
assert.equal(await client.evaluate('document.myGame.phase'), 'ready', 'Retry cancels return animation');
assert.equal(await client.evaluate('document.myGame.turnover'), null);
await client.evaluate('document.myGame.action()');
await client.send('Runtime.evaluate', {expression:'window.dispatchEvent(new Event("blur"))'});
assert.equal(await client.evaluate('document.myGame.phase'), 'paused');
await client.evaluate(`(()=>{const g=document.myGame;g.load();g.field={walls:[{x:4,y:3}],allies:[],rushers:[{x:6,y:4}],burstEvery:6,budget:40,par:25,ball:{x:12,y:4}};g.player={...g.rules.initial(g.field),x:4,y:4};g.action()})()`);
assert.equal(await client.evaluate(`document.querySelector('[data-direction="ArrowRight"]').dataset.outcome`), 'tackle');
assert.equal(await client.evaluate('document.getElementById("rush-wait").dataset.outcome'), 'safe');
assert.equal(await client.evaluate(`document.querySelector('[data-direction="ArrowUp"]').dataset.outcome`), 'blocked');
assert.ok(await client.evaluate(`document.querySelector('[data-direction="ArrowRight"]').getAttribute("aria-label").includes("TACKLE")`));
await client.evaluate('document.myGame.player.turn=5;document.myGame.update()');
assert.equal(await client.evaluate('document.getElementById("rush-wait").dataset.outcome'), 'tackle');
assert.equal(await client.evaluate('document.getElementById("rush-contact-rule").dataset.burst'), 'true');
assert.ok(await client.evaluate('document.getElementById("rush-contact-rule").textContent.includes("BURST NOW")'));
await client.evaluate('document.myGame.move(0,0)');
assert.ok(await client.evaluate('document.getElementById("game-status").textContent.includes("two-move burst")'));
assert.ok(await client.evaluate('document.getElementById("rush-contact-rule").textContent.includes("same tile")'));
await client.evaluate(`(()=>{const g=document.myGame;g.load();g.action();g.player.turn=g.field.budget-1;g.player.defenders=[{x:18,y:0}];g.move(0,0)})()`);
assert.equal(await client.evaluate('document.myGame.turnover.expired'), true);
assert.ok(await client.evaluate('document.getElementById("rush-contact-rule").textContent.includes("not a tackle")'));
console.log('PASS next-move button labels, accessible warnings, burst banner, and specific possession-loss reasons.');
console.log('PASS keyboard holds, pause, hints, collection requirement, turn limit, same-field retry, tackling, animated turnover and defensive touchdown, teammate protection, focus-loss pause.');
for (const [width, height] of [[1440,1000], [1280,800], [844,390], [768,1024], [390,844], [320,740]]) {
    await client.send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:width<600});
    await go('game.html?team=bears');
    await client.until('!!document.myGame');
    for (const theme of ['light', 'dark']) {
        await client.evaluate(`document.documentElement.dataset.theme='${theme}'`);
        const size = await client.evaluate(`(() => {const c=document.getElementById('gameCanvas').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth, width:c.width,height:c.height}})()`);
        assert.equal(size.overflow, false, `No page overflow ${width}/${theme}`);
        if(width >= 700) assert.ok(size.width > width * .9, `Full-width field ${width}: ${size.width}`);
        if(width < 600) assert.ok(await client.evaluate('document.querySelector(".rush-field-wrap").scrollWidth>document.querySelector(".rush-field-wrap").clientWidth'), 'Close mobile camera');
        assert.ok(size.width > 260 && size.height > 130, `Visible field ${width}/${theme}: ${JSON.stringify(size)}`);
    }
    await client.evaluate('document.myGame.action()');
    await client.evaluate(`document.querySelector('[data-direction="ArrowRight"]').scrollIntoView({block:'center'})`);
    const pos = await client.evaluate(`(() => {const r=document.querySelector('[data-direction="ArrowRight"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    const before = await client.evaluate('document.myGame.player.turn');
    await client.send('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...pos});
    await new Promise(resolve => setTimeout(resolve, 210));
    await client.send('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...pos});
    assert.ok(await client.evaluate('document.myGame.player.turn') > before, `Pointer controls ${width}`);
    if (width < 600) {
        await client.evaluate('document.getElementById("rush-view").click()');
        assert.equal(await client.evaluate('document.querySelector(".rush-field-wrap").classList.contains("is-overview")'), true);
        await client.evaluate('document.getElementById("rush-view").click()');
    }
    if (width === 1440 || width === 390) {
        await client.evaluate('document.myGame.load();document.myGame.action()');
        await client.evaluate('window.scrollTo(0,0);document.myGame.focusRunner()');
        await new Promise(resolve => setTimeout(resolve, 200));
        if(width===390) {
            assert.equal(await client.evaluate('document.querySelector(".rush-field-wrap").scrollLeft'), 0, 'Camera returns to starting runner');
            assert.equal(await client.evaluate('Math.abs(document.myGame.canvas.getBoundingClientRect().left-document.querySelector(".rush-field-wrap").getBoundingClientRect().left)<1'), true, 'Close camera starts at left end zone');
        }
        const shot = await client.send('Page.captureScreenshot', {format:'png',captureBeyondViewport:true});
        await writeFile(`/private/tmp/touchdown-${width}.png`, Buffer.from(shot.data,'base64'));
    }
}
await go('playbook.html?team=bears&game=blitz');
await client.until('!!document.myGame');
assert.equal(await client.evaluate('location.pathname'), '/game.html');
assert.equal(await client.evaluate('teamArcade.team.id'), 'bears');
await go('games.html?team=bears');
await client.until('document.querySelectorAll(".library-game").length===5');
assert.equal(await client.evaluate('!!document.querySelector(".mode-blitz")'), false);
assert.equal(await client.evaluate('document.querySelector(".mode-game h3").textContent'), 'Touchdown Rush');
await go('playbook.html?team=bears&game=pocket');
await client.until('!!document.playbook');
assert.equal(await client.evaluate('document.querySelectorAll("#playbook-tabs a").length'), 5);
assert.deepEqual(client.errors.map(e=>e.exception?.description||e.text), []);
console.log('PASS responsive light/dark layouts, pointer controls, retired Blitz redirects, five-game lobby and five consistent game tabs; no browser exceptions.');
client.ws.close();browser.ws.close();
