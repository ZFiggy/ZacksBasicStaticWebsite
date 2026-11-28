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
async function go(page) {
    await client.send('Page.navigate', {url: `http://localhost:8000/${page}`});
    await new Promise(r => setTimeout(r, 150));
    await client.until('document.readyState === "complete" && !!window.teamArcade');
    await client.evaluate(`for (const id of ['passing-drive','field-goal','touchdown-rush']) localStorage.setItem('sundayArcade.demo.'+id,'answered')`);
}
try {
    await go('playbook.html?game=pocket&team=eagles');
    await client.until('!!document.passingGame');
    const passing = await client.evaluate(`(() => {
        const g = document.passingGame; cancelAnimationFrame(g.frame);
        g.reset(); g.action(); g.throwAway(); g.throwAway();
        const away = [g.drive.spot, g.drive.down, g.drive.attempts, g.drive.completions];
        g.reset(); g.action(); g.pause(); const time = g.time; g.update(1); g.scramble(); g.throwAway();
        const paused = g.time === time && g.phase === 'live';
        g.pause(); g.scramble(); g.throw(0);
        const tucked = g.phase === 'run' && !g.thrown && g.carrier === g.qb;
        g.defenders = []; g.rushers = []; g.qb.x = 36; g.qb.y = 1; g.update(.01);
        const run = [g.drive.spot, g.drive.down, g.drive.attempts, g.drive.completions];
        g.reset(); g.action(); g.defenders = []; g.rushers = []; g.keys.add('ArrowUp'); g.keys.add('Shift');
        const y = g.qb.y; g.update(.2); const sprint = y - g.qb.y > 1.9 && g.stamina < 1;
        g.keys.clear(); const stamina = g.stamina; g.update(.2); const recovered = g.stamina > stamina;
        g.reset(); g.action(); g.defenders=[];g.rushers=[];g.scramble();g.stamina=.001;g.keys.add('ArrowRight');g.keys.add('Shift');g.update(.1);g.update(.1);
        const exhausted = g.sprintExhausted && !g.sprinting;
        g.reset(); g.draw();
        return {away, paused, tucked, run, sprint, recovered, exhausted};
    })()`);
    assert.deepEqual(passing.away, [25,2,1,0]);
    assert.deepEqual(passing.run, [36,1,0,0]);
    for (const key of ['paused','tucked','sprint','recovered','exhausted']) assert.equal(passing[key], true, key);
    console.log('PASS throw-away consumes one down; QB scramble crosses scrimmage without counting a pass; sprint drains, recovers, and exhausts; paused actions stay frozen.');
    await go('kick.html?team=bears'); await client.until('!!document.kickGame');
    const kicks = await client.evaluate(`(() => {
        const g=document.kickGame; g.reset();g.hash=1;g.wind=.2;g.loft='high';
        document.getElementById('kick-compensate').click();
        const compensation=g.aim;
        g.act();cancelAnimationFrame(g.frame);g.position=.9;g.act();g.position=g.zoneCenter;g.crossedMidfield=true;g.launch();
        const outcome=g.shot.outcome;
        g.reset();g.act();cancelAnimationFrame(g.frame);g.pause();const pos=g.position,elapsed=g.elapsed;
        g.tick(performance.now()+1000);g.act();
        const frozen=g.paused && g.position===pos && g.elapsed===elapsed && g.state==='running';
        g.pause();cancelAnimationFrame(g.frame);const resumed=!g.paused && g.state==='running';
        const greenRanges=[];for(let attempt=0;attempt<5;attempt++)for(const loft of ['drive','balanced','high']) { g.reset();g.attempts=attempt;g.loft=loft;g.act();cancelAnimationFrame(g.frame);const low=g.zoneCenter-g.zoneWidth/2;greenRanges.push((18+low*52)*g.physics.trajectories[loft].range>=g.distance); }
        g.reset();document.querySelector('[data-hash="-1"]').click();const left=g.formation.ballY;
        document.querySelector('[data-hash="1"]').click();const right=g.formation.ballY;
        g.draw();return {compensation,outcome,frozen,resumed,left,right,greenRanges};
    })()`);
    assert.equal(kicks.compensation,-.43);assert.equal(kicks.outcome,'good');assert.equal(kicks.frozen,true);assert.equal(kicks.resumed,true);assert.ok(kicks.right>kicks.left);assert.ok(kicks.greenRanges.every(Boolean),'Every green power zone clears its distance');
    console.log('PASS wind/hash compensation, aligned green accuracy zone, visible hash formation, pause/resume without spending a kick.');
    for (const [page,engine] of [['game.html?team=packers','myGame'],['kick.html?team=bears','kickGame'],['playbook.html?team=chiefs&game=pocket','passingGame']]) {
        await go(page);await client.until(`!!document.${engine}`);
        for (const width of [1440,390]) {
            await client.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
            await new Promise(r=>setTimeout(r,150));
            assert.equal(await client.evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
            const placement = await client.evaluate(`(() => { const id = document.passingGame ? 'playbook-status' : document.kickGame ? 'kick-status' : 'game-status';const s=document.getElementById(id).getBoundingClientRect();const c=(document.${engine}.canvas).getBoundingClientRect();return {ok:s.bottom<=c.top + 1 || s.top>=c.bottom - 1, status:{top:s.top,bottom:s.bottom}, canvas:{top:c.top,bottom:c.bottom}, stage:document.getElementById('playbook-stage')?.getBoundingClientRect().toJSON()}; })()`);
            await client.send('Page.captureScreenshot',{captureBeyondViewport:true}).then(r=>writeFile(`/private/tmp/layout-${engine}-${width}.png`,Buffer.from(r.data,'base64')));
            assert.equal(placement.ok,true,`${engine} ${width} ${JSON.stringify(placement)}`);
            await client.send('Page.captureScreenshot',{captureBeyondViewport:true}).then(r=>writeFile(`/private/tmp/refined-${engine}-${width}.png`,Buffer.from(r.data,'base64')));
        }
    }
    await go('kick.html?team=bears');await client.until('!!document.kickGame');
    await client.evaluate('document.kickGame.act()');
    const control = await client.evaluate(`(() => {const b=document.getElementById('kick-button').getBoundingClientRect(), c=document.kickGame.canvas.getBoundingClientRect();return {button:b.bottom,field:c.top,height:innerHeight};})()`);
    assert.ok(control.button<=control.height && control.field>=-2,JSON.stringify(control));
    await client.evaluate('document.kickGame.reset();document.kickGame.act();cancelAnimationFrame(document.kickGame.frame);document.getElementById("kick-button").focus()');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'p',code:'KeyP'});
    assert.equal(await client.evaluate('document.kickGame.paused'),true,'P pauses with a console button focused');
    await client.evaluate('document.kickGame.reset()');
    const samples = await client.evaluate(`(() => {
        const canvas=document.createElement('canvas');canvas.width=100;canvas.height=120;const c=canvas.getContext('2d');
        const pixels=(time)=>{c.clearRect(0,0,100,120);playerMotion.draw(c,'receiver',10,10,80,100,{action:'run',time});return Array.from(c.getImageData(0,0,100,120).data);};
        const first=pixels(0),second=pixels(.1);
        const visible=first.filter((v,i)=>i%4===3&&v>0).length;
        const roles=playerMotion.roles.map(role=>{c.clearRect(0,0,100,120);playerMotion.draw(c,role,10,10,80,100,{action:'catch'});return c.getImageData(0,0,100,120).data.some((v,i)=>i%4===3&&v>0);});
        return {changed:first.some((v,i)=>v!==second[i]),transparent:visible>100&&visible<10000,roles};
    })()`);
    assert.equal(samples.changed,true);assert.equal(samples.transparent,true);assert.ok(samples.roles.every(Boolean));
    await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert.equal(await client.evaluate(`(() => {const cv=document.createElement('canvas');cv.width=100;cv.height=120;const c=cv.getContext('2d');const frame=t=>{c.clearRect(0,0,100,120);playerMotion.draw(c,'receiver',10,10,80,100,{action:'run',time:t});return cv.toDataURL();};return frame(0)===frame(.1);})()`),true);
    assert.deepEqual(client.errors,[]);
    console.log('PASS desktop/mobile field and status separation, active mobile kicking field and release control visible together, nine visible sprite roles, animated frames and reduced motion, no runtime exceptions.');
} finally { client.ws.close(); browser.ws.close(); }
