import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';

// Uses the same server/CDP setup as team-identity-browser.mjs.
class Browser {
    constructor(url) {
        this.socket = new WebSocket(url);
        this.pending = new Map();
        this.id = 0;
        this.errors = [];
        this.ready = new Promise(resolve => this.socket.addEventListener('open', resolve, {once: true}));
        this.socket.addEventListener('message', ({data}) => {
            const message = JSON.parse(data);
            if (message.method === 'Runtime.exceptionThrown') this.errors.push(message.params.exceptionDetails);
            if (message.id) {
                const {resolve, reject} = this.pending.get(message.id);
                this.pending.delete(message.id);
                message.error ? reject(message.error) : resolve(message.result);
            }
        });
    }
    async send(method, params = {}) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const id = ++this.id;
            this.pending.set(id, {resolve, reject});
            this.socket.send(JSON.stringify({id, method, params}));
        });
    }
    async evaluate(expression) {
        const result = await this.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    }
    async until(expression) {
        for (let i = 0; i < 200; i++) {
            if (await this.evaluate(expression)) return;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error(`Timed out: ${expression}`);
    }
}

const info = await (await fetch('http://localhost:9224/json/version')).json();
const browser = new Browser(info.webSocketDebuggerUrl);
const context = await browser.send('Target.createBrowserContext');
const target = await browser.send('Target.createTarget', {url: 'about:blank', browserContextId: context.browserContextId});
const tabs = await (await fetch('http://localhost:9224/json/list')).json();
const page = new Browser(tabs.find(tab => tab.id === target.targetId).webSocketDebuggerUrl);
await page.send('Page.enable');
await page.send('Runtime.enable');
await page.send('Network.enable');
await page.send('Network.setCacheDisabled', {cacheDisabled: true});
const sets = JSON.parse(await readFile('public/assets/photo-search/consistent-crowd-scenes.json', 'utf8'));

async function go(team) {
    await page.send('Page.navigate', {url: `http://localhost:8000/jalen.html?team=${team}`});
    await page.until(`document.readyState === 'complete' && document.jalenGame?.team.id === '${team}' && !document.jalenGame.loading`);
}
async function reset() {
    await page.evaluate('document.jalenGame.reset()');
    await page.until('!document.jalenGame.loading');
}
async function aim(zoom) {
    return page.evaluate(`(()=>{
        const g=document.jalenGame, select=document.getElementById('search-zoom');
        select.value='${zoom}'; select.dispatchEvent(new Event('change'));
        const [x,y,w,h]=g.scenes[g.level].target;
        const scale=g.canvas.getBoundingClientRect().width/g.canvas.width;
        g.viewport.scrollLeft=(x+w/2)*g.canvas.width*scale-g.viewport.clientWidth/2;
        g.viewport.scrollTop=(y+h/2)*g.canvas.height*scale-g.viewport.clientHeight/2;
        const r=g.canvas.getBoundingClientRect(), v=g.viewport.getBoundingClientRect();
        const point={x:r.left+(x+w/2)*r.width,y:r.top+(y+h/2)*r.height};
        return {...point,visible:point.x>=v.left&&point.x<=v.right&&point.y>=v.top&&point.y<=v.bottom};
    })()`);
}

try {
    for (const [index, team] of Object.keys(sets).entries()) {
        const mobile = index % 2 === 0;
        await page.send('Emulation.setDeviceMetricsOverride', {width: mobile ? 390 : 1440, height: 1000, deviceScaleFactor: 1, mobile});
        await page.send('Emulation.setTouchEmulationEnabled', {enabled: mobile});
        await go(team);
        await reset();
        assert.match(await page.evaluate('document.querySelector(".photo-disclosure").textContent'), /Real crowd photos · AI-edited player/, `${team}: disclose AI photo editing`);
        for (const theme of ['light', 'dark']) {
            await page.evaluate(`document.documentElement.dataset.theme='${theme}'`);
            assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), `${team}: layout overflow`);
        }
        assert.equal(await page.evaluate('document.jalenGame.photoSource.href'), sets[team].scenes[0].sourcePage);
        await page.evaluate('document.getElementById("search-hint").click()');
        assert.ok(await page.evaluate('document.jalenGame.clueShown && !document.jalenGame.hint'));
        await page.evaluate('document.getElementById("search-hint").click()');
        assert.ok(await page.evaluate('document.jalenGame.hint'));
        const point = await aim(6);
        assert.ok(point.visible, `${team}: target reachable at 6x`);
        if (mobile) {
            await page.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: point.x, y: point.y}]});
            await page.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        } else {
            await page.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1});
            await page.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1});
        }
        await page.until('document.jalenGame.found');
        await go(team);
        assert.ok(await page.evaluate('document.jalenGame.found && document.jalenGame.level === 0'), `${team}: restored found state`);
        await page.evaluate('document.getElementById("search-next").click()');
        await page.until('document.jalenGame.level === 1 && !document.jalenGame.loading');
        assert.equal(await page.evaluate('document.getElementById("search-zoom").value'), '1');
        assert.equal(await page.evaluate('document.jalenGame.photoSource.href'), sets[team].scenes[1].sourcePage);
        await reset();
        assert.ok(await page.evaluate('document.jalenGame.level === 0 && !document.jalenGame.found && !document.jalenGame.hint'));
    }
    await page.send('Emulation.setDeviceMetricsOverride', {width: 320, height: 740, deviceScaleFactor: 1, mobile: true});
    await go('bears');
    assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
    await reset();
    await page.evaluate('document.jalenGame.canvas.focus()');
    await page.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', modifiers: 8});
    const destination = await page.evaluate('(()=>{const g=document.jalenGame;const [x,y,w,h]=g.scenes[0].target;return {x:(x+w/2)*g.canvas.width,y:(y+h/2)*g.canvas.height,cursor:g.cursor}})()');
    for (const [axis, positive, negative] of [['x', 'ArrowRight', 'ArrowLeft'], ['y', 'ArrowDown', 'ArrowUp']]) {
        const steps = Math.round((destination[axis] - destination.cursor[axis]) / 8);
        for (let step = 0; step < Math.abs(steps); step++) {
            const key = steps > 0 ? positive : negative;
            await page.send('Input.dispatchKeyEvent', {type: 'keyDown', key, code: key, modifiers: 8});
        }
    }
    await page.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter'});
    assert.ok(await page.evaluate('document.jalenGame.found'), 'Native keyboard arrows and Enter');
    assert.deepEqual(page.errors, [], 'Browser exceptions');
    if (process.argv.includes('--screenshot')) {
        await page.send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false});
        await go('bears');
        await reset();
        const result = await page.send('Page.captureScreenshot', {format: 'png'});
        await writeFile('/private/tmp/real-search-desktop.png', Buffer.from(result.data, 'base64'));
    }
    console.log('PASS 31 teams: native touch/mouse at 6x, source links, two-stage hints, reload, next/reset, light/dark layouts; 320px layout, keyboard search, no browser exceptions.');
} finally {
    await browser.send('Target.disposeBrowserContext', {browserContextId: context.browserContextId});
    page.socket.close();
    browser.socket.close();
}
