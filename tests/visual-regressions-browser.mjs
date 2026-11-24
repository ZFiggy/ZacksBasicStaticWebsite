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

await go('barkley.html?team=eagles');
await client.until('!!document.barkleyGame && document.barkleyGame.portrait.naturalWidth>0');
const skylineDifference = await client.evaluate(`(() => {
    const game = document.barkleyGame;
    const ctx = game.ctx;
    game.distance = (48 - 0.001) / 0.11;
    game.draw();
    const before = ctx.getImageData(0, 280, 480, 130).data;
    game.distance = (48 + 0.001) / 0.11;
    game.draw();
    const after = ctx.getImageData(0, 280, 480, 130).data;
    let changed = 0;
    for (let i = 0; i < before.length; i += 4) {
        if (Math.abs(before[i] - after[i]) + Math.abs(before[i+1] - after[i+1]) + Math.abs(before[i+2] - after[i+2]) > 30) changed++;
    }
    return changed;
})()`);
assert.ok(skylineDifference < 100, `Skyline jumped at the old reset boundary: ${skylineDifference} pixels`);
await client.evaluate('document.barkleyGame.flap();window.dispatchEvent(new Event("blur"))');
assert.equal(await client.evaluate('document.barkleyGame.state'), 'paused');
console.log('PASS: skyline stays continuous across building-width boundary; flight pauses on window blur.');
await go('index.html?team=cowboys');
await client.until('document.querySelector(".team-hero-art img")?.naturalWidth > 0');
assert.match(await client.evaluate('document.querySelector(".team-hero-art img").src'), /team-photos/);
await go('counter.html?team=cowboys');
await client.until('document.querySelector(".counter-team-art img")?.naturalWidth > 0');
assert.ok(await client.evaluate('document.querySelector(".counter-team-art").getBoundingClientRect().height > 100'));
await go('games.html?team=cowboys');
await client.until('document.querySelectorAll(".library-mascot[data-art-ready=true]").length === 10');
const hoverPoint = await client.evaluate('(()=>{const box=document.querySelector(".library-game.mode-bird .library-art").getBoundingClientRect();return {x:box.x+box.width/2,y:box.y+box.height/2};})()');
await client.send('Input.dispatchMouseEvent', {type:'mouseMoved', ...hoverPoint});
await client.evaluate('new Promise(resolve=>setTimeout(resolve, 80))');
assert.equal(await client.evaluate('getComputedStyle(document.querySelector(".mode-bird .library-mascot")).animationName'), 'none');
console.log('PASS: scoreboard artwork retains its frame; hovering a flight card keeps the image inside its frame.');
for (const team of ['eagles','cowboys','dolphins','patriots','bears','chargers']) {
    for (const page of ['index.html','games.html','jalen.html','barkley.html','game.html','kick.html','counter.html','playbook.html?game=shove']) {
        await go(page+(page.includes('?')?'&':'?')+'team='+team);
        for (const width of [1440,768,390,320]) {
            await client.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
            await client.evaluate('new Promise(resolve=>setTimeout(resolve, 80))');
            assert.equal(await client.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`Overflow ${team} ${page} ${width}`);
            if (page === 'jalen.html') {
                await client.until('!!document.jalenGame?.image && !document.jalenGame.loading');
                assert.equal(await client.evaluate('document.jalenGame.canvas.getBoundingClientRect().width <= document.jalenGame.viewport.clientWidth + 1'),true,`Photo does not fit ${team}/${width}`);
                if (width===390) {
                    await client.evaluate("document.getElementById('search-zoom').value='2';document.getElementById('search-zoom').dispatchEvent(new Event('change'))");
                    assert.ok(await client.evaluate('document.jalenGame.viewport.scrollWidth > document.jalenGame.viewport.clientWidth'));
                    await client.evaluate("document.getElementById('search-zoom').value='1';document.getElementById('search-zoom').dispatchEvent(new Event('change'))");
                }
            }
        }
        if (team==='cowboys' && ['index.html','games.html','jalen.html','barkley.html'].includes(page)) {
            await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
            await new Promise(resolve=>setTimeout(resolve,150));
            const shot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
            await writeFile('/private/tmp/visual-fixes-'+page+'.png',Buffer.from(shot.data,'base64'));
        }
    }
}
assert.deepEqual(client.errors.map(error=>error.exception?.description||error.text),[]);
console.log('PASS: six teams, eight pages, four widths; responsive photos and zoom; no JavaScript exceptions.');
client.ws.close();browser.ws.close();
