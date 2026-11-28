import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
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
let contextId;
async function visitor() {
    const context = await browser.send('Target.createBrowserContext');
    contextId = context.browserContextId;
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

const card = team => `document.querySelector('.team-choice[href*="team=${team}"]')`;
async function choose(team, expected) {
    await client.evaluate(`${card(team)}.click()`);
    await client.until(`document.readyState === 'complete' && location.pathname.endsWith(${JSON.stringify(expected.split('?')[0])}) && teamArcade.team.id === ${JSON.stringify(team)}`);
    assert.equal(await client.evaluate('location.pathname.split("/").pop() + location.search'), expected);
}
await go('choose.html?next=kick.html');
assert.equal(await client.evaluate(`${card('eagles')}.getAttribute('href')`), 'index.html?team=eagles');
await choose('eagles', 'index.html?team=eagles');
await go('playbook.html?team=eagles&game=recall');
assert.equal(await client.evaluate('teamArcade.storage.getItem("lastPage")'), 'playbook.html?game=recall');
await client.evaluate('document.querySelector(".switch-team").click()');
await client.until('!!document.querySelector(".team-choice")');
await choose('bears', 'index.html?team=bears');
await go('kick.html?team=bears');
await go('choose.html');
assert.equal(await client.evaluate('localStorage.getItem("nfl:bears:lastPage")'), 'kick.html');
await choose('eagles', 'playbook.html?game=recall&team=eagles');
await go('choose.html');
await choose('bears', 'kick.html?team=bears');
await go('index.html?team=bears');
await go('choose.html');
await choose('bears', 'index.html?team=bears');
await client.send('Page.reload');
await client.until('document.readyState === "complete" && !!document.querySelector(".switch-team")');
assert.equal(await client.evaluate('teamArcade.storage.getItem("lastPage")'), 'index.html');
await go('kick.html?team=bears');
await client.evaluate('history.back()');
await client.until('location.pathname.endsWith("index.html") && document.readyState === "complete"');
assert.equal(await client.evaluate('localStorage.getItem("nfl:bears:lastPage")'), 'index.html');
await client.evaluate('history.forward()');
await client.until('location.pathname.endsWith("kick.html") && document.readyState === "complete"');
assert.equal(await client.evaluate('localStorage.getItem("nfl:bears:lastPage")'), 'kick.html');
await go('choose.html');
await choose('bears', 'kick.html?team=bears');
await go('index.html?team=bears');
await client.evaluate('history.go(-2)');
await client.until('location.pathname.endsWith("choose.html") && !!document.querySelector(".team-choice")');
assert.equal(await client.evaluate(`${card('bears')}.getAttribute('href')`), 'index.html?team=bears');
await go('choose.html');
await client.evaluate('localStorage.setItem("nfl:cowboys:lastPage", "https://example.com/kick.html")');
await go('choose.html');
assert.equal(await client.evaluate(`${card('cowboys')}.getAttribute('href')`), 'index.html?team=cowboys');
await client.evaluate('localStorage.setItem("nfl:cowboys:lastPage", "choose.html")');
await go('choose.html');
assert.equal(await client.evaluate(`${card('cowboys')}.getAttribute('href')`), 'index.html?team=cowboys');
// A chooser already open in another tab must not retain its original destination.
const {targetId: otherId} = await browser.send('Target.createTarget', {url: 'about:blank', browserContextId: contextId});
const tabs = await (await fetch('http://localhost:9224/json/list')).json();
const other = new Cdp(tabs.find(tab => tab.id === otherId).webSocketDebuggerUrl);
await other.send('Page.enable');
await other.send('Page.navigate', {url: 'http://localhost:8000/playbook.html?team=cowboys&game=recall'});
await other.until('document.readyState === "complete" && !!window.teamArcade');
await client.until(`${card('cowboys')}.getAttribute('href') === 'playbook.html?game=recall&team=cowboys'`);
await choose('cowboys', 'playbook.html?game=recall&team=cowboys');
other.ws.close();
await browser.send('Target.closeTarget', {targetId: otherId});
await client.send('Page.bringToFront');
await go('choose.html');
// Activation also resolves fresh storage even before a refresh event arrives.
await client.evaluate('localStorage.setItem("nfl:cowboys:lastPage", "kick.html")');
await choose('cowboys', 'kick.html?team=cowboys');
console.log('PASS first visits default home; teams resume their own pages and game modes; home visits replace prior destinations; reload persists; chooser and unsafe destinations cannot overwrite or escape.');

for (const file of (await readdir('public')).filter(file => file.endsWith('.html'))) {
    const html = await readFile(`public/${file}`, 'utf8');
    assert.match(html, /rel="icon" href="assets\/football.svg"/, file);
}
await go('choose.html');
assert.equal(await client.evaluate(`document.querySelector('link[rel="icon"]').getAttribute('href')`), 'assets/football.svg');
const selectionPhoto = await client.evaluate(`${card('eagles')}.querySelector('img').getAttribute('src')`);
for (const team of ['eagles', 'cowboys', 'giants', 'bears']) {
    await go(`index.html?team=${team}`);
    assert.equal(await client.evaluate(`document.querySelector('link[rel="icon"]').getAttribute('href')`), `assets/favicons/${team}.svg`);
}
for (const team of await client.evaluate('teamArcade.teams.map(({id, primary}) => ({id, primary}))')) {
    const svg = await readFile(`public/assets/favicons/${team.id}.svg`, 'utf8');
    assert.ok(svg.includes(team.primary), `${team.id} uses its exact primary color`);
    assert.ok(!svg.includes('<rect'), `${team.id} has no background`);
}
const alpha = await client.evaluate(`(async () => {
    const img = new Image(); img.src = document.querySelector('link[rel="icon"]').href; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 76;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, 120, 76);
    return [ctx.getImageData(0, 0, 1, 1).data[3], ctx.getImageData(60, 38, 1, 1).data[3]];
})()`);
assert.deepEqual(alpha, [0, 255]);
await go('index.html?team=eagles');
await client.until('document.querySelector(".team-hero-art img")?.complete');
assert.equal(await client.evaluate('document.querySelector(".team-hero-art img").getAttribute("src")'), selectionPhoto);
assert.equal(await client.evaluate('document.querySelectorAll(".team-hero-art canvas").length'), 0);
for (const page of ['index.html', 'counter.html']) {
    await go(`${page}?team=eagles`);
    for (const width of [1440, 390]) {
        await client.send('Emulation.setDeviceMetricsOverride', {width, height: 1000, deviceScaleFactor: 1, mobile: width < 600});
        assert.equal(await client.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `${page}/${width} fits`);
        for (const theme of ['light', 'dark']) {
            await client.evaluate(`document.documentElement.dataset.theme = '${theme}'`);
            if (page === 'counter.html') {
                await client.until('document.querySelector(".counter-team-art img")?.naturalWidth > 0');
                assert.deepEqual(await client.evaluate('(()=>{const img=document.querySelector(".counter-team-art img"); return [img.naturalWidth,img.naturalHeight]})()'), [2560,1440]);
                assert.equal(await client.evaluate('document.querySelectorAll(".player-photo").length'), 0);
            }
        }
        await client.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const {data} = await client.send('Page.captureScreenshot', {format: 'png'});
        await writeFile(`/private/tmp/eagles-${page}-${width}.png`, Buffer.from(data, 'base64'));
    }
}
assert.deepEqual(client.errors.map(e => e.exception?.description || e.text), []);
console.log('PASS neutral chooser icon; exact team colors and transparency; Eagles home matches selection; 2560×1440 scoreboard photo; desktop/mobile and light/dark; no browser exceptions.');
client.ws.close();
await browser.send('Target.disposeBrowserContext', {browserContextId: contextId});
browser.ws.close();
