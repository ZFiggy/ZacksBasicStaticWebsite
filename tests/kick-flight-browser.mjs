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
    await go('kick.html?team=eagles');
    await client.until('!!document.kickGame');
    await client.evaluate('footballPlayers.preload()');
    const formation = await client.evaluate(`(() => {
        const g = document.kickGame, rows = [];
        for (let attempt = 0; attempt < 5; attempt++) for (const hash of [-1, 0, 1]) {
            g.attempts = attempt; g.prepare(); g.hash = hash; g.state = 'running';
            for (const time of [0, .299, .301, .75, 2, 4]) {
                g.elapsed = time;
                const actors = g.defenseActors(), center = actors.find(p => p.role === 'snapper');
                const guards = actors.filter(p => p.role === 'lineman');
                rows.push(Math.abs(center.y - g.formation.ballY));
                rows.push(...guards.map(p => Math.abs(p.x - center.x)));
                for (const blocker of actors.filter(p => p.role === 'lineman' || p.role === 'snapper')) {
                    const rival = actors.find(p => p.role === 'rusher' && p.y === blocker.y);
                    if (!rival || rival.x - blocker.x < 50) throw new Error('Unpaired or overlapping protection lane');
                }
            }
        }
        const a = footballPlayers.rig('snapper', {action:'snapBlock', progress:.299/.75}).p;
        const b = footballPlayers.rig('snapper', {action:'snapBlock', progress:.301/.75}).p;
        const jump = Math.max(...a.map((p, i) => Math.hypot(p[0]-b[i][0], p[1]-b[i][1])));
        g.reset(); g.elapsed = 1; g.state = 'running';
        const holder = g.defenseActors().find(p => p.role === 'holder');
        if (holder.x <= g.formation.ballX || !holder.flip) throw new Error('Holder occupies the kicker approach lane');
        const hand = footballPlayers.hand('holder',holder.x-38,holder.y-106,76,106,{action:'holder',progress:1,flip:holder.flip});
        const touch = Math.hypot(hand.x-g.formation.ballX,hand.y-(g.formation.ballY-17));
        const calls = [], original = footballField.endzone;
        footballField.endzone = function(c, ...args) {calls.push({flight:c.canvas===g.flightPaint, team:args.at(-1).id});return original.call(this,c,...args);};
        try {
            g.state='flight';g.flightElapsed=2;g.shotProgress=.6;g.shot={outcome:'good',offset:0};g.draw();
        } finally {footballField.endzone=original;g.reset();}
        return {alignment:Math.max(...rows),jump,touch,calls};
    })()`);
    assert.ok(formation.alignment < .001, 'Center stays aligned with the guards across distances, hashes and snap phases');
    assert.ok(formation.jump < .05, 'Snap flows continuously into the blocking pose');
    assert.ok(formation.touch < 2, 'Holder steadies the top of the ball at turf level');
    assert.ok(formation.calls.some(c=>c.flight) && formation.calls.some(c=>!c.flight), 'Both cameras use the shared end zone paint');
    assert.ok(formation.calls.every(c=>c.team==='eagles'));
    const yardLabels = await client.evaluate(`(() => {
        const g=document.kickGame, labels=[], original=g.ctx.fillText;
        g.ctx.fillText=function(text,...args){if (/^[1-5]0$/.test(String(text))) labels.push(String(text));return original.call(this,text,...args);};
        try {g.shot={outcome:'good',offset:0};g.shotProgress=.8;g.drawFlight(720,720);} finally {g.ctx.fillText=original;g.reset();}
        return labels;
    })()`);
    assert.deepEqual(yardLabels,['10','10','20','20','30','30','40','40','50','50'],'Ten-yard numerals appear consistently on both sides of the field');


    for (const width of [1440, 768, 390, 320, 844]) {
        const height=width===844?390:844;
        await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
        for(const theme of ['light','dark']) {
            await client.evaluate(`document.documentElement.dataset.theme='${theme}';document.kickGame.reset()`);
            await new Promise(r=>setTimeout(r,150));
            await client.evaluate(`(()=>{const g=document.kickGame;g.act();cancelAnimationFrame(g.frame);g.position=.9;g.act();g.wind=0;g.situation.gust=0;g.setAim(-g.physics.hashBias(g.distance,g.hash));g.launch();cancelAnimationFrame(g.frame);g.flightElapsed=2.5;g.shotProgress=.8;g.draw();})()`);
            assert.equal(await client.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`overflow ${width}`);
            const fit=await client.evaluate(`(()=>{const c=document.kickGame.canvas.getBoundingClientRect(),b=document.getElementById('kick-button').getBoundingClientRect();return {height:c.height,top:c.top,bottom:c.bottom,button:b.bottom};})()`);
            assert.ok(fit.height>=170,JSON.stringify(fit));
            if(width===390) assert.ok(fit.bottom<height,JSON.stringify(fit));
            if(theme==='light') {
                await client.send('Page.captureScreenshot',{captureBeyondViewport:true}).then(s=>writeFile(`/private/tmp/kick-upfield-${width}.png`,Buffer.from(s.data,'base64')));
            }
        }
    }
    await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    const data=await client.evaluate(`(()=>{
        const g=document.kickGame;g.reset();g.act();cancelAnimationFrame(g.frame);g.position=.9;g.act();g.launch();cancelAnimationFrame(g.frame);
        const cv=document.createElement('canvas');cv.width=1596;cv.height=1104;const c=cv.getContext('2d');
        const shots=[['good',0],['left',-1.25],['right',1.25],['short',0]];
        for(let i=0;i<4;i++) {
            g.shot.outcome=shots[i][0];g.shot.offset=shots[i][1]*g.physics.openingFor(g.distance);
            g.shotProgress=1;g.flightElapsed=3;g.draw();
            c.drawImage(g.canvas,i%2*798,Math.floor(i/2)*552,798,414);
            c.fillStyle='#fff';c.font='bold 24px Arial';c.fillText(shots[i][0],i%2*798+20,Math.floor(i/2)*552+450);
        }
        return cv.toDataURL().split(',')[1];})()`);
    await writeFile('/private/tmp/kick-outcomes.png',Buffer.from(data,'base64'));
    const geometry=await client.evaluate(`(()=>{const g=document.kickGame;return ['good','left','right','short'].map(outcome=>{g.shot.outcome=outcome;g.shot.offset=({good:0,left:-1.25,right:1.25,short:0}[outcome])*g.physics.openingFor(g.distance);const p=g.flightGeometry(720,720,1);return {outcome,...p};});})()`);
    assert.ok(geometry[0].x>360-geometry[0].half&&geometry[0].x<360+geometry[0].half);
    assert.ok(geometry[1].x<360-geometry[1].half);
    assert.ok(geometry[2].x>360+geometry[2].half);
    assert.ok(geometry[3].y>geometry[3].crossbar);
    await client.evaluate('document.kickGame.reset()');
    await new Promise(r=>setTimeout(r,150));
    await client.send('Page.captureScreenshot',{captureBeyondViewport:true}).then(s=>writeFile('/private/tmp/kick-holder-refined.png',Buffer.from(s.data,'base64')));
    await go('playbook.html?team=eagles&game=pocket');await client.until('!!document.passingGame');
    await client.evaluate(`localStorage.setItem('sundayArcade.demo.passing-drive','answered')`);await client.send('Page.reload');await client.until('!!document.passingGame');
    await client.evaluate('document.passingGame.action();document.passingGame.update(.1);cancelAnimationFrame(document.passingGame.frame)');
    assert.equal(await client.evaluate(`document.passingGame.targetButtons.some(b=>/TIGHT|SPACE/.test(b.textContent))`),false);
    assert.deepEqual(client.errors,[]);
    console.log('PASS desktop/tablet/phone/landscape light/dark frames; flight geometry matches good/wide/short; receiver hints removed; no runtime errors.');
} finally {client.ws.close();browser.ws.close();}
