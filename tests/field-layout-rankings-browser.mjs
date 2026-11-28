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
try {
    for (const team of ['eagles', 'cowboys', 'bears']) {
        for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [844, 390], [320, 568]]) {
            await client.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 600});
            for (const page of ['game.html', 'playbook.html?game=pocket', 'barkley.html', 'kick.html']) {
                await go(page, team);
                const layout = await client.evaluate(`(() => {
                    const main = document.getElementById('main-content');
                    const utility = main.querySelector('.game-utility-bar');
                    const help = main.querySelector('.game-instructions');
                    return {overflow: document.documentElement.scrollWidth > innerWidth + 1,
                        helpCards: help.querySelectorAll('.game-help-grid section').length,
                        utility: !!utility && utility.contains(help) && utility.contains(main.querySelector('[data-game-fullscreen]')),
                        stale: /Roster snapshot|Safety shades receiver/.test(main.innerText),
                        flightBoard: !!main.querySelector('.rankings-panel')};
                })()`);
                if (layout.overflow) console.log(await client.evaluate(`JSON.stringify([...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.id,e.getBoundingClientRect().x,e.getBoundingClientRect().width]))`));
                assert.equal(layout.overflow, false, JSON.stringify({team, width, page, layout}));
                assert.equal(layout.helpCards, 3);
                if (page.startsWith('game.') || page.startsWith('playbook.')) assert.ok(layout.utility);
                if (page.startsWith('playbook.')) {
                    assert.equal(layout.stale, false);
                    await client.evaluate(`document.passingGame.reset();document.passingGame.canvas.focus()`);
                    await client.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'b', code: 'KeyB'});
                    assert.equal(await client.evaluate('document.passingGame.style'), 'lob');
                    await client.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'b', code: 'KeyB', autoRepeat: true});
                    assert.equal(await client.evaluate('document.passingGame.style'), 'lob');
                    await client.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'b', code: 'KeyB'});
                    await client.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'B', code: 'KeyB'});
                    assert.equal(await client.evaluate('document.passingGame.style'), 'bullet');
                }
                if (page === 'barkley.html') assert.ok(layout.flightBoard);
                for (const theme of ['light', 'dark']) {
                    const helpLayout = await client.evaluate(`(() => {
                        document.documentElement.dataset.theme='${theme}';
                        const root=document.querySelector('.game-instructions');
                        const details=root.matches('details')?root:root.querySelector('details');details.open=true;
                        const grid=details.querySelector('.game-help-grid').getBoundingClientRect();
                        const okay={width:grid.width,scroll:document.documentElement.scrollWidth,view:innerWidth};
                        details.open=false;return okay;
                    })()`);
                    assert.ok(helpLayout.width > 100 && helpLayout.scroll <= helpLayout.view + 1, `${JSON.stringify(helpLayout)} Expanded help ${team}/${page}/${width}/${theme}`);
                }
                await client.send('Runtime.evaluate', {expression: `document.querySelector('[data-game-fullscreen]').click()`, userGesture: true});
                await client.until(`document.body.classList.contains('game-fullscreen')`);
                await new Promise(resolve => setTimeout(resolve, 150));
                const bounds = await client.evaluate(`(() => {const c=document.querySelector('#gameCanvas,#passing-canvas,#birdCanvas,#kickCanvas').getBoundingClientRect();return [c.x,c.y,c.right,c.bottom,innerWidth,innerHeight]})()`);
                assert.ok(bounds[0] >= -1 && bounds[1] >= 47 && bounds[2] <= bounds[4] + 1 && bounds[3] <= bounds[5] + 1, JSON.stringify({team,width,page,bounds}));
                await client.evaluate(`document.querySelector('.fullscreen-bar button').click()`);
                await client.until(`!document.body.classList.contains('game-fullscreen')`);
                if (team === 'cowboys' && [1440,390].includes(width)) {
                    const shot=await client.send('Page.captureScreenshot',{format:'png', captureBeyondViewport:false});
                    await writeFile(`/private/tmp/refined-${width}-${page.split('.')[0]}.png`,Buffer.from(shot.data,'base64'));
                }
            }
        }
        console.log(`PASS ${team}: responsive layouts, grouped help, shared utility row, B toggle/repeat, embedded flight board, fullscreen/exit.`);
    }
    await go('game.html', 'cowboys');
    const branding = await client.evaluate(`(async () => {
        await footballField.preload();
        const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1800;
        const c = canvas.getContext('2d');
        const original = c.drawImage.bind(c), draws = [];
        c.drawImage = (...args) => {
            const t = c.getTransform();
            const [image, ...v] = args;
            const sw = v.length === 8 ? v[2] : image.naturalWidth || image.width;
            const sh = v.length === 8 ? v[3] : image.naturalHeight || image.height;
            const dw = v.at(-2), dh = v.at(-1);
            const ratio = Math.hypot(t.a,t.b) * dw / sw / (Math.hypot(t.c,t.d) * dh / sh);
            draws.push({ratio, angle: Math.round(Math.atan2(t.b,t.a) * 180 / Math.PI)});
            original(...args);
        };
        NFL_TEAMS.forEach((team, i) => {
            const x = i % 4 * 400, y = Math.floor(i / 4) * 225;
            c.fillStyle = '#174e38'; c.fillRect(x,y,400,225);
            c.fillStyle = '#fff';c.font = '16px sans-serif';c.fillText(team.name,x+10,y+20);
            footballField.endzone(c,x+10,y+30,70,180,team,'left');
            footballField.endzone(c,x+320,y+30,70,180,team,'right');
        });
        window.fieldBrandingSheet = canvas.toDataURL();
        return draws;
    })()`);
    assert.ok(branding.length > 200);
    assert.ok(branding.every(draw => Math.abs(draw.ratio - 1) < 0.00001));
    assert.ok(branding.some(draw => draw.angle === 90) && branding.some(draw => draw.angle === -90));
    const data = await client.evaluate('fieldBrandingSheet');
    await writeFile('/private/tmp/refined-field-branding.png', Buffer.from(data.split(',')[1], 'base64'));
    assert.deepEqual(client.errors, []);
    console.log('PASS all 32 teams: artwork keeps its aspect ratio; left/right marks face midfield; no runtime exceptions.');
} finally {
    await browser.send('Target.disposeBrowserContext', {browserContextId: client.contextId}); client.ws.close(); browser.ws.close();
}
