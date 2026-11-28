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
    await client.send('Page.navigate',{url:`http://localhost:8000/${page}`});
    await new Promise(resolve=>setTimeout(resolve,100));
    await client.until("document.readyState==='complete' && !!window.teamArcade && !!window.teamArcade.personality");
}


async function click(selector) {
    await client.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
    const point = await client.evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await client.send('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...point});
    await client.send('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...point});
}
try {
    await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await go('kick.html?team=eagles');
    await client.until('!!document.kickGame && !!document.querySelector(".game-demo")');
    assert.equal(await client.evaluate('document.querySelector(".game-demo").open'),false);
    await click('#kick-button');
    assert.equal(await client.evaluate('document.querySelector(".game-demo").open'),true);
    assert.equal(await client.evaluate('document.kickGame.state'),'ready');
    await click('.game-demo button[data-primary]');
    for (let i=0;i<5;i++) {
        assert.ok(await client.evaluate(`document.querySelector('.demo-kicker').textContent.includes('${i+1} OF 5')`));
        assert.equal(await client.evaluate('document.kickGame.attempts'),0);
        if(i<4) await click('.game-demo button[data-primary]');
    }
    await click('.game-demo button[data-primary]');
    assert.equal(await client.evaluate('document.querySelector(".game-demo").open'),false);
    assert.equal(await client.evaluate('localStorage.getItem("sundayArcade.demo.field-goal")'),'answered');
    await go('kick.html?team=bears');
    await click('#kick-button');
    assert.equal(await client.evaluate('document.querySelector(".game-demo").open'),false);
    assert.equal(await client.evaluate('document.kickGame.state'),'running');
    await go('game.html?team=eagles');
    await client.until('!!document.myGame && !!document.querySelector(".game-demo")');
    await click('#rush-action');
    assert.equal(await client.evaluate('document.querySelector(".game-demo").open'),true);
    assert.equal(await client.evaluate('document.myGame.phase'),'ready');
    await click('.game-demo button[data-primary]');
    // Movement shortcuts must not leak into the engine through the dialog.
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    assert.equal(await client.evaluate('document.myGame.player.turn'),0);
    for(let i=0;i<4;i++) await click('.game-demo button[data-primary]');
    await click('.game-demo button[data-primary]');
    await go('game.html?team=cowboys');
    await click('#rush-action');
    assert.equal(await client.evaluate('document.myGame.phase'),'playing');
    assert.equal(await client.evaluate('document.querySelector(".game-demo").open'),false);
    await click('.demo-replay');
    assert.equal(await client.evaluate('document.myGame.phase'),'paused');
    await click('.game-demo button[data-primary]');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'p',code:'KeyP'});
    assert.equal(await client.evaluate('document.myGame.phase'),'paused');
    await click('.game-demo button:last-child');
    assert.equal(await client.evaluate('document.myGame.phase'),'paused');
    // A decline also persists, and each game has an independent preference.
    await client.evaluate('localStorage.removeItem("sundayArcade.demo.field-goal")');
    await go('kick.html?team=chiefs');
    await client.evaluate('document.kickGame.canvas.focus()');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
    assert.equal(await client.evaluate('document.querySelector(".game-demo").open'),true);
    await click('.game-demo button:last-child');
    await go('kick.html?team=packers');
    await click('#kick-button');
    assert.equal(await client.evaluate('document.kickGame.state'),'running');
    for(const [width,height] of [[1440,900],[900,700],[768,900],[390,844],[320,700],[844,390]]) {
        await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
        await client.evaluate('document.kickGame.reset()');
        await new Promise(resolve=>setTimeout(resolve,200));
        for (const theme of ['light','dark']) {
            await client.evaluate(`document.documentElement.dataset.theme='${theme}'`);
            assert.ok(await client.evaluate('document.documentElement.scrollWidth<=innerWidth'),`overflow ${width} ${theme}`);
            assert.ok(await client.evaluate('(()=>{const r=document.kickGame.canvas.getBoundingClientRect();return r.width/r.height>1.9 && r.width>250})()'),`wide field ${width}`);
        }
        if(width===1440 || width===390) {
            const shot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
            await writeFile(`/private/tmp/demo-field-${width}.png`,Buffer.from(shot.data,'base64'));
        }
    }
    await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await client.evaluate('localStorage.removeItem("sundayArcade.demo.touchdown-rush")');
    await go('game.html?team=bears');
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:true});
    const point=await client.evaluate('(()=>{const r=document.querySelector("#rush-action").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await client.evaluate('document.querySelector(".game-demo").open'),true);
    await click('.game-demo button[data-primary]');
    assert.ok(await client.evaluate('document.querySelector(".game-demo").scrollWidth<=document.querySelector(".game-demo").clientWidth'));
    const shot=await client.send('Page.captureScreenshot',{format:'png'});
    await writeFile('/private/tmp/demo-rush-mobile.png',Buffer.from(shot.data,'base64'));
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await go('playbook.html?team=eagles&game=pocket');
    await client.until('!!document.passingGame && !!document.querySelector(".game-demo")');
    await client.evaluate('document.passingGame.reset(); document.passingGame.canvas.focus()');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'3',code:'Digit3'});
    assert.equal(await client.evaluate('document.querySelector(".game-demo").open'),true);
    assert.equal(await client.evaluate('document.passingGame.phase'),'ready');
    await click('.game-demo button[data-primary]');
    for(let i=0;i<5;i++) {
        assert.ok(await client.evaluate(`document.querySelector('.demo-kicker').textContent.includes('${i+1} OF 5')`));
        assert.equal(await client.evaluate('document.passingGame.drive.attempts'),0);
        await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'3',code:'Digit3'});
        assert.equal(await client.evaluate('document.passingGame.phase'),'ready');
        if(i<4) await click('.game-demo button[data-primary]');
    }
    await click('.game-demo button[data-primary]');
    assert.equal(await client.evaluate('document.querySelector(".game-demo").open'),false);
    assert.equal(await client.evaluate('localStorage.getItem("sundayArcade.demo.passing-drive")'),'answered');
    await go('playbook.html?team=bears&game=pocket');
    await click('.passing-actions button');
    assert.equal(await client.evaluate('document.passingGame.phase'),'live');
    await click('.demo-replay');
    assert.equal(await client.evaluate('document.passingGame.paused'),true);
    const pausedTime=await client.evaluate('document.passingGame.time');
    await click('.game-demo button[data-primary]');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'p',code:'KeyP'});
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1'});
    assert.equal(await client.evaluate('document.passingGame.time'),pausedTime);
    assert.equal(await client.evaluate('document.passingGame.phase'),'live');
    await click('.game-demo button:last-child');
    assert.equal(await client.evaluate('document.passingGame.paused'),true);
    await click('.passing-actions button:last-child');
    assert.equal(await client.evaluate('document.passingGame.paused'),false);
    // Declining persists across teams; other playbook modes do not receive a passing demo.
    await client.evaluate('localStorage.removeItem("sundayArcade.demo.passing-drive")');
    await go('playbook.html?team=chiefs&game=pocket');
    await click('.passing-actions button');
    await click('.game-demo button:last-child');
    assert.equal(await client.evaluate('document.passingGame.phase'),'ready');
    await go('playbook.html?team=packers&game=pocket');
    await click('.passing-actions button');
    assert.equal(await client.evaluate('document.passingGame.phase'),'live');
    for(const mode of ['shove','recall','punt','signal']) {
        await go(`playbook.html?team=eagles&game=${mode}`);
        assert.equal(await client.evaluate('!!document.querySelector(".game-demo")'),false);
    }
    await client.evaluate('localStorage.removeItem("sundayArcade.demo.passing-drive")');
    await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:true});
    await go('playbook.html?team=cowboys&game=pocket');
    await client.evaluate('document.querySelector(".passing-actions button").scrollIntoView({block:"center",behavior:"instant"})');
    const passTouch = await client.evaluate('(()=>{const r=document.querySelector(".passing-actions button").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[passTouch]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await client.evaluate('document.querySelector(".game-demo").open'),true);
    assert.equal(await client.evaluate('document.passingGame.phase'),'ready');
    await click('.game-demo button:last-child');
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await go('playbook.html?team=eagles&game=pocket');
    await click('.demo-replay'); await click('.game-demo button[data-primary]');
    assert.equal(await client.evaluate('document.querySelector(".game-demo button:nth-child(2)").textContent'),'Play animation');
    for(const [width,height] of [[1440,900],[390,844],[320,700],[844,390]]) {
        await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
        await new Promise(r=>setTimeout(r,100));
        assert.ok(await client.evaluate('document.querySelector(".game-demo").scrollWidth<=document.querySelector(".game-demo").clientWidth'),`Passing demo fits ${width}`);
        if(width===390 || width===1440) {
            await client.send('Page.captureScreenshot',{format:'png'}).then(shot=>writeFile(`/private/tmp/demo-passing-${width}.png`,Buffer.from(shot.data,'base64')));
        }
    }
    assert.deepEqual(client.errors,[]);
    console.log('PASS Passing Drive: five steps, isolated animation, independent preference, accept/decline across teams, replay pause/resume, keyboard, responsive dialog, reduced motion, other playbook modes unchanged.');
    console.log('PASS independent first-use demos, accept/decline across teams, replay pause, isolated animation, keyboard/touch, wide responsive field and both themes.');
} finally {client.ws.close();browser.ws.close();}
