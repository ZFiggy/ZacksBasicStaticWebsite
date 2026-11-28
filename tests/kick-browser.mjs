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
    for (const team of ['eagles', 'cowboys', 'giants', 'commanders', 'bears', 'packers', 'lions', 'vikings', 'saints', 'falcons', 'panthers', 'buccaneers', 'rams', '49ers', 'seahawks', 'cardinals', 'bills', 'jets', 'dolphins', 'patriots', 'ravens', 'bengals', 'browns', 'steelers', 'colts', 'jaguars', 'titans', 'texans', 'chiefs', 'broncos', 'raiders', 'chargers']) {
        await go(`kick.html?team=${team}`);
        await client.until('!!document.kickGame');
        assert.equal(await client.evaluate(`(() => {const g=document.kickGame, t=teamArcade.team;return g.rival.id!==teamArcade.rivalFor() && g.rival.id!==t.id && g.rival.division===t.division && g.rival.conference===t.conference})()`), true, team);
        await client.evaluate(`(() => {const g=document.kickGame;g.reset();for(let i=0;i<5;i++){g.act();g.position=.9;g.act();g.position=.5;g.wind=0;g.situation.gust=0;g.setAim(-g.physics.hashBias(g.distance,g.hash));g.act();g.shotProgress=1;g.finishKick();g.finishKick();}})()`);
        assert.equal(await client.evaluate('document.kickGame.points'), 15, team);
        assert.equal(await client.evaluate('document.kickGame.state'), 'complete');
        assert.equal(await client.evaluate('document.kickGame.history.length'), 5);
        assert.equal(await client.evaluate("teamArcade.storage.getItem('fieldGoalBest')"), '15');
    }
    console.log('PASS 32 teams: correct rival, five kicks, perfect round, no duplicate awards, scoped saved best.');
    await go('kick.html?team=eagles');
    await client.until('!!document.kickGame');
    const positions = await client.evaluate(`(() => {
        const g = document.kickGame;
        const drawPlayer = footballPlayers.draw, drawBall = footballArt.draw;
        const samples = [];
        try {
            for (let i = 0; i < 5; i++) {
                let kickerX, ballX;
                footballPlayers.draw = function(ctx, role, x, ...args) {
                    if (role === 'kicker') { const transform = ctx.getTransform(); kickerX = transform.e / transform.a + x; }
                    return drawPlayer.call(this, ctx, role, x, ...args);
                };
                footballArt.draw = function(ctx, x, ...args) { ballX = x; return drawBall.call(this, ctx, x, ...args); };
                g.attempts = i; g.prepare();
                samples.push({distance:g.distance, kickerX, ballX, goalX:g.formation.goalX});
            }
        } finally { footballPlayers.draw = drawPlayer; footballArt.draw = drawBall; g.reset(); }
        return samples;
    })()`);
    assert.deepEqual(positions.map(p=>p.distance), [25,33,40,47,55]);
    assert.equal(new Set(positions.map(p=>p.goalX)).size, 1, 'Uprights stay fixed');
    for(let i=1;i<positions.length;i++) {
        assert.ok(positions[i].kickerX < positions[i-1].kickerX, 'Rendered kicker moves back');
        assert.ok(positions[i].ballX < positions[i-1].ballX, 'Rendered football moves with kicker');
        assert.equal(positions[i].ballX - positions[i].kickerX, positions[0].ballX - positions[0].kickerX, 'Foot-to-ball spacing stays aligned');
    }
    for(const attempt of [0,2,4]) {
        await client.evaluate(`document.kickGame.attempts=${attempt};document.kickGame.prepare()`);
        await new Promise(r=>setTimeout(r,200));
        await client.send('Page.captureScreenshot',{captureBeyondViewport:true}).then(shot=>writeFile(`/private/tmp/kick-distance-${positions[attempt].distance}.png`,Buffer.from(shot.data,'base64')));
    }
    console.log('PASS all five rendered kicker/ball positions move back together against fixed uprights.');
    await client.evaluate('document.kickGame.reset()');
    await client.send('Input.dispatchKeyEvent', {type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
    // Focused canvas keyboard flow.
    await client.evaluate('document.kickGame.canvas.focus()');
    await client.send('Input.dispatchKeyEvent', {type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
    assert.equal(await client.evaluate('document.kickGame.state'),'running');
    await client.evaluate(`document.kickGame.startedAt=performance.now()-10000`);
    await client.until("document.kickGame.state==='ready'");
    assert.equal(await client.evaluate('document.kickGame.history[0].outcome'),'blocked');
    await client.evaluate('document.kickGame.reset();document.kickGame.act();document.kickGame.reset()');
    assert.equal(await client.evaluate('document.kickGame.attempts'),0);
    await client.evaluate(`document.kickGame.act();Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden`);
    assert.equal(await client.evaluate('document.kickGame.state'),'ready');
    assert.equal(await client.evaluate('document.kickGame.attempts'),0);
    await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await client.evaluate(`(()=>{const g=document.kickGame;g.act();g.position=.9;g.act();g.position=.5;g.wind=0;g.act()})()`);
    assert.equal(await client.evaluate('document.kickGame.state'),'ready');
    assert.equal(await client.evaluate('document.kickGame.attempts'),1);
    await client.send('Emulation.setEmulatedMedia',{features:[]});
    console.log('PASS keyboard, timeout block, restart cancellation, hidden-tab reset, reduced motion.');
    for (const width of [1440,768,390,320]) {
        await client.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
        await client.evaluate('document.kickGame.reset()');
        await new Promise(resolve=>setTimeout(resolve,200));
        for (const theme of ['light','dark']) {
            await client.evaluate(`document.documentElement.dataset.theme='${theme}'`);
            assert.equal(await client.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`overflow ${width} ${theme}`);
            assert.ok(await client.evaluate('document.kickGame.canvas.getBoundingClientRect().height')>130,`field visible ${width}`);
            assert.equal(await client.evaluate(`(()=>{const r=document.getElementById('kick-button').getBoundingClientRect(),c=document.kickGame.canvas.getBoundingClientRect();return r.top>=c.bottom || r.left>=c.right})()`),true);
        }
        if (width===390 || width===1440) {
            const shot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
            await writeFile(`/private/tmp/kick-${width}.png`,Buffer.from(shot.data,'base64'));
        }
    }
    // A real touch event on the field starts the meter.
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:true});
    const point=await client.evaluate(`(()=>{const r=document.kickGame.canvas.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await client.evaluate('document.kickGame.state'),'running');
    assert.deepEqual(client.errors,[]);
    console.log('PASS touch input, responsive field/controls, light/dark layouts, no runtime exceptions.');
} finally {

    client.ws.close();
    browser.ws.close();
}
