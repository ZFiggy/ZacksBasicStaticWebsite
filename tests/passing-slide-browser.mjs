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
    // First-use prompts are covered separately in game-demo-browser.mjs.
    await client.evaluate('localStorage.setItem("sundayArcade.demo.field-goal","answered")');
    await client.send('Page.reload');
    await new Promise(resolve=>setTimeout(resolve,100));
    await client.until("document.readyState==='complete' && !!window.teamArcade && !!window.teamArcade.personality");
}



try {
    await go('playbook.html?team=eagles&game=pocket');
    await client.until('!!document.passingGame');
    await client.evaluate("localStorage.setItem('sundayArcade.demo.passing-drive','answered')");
    await client.send('Page.reload'); await client.until('!!document.passingGame');
    await client.evaluate('footballPlayers.preload()');
    await client.evaluate(`(()=>{const g=document.passingGame;cancelAnimationFrame(g.frame);g.reset();g.action();g.qb.x=36.8;g.canvas.focus();})()`);
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'x',code:'KeyX'});
    assert.equal(await client.evaluate('document.passingGame.phase'),'slide');
    const qb=await client.evaluate(`(()=>{const g=document.passingGame;g.slide();g.update(.2);g.pause();const t=g.slideElapsed;g.update(.5);g.slide();const paused=g.slideElapsed===t&&g.phase==='slide';g.pause();g.update(.65);const d={...g.drive};g.update(1);g.finishSlide();return {paused,spot:d.spot,down:d.down,attempts:d.attempts,completions:d.completions,once:JSON.stringify(d)===JSON.stringify(g.drive),save:JSON.parse(teamArcade.storage.getItem('passingDrive-v1')).spot};})()`);
    assert.deepEqual(qb,{paused:true,spot:36,down:1,attempts:0,completions:0,once:true,save:36});
    const caught=await client.evaluate(`(()=>{const g=document.passingGame;g.reset();g.action();g.carrier=g.receivers[0];g.carrier.x=32.7;g.carrier.y=24;g.phase='run';g.thrown=true;g.completed=true;g.catchAt=0;g.caughtBy=footballPlayers.identity('receiver');g.slide();g.update(.65);return [g.phase,g.drive.spot,g.drive.down,g.drive.attempts,g.drive.completions];})()`);
    assert.deepEqual(caught,['result',32,2,1,1]);
    const goal=await client.evaluate(`(()=>{const g=document.passingGame;g.reset();g.drive.spot=95;g.drive.toGo=5;g.setup();g.action();g.scramble();g.carrier.x=99.9;g.slide();g.update(.65);return [g.drive.spot,g.drive.points,g.drive.outcome];})()`);
    assert.deepEqual(goal,[99,0,null],'Slide before goal line cannot gain animation yards or round up to a touchdown');
    await client.evaluate(`(()=>{const g=document.passingGame;g.reset();g.action();g.throw(0);g.slide();if(g.phase!=='flight')throw Error('Slide allowed without possession');g.reset();g.action();g.scramble();g.slide();g.reset();g.update(1);if(g.phase!=='ready'||g.drive.spot!==25)throw Error('Slide survived restart');})()`);
    await client.evaluate(`(()=>{const g=document.passingGame;g.action();g.scramble();g.carrier.x=36;g.slide();g.draw();})()`);
    const montage=await client.evaluate(`(()=>{const g=document.passingGame;const cv=document.createElement('canvas');cv.width=1064;cv.height=1104;const c=cv.getContext('2d');for(let i=0;i<4;i++){g.slideElapsed=[0,.18,.4,.65][i];g.draw();c.drawImage(g.canvas,i%2*532,Math.floor(i/2)*552,532,276);}return cv.toDataURL().split(',')[1];})()`);
    await writeFile('/private/tmp/passing-slide-sequence.png',Buffer.from(montage,'base64'));
    for(const width of [1440,390,320]) {
        await client.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
        for(const theme of ['light','dark']) {
            await client.evaluate(`document.documentElement.dataset.theme='${theme}';document.passingGame.reset();document.passingGame.action();document.passingGame.scramble()`);
            await new Promise(r=>setTimeout(r,100));
            assert.equal(await client.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`overflow ${width}`);
            assert.equal(await client.evaluate('document.passingGame.slideButton.disabled'),false);
        }
    }
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:true});
    await client.evaluate("document.passingGame.slideButton.scrollIntoView({block:'center',behavior:'instant'})");
    const point=await client.evaluate('(()=>{const r=document.passingGame.slideButton.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await client.evaluate('document.passingGame.phase'),'slide','Real touch starts slide');
    await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await client.evaluate('document.passingGame.reset();document.passingGame.action();document.passingGame.slide()');
    assert.equal(await client.evaluate('document.passingGame.phase'),'result');
    assert.deepEqual(client.errors,[]);
    console.log('PASS keyboard/touch slides; QB and receiver spotting/statistics; possession guards; pause, restart, duplicate protection, persistence, goal line, reduced motion, phone/desktop light/dark.');
} finally {client.ws.close();browser.ws.close();}
