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
    await client.send('Page.navigate', {url: `http://localhost:8000/${page}`});
    await client.until("document.readyState === 'complete' && !!window.teamArcade?.personality");
}
try {
    await go('barkley.html?team=eagles');
    const teams = await client.evaluate('teamArcade.teams.map(t => t.id)');
    for (const team of teams) {
        await go(`barkley.html?team=${team}`);
        await client.until('!!document.barkleyGame && document.barkleyGame.portrait.complete && document.barkleyGame.portrait.naturalWidth > 0');
        const checks = await client.evaluate(`(() => {
            const g = document.barkleyGame;
            const hits = [];
            let clear = true, transparentClear = true;
            // Render independently of the collision helper to locate actual visible pixels.
            for (const velocity of [-360, 0, 500]) {
                const canvas = document.createElement('canvas'); canvas.width = canvas.height = 120;
                const ctx = canvas.getContext('2d'); ctx.translate(60, 60);
                ctx.rotate(Math.max(-.3, Math.min(.5, velocity / 1000)));
                teamArcade.drawGameCover(ctx, g.portrait, g.flightSprite, -42, -42, 84, 84, 'contain');
                const data = ctx.getImageData(0, 0, 120, 120).data;
                const points = [];
                for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) {
                    if (data[(y * 120 + x) * 4 + 3] >= 32) points.push({x: x - 60, y: y - 60});
                }
                const top = Math.min(...points.map(p => p.y));
                const bottom = Math.max(...points.map(p => p.y)) + 1;
                const right = Math.max(...points.map(p => p.x)) + 1;
                const left = Math.min(...points.map(p => p.x));
                const rightTip = points.find(p => p.x === right - 1);
                const leftTip = points.find(p => p.x === left);
                const topTip = points.find(p => p.y === top);
                const bottomTip = points.find(p => p.y === bottom - 1);
                const cases = [
                    {y: 200 - top - 1, pipe: {x: 120 + topTip.x - 33, top: 200, bottom: 450}},
                    {y: 450 - bottom + 1, pipe: {x: 120 + bottomTip.x - 33, top: 200, bottom: 450}},
                    {y: 100, pipe: {x: 120 + right - 1, top: 200, bottom: 450}},
                    {y: 550, pipe: {x: 120 + left - 65, top: 200, bottom: 450}},
                    // Protruding white lips only: the body is beyond the visible tip.
                    {y: 300, pipe: {x: 120 + right + 2, top: 300 + rightTip.y + 5, bottom: 550}},
                    {y: 300, pipe: {x: 120 + left - 68, top: 300 + leftTip.y + 5, bottom: 550}},
                    {y: 300, pipe: {x: 120 + right + 2, top: 50, bottom: 300 + rightTip.y - 5}},
                    {y: 300, pipe: {x: 120 + left - 68, top: 50, bottom: 300 + leftTip.y - 5}}
                ];
                for (const test of cases) {
                    g.reset(); g.velocity = velocity; g.y = test.y; g.state = 'playing';
                    g.pipes = [{...test.pipe}]; g.step(0); hits.push(g.state === 'over');
                }
                g.velocity = velocity; g.y = 325;
                clear &&= !g.collides({x: 100, top: 200, bottom: 450});
                // Transparent padding must not count as touching the opening boundary.
                g.y = 200 - top + 2;
                transparentClear &&= !g.collides({x: 100, top: 200, bottom: 550});
            }
            const gaps = [0, 10, 100].map(score => {
                g.score = score; g.pipes = []; g.spawnPipe();
                return g.pipes[0].bottom - g.pipes[0].top;
            });
            g.reset(); g.state = 'playing'; g.y = 325;
            const trailingEdge = 120 + g.playerShape().left;
            g.pipes = [{x: trailingEdge - 68, top: 200, bottom: 450}]; g.step(0);
            const noEarlyPoint = g.score === 0;
            g.pipes[0].x = trailingEdge - 70; g.step(0);
            const scored = g.score === 1 && g.state === 'playing';
            g.end(); g.flap(); const restarted = g.state === 'playing';
            g.togglePause(); const paused = g.state === 'paused';
            g.togglePause(); const resumed = g.state === 'playing';
            g.reset();
            return {hits, clear, transparentClear, gaps, noEarlyPoint, scored, restarted, paused, resumed};
        })()`);
        assert.ok(checks.hits.every(Boolean), `${team}: tube bodies and rims end round on contact (${checks.hits.map((hit, index) => hit ? '' : index).filter(index => index !== '').join(', ')})`);
        for (const key of ['clear', 'transparentClear', 'noEarlyPoint', 'scored', 'restarted', 'paused', 'resumed']) assert.ok(checks[key], `${team}: ${key}`);
        assert.ok(checks.gaps.every((gap, index) => Math.abs(gap - [230, 200, 165][index]) < 1e-9));
        await go(`games.html?team=${team}`);
        await client.until('document.querySelector(".lobby-team-art[data-art-ready=true]")');
        // Check the background where the old white dash row began.
        const clean = await client.evaluate(`(async () => {
            const host = document.createElement('div'); host.style.cssText = 'width:700px;height:450px'; document.body.append(host);
            teamArcade.paintGameArt(host, 'bird');
            while (host.dataset.artReady !== 'true') await new Promise(r => setTimeout(r, 20));
            const c = host.querySelector('canvas'), ctx = c.getContext('2d');
            // At x=0 the sprite is centered away from the old first dash.
            const a = ctx.getImageData(0, Math.floor(c.height * .15), 1, 1).data;
            const b = ctx.getImageData(0, Math.floor(c.height * .15) - 1, 1, 1).data;
            const clean = [0, 1, 2].every(i => Math.abs(a[i] - b[i]) <= 1);
            host.remove(); return clean;
        })()`);
        assert.ok(clean, `${team}: no artwork dashes`);
    }
    await go('barkley.html?team=patriots');
    await client.until('!!document.barkleyGame && document.barkleyGame.portrait.complete && document.barkleyGame.portrait.naturalWidth > 0');
    await client.evaluate('document.body.focus()');
    await client.send('Input.dispatchKeyEvent', {type: 'keyDown', key: ' ', code: 'Space'});
    await client.send('Input.dispatchKeyEvent', {type: 'keyUp', key: ' ', code: 'Space'});
    assert.equal(await client.evaluate('document.barkleyGame.state'), 'playing');
    await client.evaluate('document.barkleyGame.reset(); document.getElementById("birdCanvas").scrollIntoView()');
    const point = await client.evaluate('(() => { const r = document.getElementById("birdCanvas").getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()');
    await client.send('Emulation.setTouchEmulationEnabled', {enabled: true});
    await client.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
    await client.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    assert.equal(await client.evaluate('document.barkleyGame.state'), 'playing');
    await client.evaluate('document.barkleyGame.reset()');
    await client.send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false});
    await go('games.html?team=patriots');
    await client.until('document.querySelector(".lobby-team-art[data-art-ready=true]")');
    const clip = await client.evaluate('(() => { const r = document.querySelector(".team-lobby-feature").getBoundingClientRect(); return {x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1}; })()');
    const shot = await client.send('Page.captureScreenshot', {format: 'png', clip, captureBeyondViewport: true});
    await writeFile('/private/tmp/bird-hero-review.png', Buffer.from(shot.data, 'base64'));
    assert.deepEqual(client.errors, [], 'No browser exceptions');
    console.log('PASS all 32 teams: clean hero art; visible sprite collisions end rounds at three rotations; tuned gaps; safe clearance; scoring; restart and pause.');
} finally {
    client.ws.close(); browser.ws.close();
}
