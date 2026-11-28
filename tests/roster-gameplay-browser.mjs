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
try {
    await client.send('Page.navigate', {url: 'http://localhost:8000/playbook.html?team=eagles&game=pocket'});
    await client.until('!!document.passingGame && !!playerMotion && !!playerRoster');
    await client.evaluate('localStorage.setItem("sundayArcade.demo.passing-drive", "answered"); document.passingGame.reset(); cancelAnimationFrame(document.passingGame.frame)');
    const balance = await client.evaluate(`(() => {
        const g = document.passingGame; g.playSeed = 947; g.setup();
        const first = JSON.stringify(g.defenders); const routes = JSON.stringify(g.receivers);
        g.concept = 'flood'; g.setup(); const defenseStable = first === JSON.stringify(g.defenders);
        g.concept = 'slants'; g.setup(); const routeStable = routes === JSON.stringify(g.receivers);
        g.action(); g.scramble(); g.defenders = []; g.rushers = []; g.keys.add('ArrowRight'); g.keys.add('Shift');
        for (let i = 0; i < 240; i++) g.update(1 / 60);
        const drained = g.stamina === 0;
        const before = g.qb.x; for (let i = 0; i < 60; i++) g.update(1 / 60);
        const exhaustedSpeed = g.qb.x - before;
        g.keys.clear(); for (let i = 0; i < 120; i++) g.update(1 / 60);
        const restsEmpty = g.stamina === 0;
        g.reset(); return {defenseStable, routeStable, drained, exhaustedSpeed, restsEmpty};
    })()`);
    // Alignments can follow the offensive formation, but the selected coverage must stay fixed.
    assert.equal(balance.routeStable, true);
    assert.equal(balance.defenseStable, true, 'Audibles cannot reroll the defensive alignment');
    assert.equal(balance.drained, true);
    assert.ok(balance.exhaustedSpeed > 0 && balance.exhaustedSpeed < 6.5, 'Exhausted quarterback loses the sprint advantage');
    assert.equal(balance.restsEmpty, true);
    const roster = await client.evaluate(`(async () => {
        const sheets = [...Array.from({length: 8}, (_, i) => 'roster-' + i), ...Array.from({length: 4}, (_, i) => 'motion-core-' + i), ...Array.from({length: 8}, (_, i) => 'actions-' + i), ...Array.from({length: 8}, (_, i) => 'run-cycle-' + i)];
        const samples = [];
        for (const name of sheets) {
            const image = await teamArcade.loadGameImage('assets/characters/' + name + '.png');
            const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
            const c = canvas.getContext('2d', {willReadFrequently: true});
            const cols = name.startsWith('actions-') ? 6 : 4;
            for (let index = 0; index < cols * 4; index++) {
                c.clearRect(0, 0, 100, 100);
                teamArcade.drawGameCover(c, image, {cols, rows: 4, index, character: true}, 5, 5, 90, 90, 'contain');
                const data = c.getImageData(0, 0, 100, 100).data;
                let clear = 0, solid = 0;
                for (let i = 3; i < data.length; i += 4) { if (!data[i]) clear++; if (data[i] > 200) solid++; }
                samples.push({name, index, clear, solid});
            }
        }
        return samples;
    })()`);
    const invalidCells = roster.filter(cell => cell.clear <= 3000 || cell.solid <= 500);
    const identities = await client.evaluate(`NFL_TEAMS.map(t => ({id:t.id, receivers:[0,1,2].map(i=>playerMotion.identity('receiver',t.id,i)), lineman:playerMotion.identity('lineman',t.id), corner:playerMotion.identity('corner',t.id)}))`);
    for (const team of identities) {
        assert.equal(new Set(team.receivers.map(p => p.name)).size, 3, team.id);
        assert.ok(team.lineman.name && Number.isInteger(team.lineman.number));
        assert.ok(team.corner.name && Number.isInteger(team.corner.number));
    }
    await client.evaluate(`(() => {const c=document.createElement('canvas').getContext('2d'); for(const role of ['receiver','lineman','quarterback','kicker']) playerMotion.draw(c,role,0,0,80,100,{variant:1});})()`);
    await client.evaluate('playerMotion.preload()');
    await new Promise(resolve => setTimeout(resolve, 200));
    const art = await client.evaluate(`(() => {
        const canvas=document.createElement('canvas'); canvas.width=1440;canvas.height=1350;
        const c=canvas.getContext('2d'); c.fillStyle='#c9d7dd';c.fillRect(0,0,1440,1350);
        const actions=[['runner','run'],['quarterback','throw'],['kicker','kick'],['receiver','run'],['lineman','block']];
        actions.forEach(([role,action],row)=>{
            c.fillStyle='#152b34';c.font='bold 20px Arial';c.fillText(role+' / '+action,16,row*270+26);
            for(let i=0;i<8;i++) playerMotion.draw(c,role,i*180+30,row*270+55,112,165,{action,progress:i/7,time:i*Math.PI*2/8/13,variant:1});
        });
        return canvas.toDataURL().split(',')[1];
    })()`);
    await writeFile('/private/tmp/football-motion-review.png', Buffer.from(art, 'base64'));
    await client.send('Page.navigate', {url:'http://localhost:8000/kick.html?team=eagles'});
    await client.until('!!document.kickGame');
    const kick = await client.evaluate(`(() => {
        const g=document.kickGame; g.reset();
        const samples=[];
        for(let i=0;i<5;i++){g.attempts=i;g.prepare();samples.push({hash:g.hash,y:g.formation.ballY,aim:g.accuracyCenter});}
        g.reset();return samples;
    })()`);
    assert.equal(new Set(kick.map(k=>k.y)).size,3);
    assert.equal(new Set(kick.map(k=>k.hash)).size,3);
    for(let i=1;i<5;i++) assert.notEqual(kick[i].y,kick[i-1].y);
    assert.deepEqual(client.errors, []);
    assert.deepEqual(invalidCells, [], 'New sprites have clear backgrounds and visible bodies');
    console.log('PASS 512 new sprite cells with real transparency; 32 named supporting casts; finite sprint under held input and no refill; varied assigned kick formations; motion review artifact.');
} finally { client.ws.close(); browser.ws.close(); }

