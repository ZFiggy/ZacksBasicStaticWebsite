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


// Requires the repository's static preview on 8000 and dedicated Chrome on 9224.
const client = await visitor();
try {
    await client.send('Emulation.setDeviceMetricsOverride', {width:1200,height:900,deviceScaleFactor:1,mobile:false});
    await client.send('Page.navigate', {url:'http://localhost:8000/games.html?team=eagles'});
    await client.until(`!!document.gamesLobby && [...document.querySelectorAll('[data-game-art]')].every(e=>e.dataset.artReady==='true')`);
    await client.evaluate(`document.body.innerHTML='<main id="review" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px;background:#102b3b"></main>';for(const team of teamArcade.teams)for(const id of ['game','pocket','kick']){const e=document.createElement('div');e.style.cssText='height:240px;position:relative';e.dataset.reviewTeam=team.id;document.querySelector('#review').append(e);teamArcade.paintGameArt(e,id,team)}`);
    await client.until(`document.querySelectorAll('[data-art-ready="true"]').length===96`);
    const scenes = await client.evaluate(`teamArcade.teams.flatMap(t=>['game','pocket','kick'].map(id=>({team:t.id,id,...teamArcade.coverFor(id,t)})))`);
    assert.equal(new Set(scenes.map(scene=>scene.src)).size,32,'Every team has its own generated atlas');
    assert.equal(new Set(scenes.map(scene=>scene.src+'#'+JSON.stringify(scene.region))).size,96,'Every game has its own scene crop');
    for (const scene of scenes) {
        assert.equal(scene.illustration,true);
        assert.ok(scene.region[1]>=0&&scene.region[3]>0&&scene.region[1]+scene.region[3]<=1.000001);
        assert.equal(scene.cols,1);
        assert.equal(scene.rows,3);
        assert.equal(scene.index,['game','pocket','kick'].indexOf(scene.id));
    }
    assert.equal(await client.evaluate(`performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/game-covers/')&&!e.name.includes('/sprite-plays-v1/')&&e.name.endsWith('.png')).length`),0,'No legacy cover backdrop loads');
    // Contact sheets support human review of poses, identity, perspective and panel boundaries.
    for (const game of ['game','pocket','kick']) {
        const sheet=await client.evaluate(`(()=>{const c=document.createElement('canvas');c.width=1440;c.height=2000;const ctx=c.getContext('2d');ctx.fillStyle='#102b3b';ctx.fillRect(0,0,c.width,c.height);[...document.querySelectorAll('[data-game-art="${game}"]')].forEach((e,i)=>{const x=i%4*360,y=Math.floor(i/4)*250;ctx.drawImage(e.querySelector('canvas'),x+4,y+22,352,220);ctx.fillStyle='white';ctx.font='bold 15px Arial';ctx.fillText(e.dataset.reviewTeam.toUpperCase(),x+10,y+16)});return c.toDataURL('image/jpeg',0.9).split(',')[1]})()`);
        await writeFile(`/private/tmp/ai-play-covers-${game}.jpg`,Buffer.from(sheet,'base64'));
    }

    const preview=await client.evaluate(`(()=>{
        const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=780;
        const ctx=canvas.getContext('2d');ctx.fillStyle='#102b3b';ctx.fillRect(0,0,1200,780);
        for(const [row,team] of ['eagles','packers','chiefs'].entries())for(const [col,id] of ['game','pocket','kick'].entries()){
            const source=document.querySelector('[data-review-team="'+team+'"][data-game-art="'+id+'"] canvas');
            ctx.drawImage(source,col*400+4,row*260+26,392,245);
            ctx.fillStyle='white';ctx.font='bold 15px Arial';ctx.fillText(team.toUpperCase()+' · '+{game:'RUSHING',pocket:'PASSING',kick:'KICKING'}[id],col*400+10,row*260+18);
        }
        return canvas.toDataURL('image/jpeg',0.9).split(',')[1];
    })()`);
    await writeFile('/private/tmp/sprite-play-final-preview.jpg',Buffer.from(preview,'base64'));
    for (const width of [1440,390]) {
        await client.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
        for (const team of ['eagles','bears','chiefs']) {
            for (const page of ['games.html','index.html']) {
                await client.send('Page.navigate',{url:`http://localhost:8000/${page}?team=${team}`});
                await client.until(`document.readyState==='complete'&&[...document.querySelectorAll('[data-scene-style]')].length>0&&[...document.querySelectorAll('[data-scene-style]')].every(e=>e.dataset.artReady==='true')`);
                for (const theme of ['light','dark']) {
                    await client.evaluate(`document.documentElement.dataset.theme='${theme}'`);
                    assert.equal(await client.evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),true,`${page}/${team}/${width}/${theme} fits`);
                    assert.ok(await client.evaluate(`[...document.querySelectorAll('[data-scene-style] canvas')].every(e=>e.width>50&&e.height>50)`));
                }
                if (team==='eagles'&&page==='games.html') {
                    const shot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
                    await writeFile(`/private/tmp/ai-play-lobby-${width}.png`,Buffer.from(shot.data,'base64'));
                }
            }
        }
    }
    assert.deepEqual(client.errors,[],'No browser exceptions');
    console.log('PASS: 96 generated play scenes, 32 team atlases, panel selection, desktop/mobile home and lobby, light/dark, no legacy cover loads or browser exceptions.');
} finally {
    await browser.send('Target.disposeBrowserContext',{browserContextId:client.contextId});
    client.ws.close(); browser.ws.close();
}
