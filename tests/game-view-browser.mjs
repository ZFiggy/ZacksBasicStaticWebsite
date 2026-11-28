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
const pages = ['game.html','barkley.html','jalen.html','kick.html','playbook.html?game=pocket'];
async function go(page,team) {
    await client.send('Page.navigate',{url:`http://localhost:8000/${page}${page.includes('?')?'&':'?'}team=${team}`});
    await client.until(`document.readyState==='complete' && !!window.teamArcade && !!document.querySelector('[data-game-fullscreen]')`);
    await client.evaluate(`for(const id of ['touchdown-rush','field-goal','passing-drive'])localStorage.setItem('sundayArcade.demo.'+id,'answered');document.querySelector('dialog[open]')?.close()`);
    if(page==='jalen.html')await client.until('!document.jalenGame.loading');
    await new Promise(r=>setTimeout(r,200));
}
try {
    for(const team of (process.argv.find(arg=>arg.startsWith('--team=')) ? [process.argv.find(arg=>arg.startsWith('--team=')).split('=')[1]] : ['eagles','bears','chiefs'])) {
        for(const [width,height] of [[1440,900],[768,1024],[390,844],[844,390],[320,568]]) {
            await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
            for(const page of pages) {
                await go(page,team);
                const expected=await client.evaluate('teamArcade.games.map(game=>({title:game.title,href:game.href}))');
                const tabs=await client.evaluate(`[...document.querySelectorAll('.game-tabs a')].map(a=>({title:a.textContent,href:a.getAttribute('href')}))`);
                assert.equal(tabs.length,5);
                assert.deepEqual(tabs.map(a=>a.title),expected.map(a=>a.title),`${team} / ${page}: actual names`);
                assert.ok(tabs.every(a=>a.href.includes(`team=${team}`)));
                assert.equal(await client.evaluate(`document.querySelectorAll('.game-tabs [aria-current="page"]').length`),1);
                if(page==='barkley.html'||page==='jalen.html') assert.equal(await client.evaluate('document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1'),true,`Normal viewport ${team}/${page}/${width}`);
                const native=await client.send('Runtime.evaluate',{expression:`document.querySelector('[data-game-fullscreen]').click()`,userGesture:true,awaitPromise:true});
                assert.ok(!native.exceptionDetails);
                await client.until(`document.body.classList.contains('game-fullscreen')`);
                await new Promise(r=>setTimeout(r,200));
                for(const theme of ['light','dark']) {
                    await client.evaluate(`document.documentElement.dataset.theme='${theme}'`);
                    const result=await client.evaluate(`(()=>{const c=document.querySelector('#gameCanvas,#kickCanvas,#passing-canvas,#birdCanvas,#searchCanvas').getBoundingClientRect();return {width:c.width,height:c.height,x:c.x,y:c.y,right:c.right,bottom:c.bottom,view:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],nav:getComputedStyle(document.querySelector('.game-tabs')).display}})()`);
                    assert.equal(result.nav,'none');
                    assert.ok(result.width>80&&result.height>45,`Visible fullscreen ${team}/${page}/${width}: ${JSON.stringify(result)}`);
                    assert.ok(result.x>=-1&&result.y>=47&&result.right<=result.view[0]+1&&result.bottom<=result.view[1]+1,`Fullscreen bounds ${team}/${page}/${width}: ${JSON.stringify(result)}`);
                    assert.ok(result.scroll[0]<=result.view[0]+1&&result.scroll[1]<=result.view[1]+1,`Fullscreen page fits ${team}/${page}/${width}`);
                }
                if(team==='eagles'&&(width===1440||width===390)) {
                    const shot=await client.send('Page.captureScreenshot',{format:'png'});await writeFile(`/private/tmp/gameview-final-${width}-${page.split('.')[0]}.png`,Buffer.from(shot.data,'base64'));
                }
                await client.evaluate(`document.querySelector('.fullscreen-bar button').click()`);
                await client.until(`!document.body.classList.contains('game-fullscreen')`);
                assert.equal(await client.evaluate('getComputedStyle(document.querySelector(".game-tabs")).display!=="none"'),true);
            }
        }
        console.log(`PASS ${team}: five correct tabs, scoped links, active game, normal search/flight fit; all five fullscreen fields and exit at five viewport sizes in both themes.`);
    }
    // Safari-style fallback: no native Fullscreen API, with Escape to restore.
    await go('barkley.html','eagles');
    await client.evaluate(`Object.defineProperty(document,'fullscreenEnabled',{configurable:true,value:false});document.querySelector('[data-game-fullscreen]').click()`);
    await client.until(`document.body.classList.contains('game-fullscreen')`);
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await client.until(`!document.body.classList.contains('game-fullscreen')`);
    assert.deepEqual(client.errors,[]);
    console.log('PASS fullscreen fallback and Escape; no browser exceptions.');
} finally {await browser.send('Target.disposeBrowserContext',{browserContextId:client.contextId});client.ws.close();browser.ws.close();}
