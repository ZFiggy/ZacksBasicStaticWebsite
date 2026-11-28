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
async function go(team = 'eagles') {
    await client.send('Page.navigate', {url: `http://localhost:8000/playbook.html?game=pocket&team=${team}`});
    await new Promise(r => setTimeout(r, 150));
    await client.until('!!document.passingGame');
}
await client.send('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await go();
await client.evaluate('localStorage.setItem("sundayArcade.demo.passing-drive","answered")');
await go();
const simulations = await client.evaluate(`(() => {
    const g = document.passingGame; cancelAnimationFrame(g.frame);
    const result = [];
    for (let look = 0; look < 6; look++) for (const concept of ['slants','flood','cross']) for (const style of ['bullet','lob']) for (const delay of [0.5,1,1.5,2,2.5,3]) for (let receiver = 0; receiver < 3; receiver++) {
        g.reset(); g.drive.attempts = look; g.playSeed = [0,7919,15838,31676,39595,47514][look]; g.concept = concept; g.style = style; g.setup(); g.action();
        for(let t = 0; t < delay && g.phase === 'live'; t += 0.016) g.update(0.016);
        g.throw(receiver);
        for(let t = 0; t < 5 && g.phase === 'flight'; t += 0.016) g.update(0.016);
        result.push({look,concept,style,delay,receiver,phase:g.phase,complete:g.completed});
    }
    g.reset(); return result;
})()`);
console.log(`PASS natural throwing windows: ${simulations.filter(r=>r.complete).length} / ${simulations.length} sampled reads`);
for (const concept of ['slants','flood','cross']) for (const style of ['bullet','lob']) assert.ok(simulations.some(r=>r.complete && r.concept===concept && r.style===style), `${concept} ${style} has a natural completion`);
assert.ok(simulations.some(r=>r.complete), 'Natural gameplay offers completions');
assert.ok(simulations.some(r=>r.phase==='result' && !r.complete), 'Covered throws can fail');
for (let receiver = 0; receiver < 3; receiver++) {
    for (const concept of ['slants','flood','cross']) {
        assert.ok(simulations.some(r=>r.complete && r.receiver===receiver && r.concept===concept), `Receiver ${receiver + 1} can complete ${concept}`);
    }
    for (let look = 0; look < 6; look++) {
        assert.ok(simulations.some(r=>r.complete && r.receiver===receiver && r.look===look), `Receiver ${receiver + 1} has a window against look ${look}`);
    }
}
const repeatedTargets = await client.evaluate(`(() => {
    const g = document.passingGame; const result = [];
    for (let receiver = 0; receiver < 3; receiver++) for (let look = 0; look < 6; look++) for (const concept of ['slants','flood','cross']) for (const style of ['bullet','lob']) for (const delay of [0.5,1,1.5,2,2.5,3]) {
        g.reset(); g.drive.attempts = look; g.playSeed = [0,7919,15838,31676,39595,47514][look]; g.drive.recentTargets = [receiver, receiver];
        g.concept = concept; g.style = style; g.setup(); g.action();
        for(let t = 0; t < delay && g.phase === 'live'; t += 0.016) g.update(0.016);
        g.throw(receiver);
        for(let t = 0; t < 5 && g.phase === 'flight'; t += 0.016) g.update(0.016);
        result.push({receiver,complete:g.completed});
    }
    g.reset(); return result;
})()`);
for (let receiver = 0; receiver < 3; receiver++) {
    const normal = simulations.filter(r=>r.receiver===receiver && r.complete).length;
    const repeated = repeatedTargets.filter(r=>r.receiver===receiver && r.complete).length;
    assert.ok(repeated < normal, `Repeated throws to ${receiver + 1} attract effective extra coverage`);
    assert.ok(repeated > 0, 'Extra coverage still permits well timed completions');
    console.log(`PASS receiver ${receiver + 1}: ${normal}/216 completions; ${repeated}/216 when repeatedly targeted.`);
}
await client.evaluate('document.passingGame.reset()');
await client.send('Page.captureScreenshot').then(r=>writeFile('/private/tmp/passing-desktop.png', Buffer.from(r.data,'base64')));

const teams = await client.evaluate('NFL_TEAMS.map(t=>t.id)');
for (const team of teams) {
    await go(team);
    assert.equal(await client.evaluate('document.passingGame.rival.id !== teamArcade.team.id'), true);
    assert.equal(await client.evaluate('teamArcade.games.length'), 9);
    assert.equal(await client.evaluate('document.querySelectorAll(".passing-calls button").length'), 3);
}
console.log('PASS all 32 team variants and existing nine-game registry.');
await go();
const scoringPath = await client.evaluate(`(() => {
 const g=document.passingGame; cancelAnimationFrame(g.frame); g.reset(); let drive={...g.drive}; const path=[];
 for(let down=0;down<18 && !drive.ended;down++) {
  let best=null;
  for(const concept of ['slants','flood','cross']) for(const style of ['bullet','lob']) for(const delay of [0.5,1,1.5,2,2.5,3]) for(let receiver=0;receiver<3;receiver++) {
   g.drive={...drive};g.playSeed=(drive.spot*7919+drive.down*104729)>>>0;g.concept=concept;g.style=style;g.setup();g.action();
   for(let t=0;t<delay && g.phase==='live';t+=0.016)g.update(0.016);
   g.throw(receiver);
   for(let t=0;t<5 && g.phase==='flight';t+=0.016)g.update(0.016);
   g.keys.add('ArrowRight');
   for(let t=0;t<12.1 && g.phase==='run';t+=0.016)g.update(0.016);
   g.keys.clear();
   if(g.phase!=='result')continue;
   if(!best || g.drive.spot>best.state.spot)best={state:{...g.drive},concept,style,delay,receiver};
  }
  if(!best)break;
  drive=best.state;path.push({spot:drive.spot,down:drive.down,concept:best.concept,receiver:best.receiver});
 }
 g.reset();return {outcome:drive.outcome,path};
})()`);
assert.equal(scoringPath.outcome,'touchdown',JSON.stringify(scoringPath));
console.log('PASS a complete scoring drive using simulated routes, throws, catches, pursuit, and running:', scoringPath.path);

await go();
await client.evaluate('document.passingGame.reset(); cancelAnimationFrame(document.passingGame.frame); document.passingGame.canvas.focus()');
await client.send('Input.dispatchKeyEvent', {type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
await client.send('Input.dispatchKeyEvent', {type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
assert.equal(await client.evaluate('document.passingGame.phase'), 'live', 'Space snaps');
await client.send('Input.dispatchKeyEvent', {type:'keyDown',key:'ArrowUp',code:'ArrowUp'});
assert.equal(await client.evaluate('document.passingGame.keys.has("ArrowUp")'), true);
await client.evaluate('document.passingGame.update(0.25)');
assert.ok(await client.evaluate('document.passingGame.qb.y < 26.5'));
await client.send('Input.dispatchKeyEvent', {type:'keyUp',key:'ArrowUp',code:'ArrowUp'});
await client.send('Input.dispatchKeyEvent', {type:'keyDown',key:'Shift',code:'ShiftLeft',modifiers:8});
await client.send('Input.dispatchKeyEvent', {type:'keyDown',key:'W',code:'KeyW',modifiers:8});
assert.equal(await client.evaluate('document.passingGame.keys.has("w") && document.passingGame.keys.has("Shift")'), true, 'Shift + WASD accepts uppercase movement events');
const beforeSprint = await client.evaluate('document.passingGame.stamina');
await client.evaluate('document.passingGame.update(0.016)');
assert.ok(await client.evaluate('document.passingGame.stamina') < beforeSprint, 'Shift + W moves and spends sprint energy');
await client.send('Input.dispatchKeyEvent', {type:'keyUp',key:'W',code:'KeyW',modifiers:8});
await client.send('Input.dispatchKeyEvent', {type:'keyUp',key:'Shift',code:'ShiftLeft'});
assert.equal(await client.evaluate('document.passingGame.keys.has("w")'), false, 'Shifted keyup clears movement');

await client.send('Input.dispatchKeyEvent', {type:'keyDown',key:'p',code:'KeyP'});
assert.equal(await client.evaluate('document.passingGame.paused'), true);
const paused = await client.evaluate('document.passingGame.time');
await client.evaluate('document.passingGame.throw(0)');
assert.equal(await client.evaluate('document.passingGame.phase'), 'live', 'Paused throw ignored');
await client.evaluate('document.passingGame.pause()');
await client.evaluate('document.passingGame.reset(); document.passingGame.action(); document.passingGame.time=1.5; document.passingGame.receivers.forEach(r=>Object.assign(r,document.passingGame.routeAt(r,1.5)))');
await client.send('Input.dispatchKeyEvent', {type:'keyDown',key:'3',code:'Digit3'});
assert.equal(await client.evaluate('document.passingGame.phase'), 'flight', '3 throws');
await client.evaluate('document.passingGame.reset(); document.passingGame.action(); document.passingGame.update(8.1)');
assert.equal(await client.evaluate('document.passingGame.phase'), 'result');
assert.equal(await client.evaluate('document.passingGame.drive.down'), 2, 'Sack consumes down');
const afterSack = await client.evaluate('document.passingGame.drive');
await go();
assert.equal(await client.evaluate('document.passingGame.drive.spot'), afterSack.spot, 'Reload restores field position');
assert.equal(await client.evaluate('document.passingGame.drive.down'), 2, 'Reload restores down');
await client.evaluate(`(() => {
 const g=document.passingGame; cancelAnimationFrame(g.frame); g.reset(); g.drive.spot=94;g.drive.toGo=6;g.setup();g.action();
 g.phase='run';g.completed=true;g.thrown=true;g.carrier=g.receivers[0];g.carrier.x=100;g.update(0.016);
})()`);
assert.equal(await client.evaluate('document.passingGame.drive.outcome'), 'touchdown');
assert.equal(await client.evaluate('fanArcade.number("passingPointsBest")'), 6);
assert.equal(await client.evaluate('document.passingGame.drive.completions'), 1);
await go();
assert.equal(await client.evaluate('document.passingGame.drive.points'), 6, 'Completed drive survives reload');
assert.equal(await client.evaluate('document.passingGame.phase'), 'result');
await client.evaluate('document.passingGame.action()');
assert.deepEqual(await client.evaluate('[document.passingGame.drive.drive,document.passingGame.drive.spot]'), [2,25]);
await client.evaluate('document.passingGame.drive.drive=3;document.passingGame.action();document.passingGame.endPlay("interception",0,"Intercepted");document.passingGame.action()');
assert.equal(await client.evaluate('document.passingGame.phase'), 'over');
await client.evaluate('document.passingGame.action()');
assert.equal(await client.evaluate('document.passingGame.drive.points'), 0);

// Real touch dispatch below checks pointer capture with an active touch pointer.
await client.evaluate('document.passingGame.keys.clear(); document.passingGame.reset()');
await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await client.send('Emulation.setTouchEmulationEnabled',{enabled:true});
await go();
await new Promise(r=>setTimeout(r,200));
await client.evaluate('document.passingGame.reset(); document.passingGame.action(); document.querySelector(".passing-move button").scrollIntoView({block:"center",behavior:"instant"})');
const touch = await client.evaluate('(()=>{const b=document.querySelector(".passing-move button").getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()');
await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
assert.equal(await client.evaluate('document.passingGame.keys.has("ArrowUp")'), true, 'Touch direction holds movement');
await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
assert.equal(await client.evaluate('document.passingGame.keys.size'), 0, 'Touch release clears direction');
await client.evaluate('document.passingGame.reset()');
for (const [width,height,mobile,deviceScaleFactor] of [[1440,1000,false,1],[1366,768,false,1],[390,844,true,1],[844,390,true,1],[1440,1000,false,2],[390,844,true,2]]) {
 await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor,mobile});
 await new Promise(r=>setTimeout(r,200));
 await client.until('(()=>{const c=document.passingGame.canvas,r=c.getBoundingClientRect();return Math.abs(c.width-r.width*devicePixelRatio)<1 && Math.abs(c.height-r.height*devicePixelRatio)<1})()');
 assert.ok(await client.evaluate('Math.abs(document.passingGame.ctx.getTransform().a - document.passingGame.canvas.width / 1064)<.000001'), 'High resolution rendering retains game coordinates');
 assert.equal(await client.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `No horizontal overflow at ${width}`);
 if (!mobile) assert.ok(await client.evaluate('document.passingGame.canvas.getBoundingClientRect().width >= innerWidth * .7'), `Large passing field ${width}`);
 assert.equal(await client.evaluate('(()=>{const c=document.passingGame.canvas.getBoundingClientRect(),b=document.querySelector(".playbook-controls").getBoundingClientRect();return b.left>=c.right || b.top>=c.bottom})()'), true, `Controls outside field ${width}`);
 await client.send('Page.captureScreenshot',{captureBeyondViewport:true}).then(r=>writeFile(`/private/tmp/passing-${width}.png`,Buffer.from(r.data,'base64')));
}
await client.evaluate('document.passingGame.reset();document.documentElement.dataset.theme="light"');
await client.send('Page.captureScreenshot',{captureBeyondViewport:true}).then(r=>writeFile('/private/tmp/passing-light.png',Buffer.from(r.data,'base64')));
for (const [page,ready] of [['game.html','!!document.myGame'],['kick.html','!!document.kickGame'],...['shove','recall','punt','signal'].map(mode=>[`playbook.html?game=${mode}`,'!!document.playbook'])]) {
 await client.send('Page.navigate',{url:`http://localhost:8000/${page}${page.includes('?')?'&':'?'}team=eagles`});
 await new Promise(r=>setTimeout(r,150));await client.until(ready);
}
assert.deepEqual(client.errors, []);
console.log('PASS keyboard, touch, pause, sacks, reload, touchdown, score persistence, three-drive finish/restart, responsive desktop/mobile, no browser exceptions.');
client.ws.close(); browser.ws.close();
