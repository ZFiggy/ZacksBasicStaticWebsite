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
await client.send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false});
await client.send('Page.navigate', {url: 'http://localhost:8000/game.html?team=bears'});
await client.until('!!document.myGame && !!window.teamCharacters');
await client.evaluate(`Promise.all(Array.from({length: 8}, (_, i) => teamArcade.loadGameImage('assets/characters/cast-' + i + (i === 0 ? '-v2' : '') + '.png')))`);
for (let sheet = 0; sheet < 8; sheet++) {
    const result = await client.evaluate(`(async () => {
        const image = await teamArcade.loadGameImage('assets/characters/cast-${sheet}${sheet === 0 ? '-v2' : ''}.png');
        const canvas = document.createElement('canvas');
        canvas.width = 1280; canvas.height = 1280;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#eaf1f5'; ctx.fillRect(0, 0, 1280, 1280);
        const components = [];
        for (let index = 0; index < 16; index++) {
            const tile = document.createElement('canvas'); tile.width = 320; tile.height = 320;
            const tc = tile.getContext('2d');
            teamArcade.drawGameCover(tc, image, {cols: 4, rows: 4, index, character: true}, 8, 8, 304, 304, 'contain');
            const data = tc.getImageData(0, 0, 320, 320).data;
            const seen = new Uint8Array(320 * 320);
            const areas = [];
            for (let n = 0; n < seen.length; n++) {
                if (seen[n] || data[n * 4 + 3] < 80) continue;
                const queue = [n]; seen[n] = 1;
                for (let head = 0; head < queue.length; head++) {
                    const p = queue[head], x = p % 320, y = Math.floor(p / 320);
                    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                        if (x + dx < 0 || x + dx >= 320 || y + dy < 0 || y + dy >= 320) continue;
                        const next = p + dy * 320 + dx;
                        if (!seen[next] && data[next * 4 + 3] >= 80) { seen[next] = 1; queue.push(next); }
                    }
                }
                if (queue.length > 25) areas.push(queue.length);
            }
            components.push(areas.length);
            ctx.drawImage(tile, index % 4 * 320, Math.floor(index / 4) * 320);
        }
        return {components, png: canvas.toDataURL().split(',')[1]};
    })()`);
    assert.deepEqual(result.components, Array(16).fill(1), `Detached artwork in sheet ${sheet}`);
    await writeFile(`/private/tmp/repaired-cast-${sheet}.png`, Buffer.from(result.png, 'base64'));
}
for (const width of [1440, 390]) {
    await client.send('Emulation.setDeviceMetricsOverride', {width, height: width === 390 ? 844 : 1000, deviceScaleFactor: 2, mobile: width < 600});
    for (const page of ['game.html', 'kick.html', 'barkley.html']) {
        await client.send('Page.navigate', {url: `http://localhost:8000/${page}?team=bears`});
        await client.until('!!(document.myGame || document.kickGame || document.barkleyGame)');
        await client.until(`(() => { const c = document.querySelector('canvas'); return Math.abs(c.width - c.getBoundingClientRect().width * devicePixelRatio) < 2; })()`);
        assert.equal(await client.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
        const shot = await client.send('Page.captureScreenshot', {format: 'png'});
        await writeFile(`/private/tmp/sharp-${page}-${width}.png`, Buffer.from(shot.data, 'base64'));
    }
}
assert.deepEqual(client.errors, []);
console.log('PASS all 128 character silhouettes: no detached fragments; all three canvas games render at device resolution on desktop/mobile; no browser exceptions.');
client.ws.close();
browser.ws.close();


