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
async function go(page, team) {
    await client.send('Page.navigate', {url: `http://localhost:8000/${page}${page.includes('?') ? '&' : '?'}team=${team}`});
    await new Promise(resolve => setTimeout(resolve, 80));
    await client.until("document.readyState === 'complete' && !!window.teamArcade?.personality && (!!document.querySelector('.game-surface') || !!document.querySelector('.search-story') || !!document.querySelector('.playbook-content'))");
}
const pages = ['game.html', 'kick.html', 'barkley.html', 'jalen.html', ...['pocket', 'shove', 'recall', 'punt', 'blitz', 'signal'].map(id => `playbook.html?game=${id}`)];
let checks = 0;
for (const team of ['eagles', 'giants', 'vikings']) {
    for (const [width, height] of [[1440, 900], [1280, 720], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
        await client.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 600});
        for (const page of pages) {
            await go(page, team);
            if (page === 'jalen.html') await client.until('!!document.jalenGame?.image && !document.jalenGame.loading');
            if (page.startsWith('playbook')) await client.evaluate('document.playbook.reset()');
            await client.evaluate('new Promise(resolve => setTimeout(resolve, 100))');
            const result = await client.evaluate(`(() => {
                const root = document.documentElement;
                const selectors = '.field-panel,.field-panel button,.playbook-content,.playbook-content button,.search-story,.search-board,#search-next,.game-status,.game-instructions';
                const outside = [...document.querySelectorAll(selectors)].filter(element => {
                    const box = element.getBoundingClientRect();
                    return box.height && (box.bottom > innerHeight + 1 || box.right > innerWidth + 1 || box.left < -1);
                }).map(element => element.id || element.className);
                const canvas = document.querySelector('.game-surface canvas');
                const box = canvas?.getBoundingClientRect();
                return {outside, pageFits: root.scrollHeight <= innerHeight + 1 && root.scrollWidth <= innerWidth + 1,
                    canvasRatio: canvas ? box.width / box.height : null, intrinsicRatio: canvas ? canvas.width / canvas.height : null};
            })()`);
            const label = `${team} ${page} ${width}×${height}`;
            assert.equal(result.pageFits, true, `Page scrolls: ${label}`);
            assert.deepEqual(result.outside, [], `Controls escape viewport: ${label}`);
            if (result.canvasRatio) assert.ok(Math.abs(result.canvasRatio - result.intrinsicRatio) < 0.012, `Canvas distorted: ${label} ${JSON.stringify(result)}`);
            checks++;
            if (checks % 60 === 0) console.log(`Checked ${checks} responsive game states.`);
        }
    }
}
// Exercise controls after resizing, rather than validating only idle layouts.
await go('game.html', 'giants');
await client.evaluate(`(() => {const game = document.myGame; game.reset(); for (let i = 0; i < 50; i++) game.move('ArrowLeft'); for (let i = 0; i < 50; i++) game.move('ArrowUp');})()`);
assert.deepEqual(await client.evaluate('({x:document.myGame.shapes[0].x,y:document.myGame.shapes[0].y})'), {x:0,y:0});
await client.evaluate(`(() => {const game = document.myGame; game.reset(); const runner = game.shapes.find(shape => shape.name === 'Main');
    for (const ball of [...game.shapes.filter(shape => shape.name === 'collectable')]) {runner.x = ball.x; runner.y = ball.y; game.update();}})()`);
assert.equal(await client.evaluate('document.myGame.score'), 2);
await client.evaluate('document.myGame.move("ArrowLeft");document.myGame.reset()');
assert.equal(await client.evaluate('document.myGame.score'), 0);
await go('barkley.html', 'giants');
await client.until('document.barkleyGame?.portrait.naturalWidth > 0');
assert.equal(await client.evaluate('window.teamArcade.personality.runner.name'), 'Cam Skattebo');
assert.equal(await client.evaluate('!!document.barkleyGame.flightSprite.portrait'), false);
await client.evaluate('document.barkleyGame.flap();document.barkleyGame.togglePause()');
assert.equal(await client.evaluate('document.barkleyGame.state'), 'paused');
await go('jalen.html', 'giants');
await client.until('!!document.jalenGame?.image && !document.jalenGame.loading');
assert.equal(await client.evaluate('document.jalenGame.playerName'), 'Jameis Winston');
await client.evaluate(`document.getElementById('search-zoom').value = '3';document.getElementById('search-zoom').dispatchEvent(new Event('change'))`);
assert.ok(await client.evaluate('document.jalenGame.viewport.scrollWidth > document.jalenGame.viewport.clientWidth || document.jalenGame.viewport.scrollHeight > document.jalenGame.viewport.clientHeight'));
assert.equal(await client.evaluate('document.documentElement.scrollHeight <= innerHeight + 1'), true);
await client.evaluate(`document.getElementById('search-zoom').value = '1';document.getElementById('search-zoom').dispatchEvent(new Event('change'))`);
assert.ok(await client.evaluate('document.jalenGame.canvas.getBoundingClientRect().width <= document.jalenGame.viewport.clientWidth + 1'));
assert.deepEqual(client.errors.map(error => error.exception?.description || error.text), []);
console.log(`PASS: ${checks} game/viewport checks; active controls stay visible; canvas proportions preserved; both collectibles, restart, full-body Skattebo, pause, Winston identity, and local photo zoom verified. No JavaScript exceptions.`);
client.ws.close();
browser.ws.close();
