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
    await client.send('Page.navigate',{url:`http://localhost:8000/${page}`});
    await new Promise(resolve=>setTimeout(resolve,100));
    await client.until("document.readyState==='complete' && !!window.teamArcade && !!window.teamArcade.personality");
}
if (process.argv.includes('--picker-only')) {
    await go('choose.html');
    await client.until('document.querySelectorAll(".team-choice-art img").length === 32');
    for (const width of [1440, 768, 390, 320]) {
        await client.send('Emulation.setDeviceMetricsOverride', {width,height:1000,deviceScaleFactor:1,mobile:width<600});
        const escaped = await client.evaluate(`Array.from(document.querySelectorAll('.team-choice-art'), frame => {
            const box=frame.getBoundingClientRect(), image=frame.querySelector('img').getBoundingClientRect();
            return {team:frame.parentElement.querySelector('h2').textContent,contained:image.left>=box.left-1 && image.top>=box.top-1 && image.right<=box.right+1 && image.bottom<=box.bottom+1};
        }).filter(item => !item.contained)`);
        assert.deepEqual(escaped, [], `Team photos escaped their cards at ${width}px`);
        assert.equal(await client.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
        const covered = await client.evaluate(`Array.from(document.querySelectorAll('.team-choice-copy h2')).filter(title => {
            const box=title.getBoundingClientRect();
            if(box.top<0 || box.bottom>innerHeight)return false;
            return document.elementFromPoint(box.left+box.width/2,box.top+box.height/2)?.closest('.team-choice') !== title.closest('.team-choice');
        }).map(title=>title.textContent)`);
        assert.deepEqual(covered, [], 'A photo covered another team card');
        if (width === 1440 || width === 390) {
            await client.until('document.querySelector(".team-choice-art img").naturalWidth > 0');
            const shot = await client.send('Page.captureScreenshot',{format:'png'});
            await writeFile(`/private/tmp/team-picker-fixed-${width}.png`,Buffer.from(shot.data,'base64'));
        }
    }
    await client.evaluate('document.getElementById("team-search").value="Dallas";document.getElementById("team-search").dispatchEvent(new Event("input"))');
    assert.equal(await client.evaluate('document.querySelectorAll(".team-choice").length'), 1);
    const href=await client.evaluate('document.querySelector(".team-choice").getAttribute("href")');
    assert.match(href,/team=cowboys/);
    await client.evaluate('document.querySelector(".team-choice").click()');
    await client.until('document.querySelector(".team-hero-art img")?.naturalWidth > 0');
    assert.equal(await client.evaluate('document.documentElement.dataset.team'),'cowboys');
    assert.deepEqual(client.errors, []);
    console.log('PASS: all 32 picker photos stay inside their cards at 1440, 768, 390, and 320px; titles remain clickable; filtering and team navigation work; no browser exceptions.');
    client.ws.close();browser.ws.close();process.exit(0);
}
await go('games.html?team=eagles');
const teams=await client.evaluate('window.NFL_TEAMS.map(team=>({id:team.id,name:team.name}))');
for(const team of teams) {
    await go(`games.html?team=${team.id}`);
    await client.until("document.querySelectorAll('.library-mascot[data-art-ready=true]').length===10");
    const covers=await client.evaluate("Array.from(document.querySelectorAll('.library-mascot'),item=>item.dataset.cover)");
    assert.equal(new Set(covers).size,10,`Repeated covers ${team.id}`);
    const pixels=await client.evaluate("Array.from(document.querySelectorAll('.library-mascot canvas'),canvas=>canvas.toDataURL().slice(-2000))");
    assert.equal(new Set(pixels).size,10,`Repeated rendered cover pixels ${team.id}`);
    if (team.id !== 'eagles') {
        assert.ok(await client.evaluate('window.teamArcade.coverFor("game").preview'));
        await go(`counter.html?team=${team.id}`);
        await client.until('document.querySelector(".counter-team-art img")?.naturalWidth > 0');
        assert.equal(await client.evaluate('document.getElementById("panel-title").textContent'), `${team.name.split(' ').at(-1).toUpperCase()} SCOREBOARD`);
        assert.ok(await client.evaluate('window.teamArcade.media.hero.src !== window.teamArcade.media.scoreboard.src'));
        assert.ok(await client.evaluate('!!document.querySelector(".eagles-backdrop > .green-overlay")'), 'Missing photo contrast overlay');
        assert.equal(await client.evaluate('document.querySelector(".throw-quarterback text").textContent'), String(await client.evaluate('window.teamArcade.personality.quarterback.number')));
        assert.equal(await client.evaluate('document.querySelector(".touchdown-receiver text").textContent'), String(await client.evaluate('window.teamArcade.personality.runner.number')));
        await client.evaluate('new Promise(resolve => setTimeout(resolve, 250))');
        assert.equal(await client.evaluate('getComputedStyle(document.querySelector(".increment-button")).backgroundColor'), await client.evaluate('(()=>{const c=document.createElement("div");c.style.color=window.teamArcade.team.primary;document.body.append(c);const color=getComputedStyle(c).color;c.remove();return color;})()'));
        await client.evaluate('document.getElementById("increment").click()');
        assert.equal(await client.evaluate('window.eaglesCounter.getCount()'), 1);
    }
    await go(`barkley.html?team=${team.id}`);
    await client.until('!!document.barkleyGame && document.barkleyGame.portrait.complete && document.barkleyGame.portrait.naturalWidth>0');
    assert.equal(await client.evaluate('document.barkleyGame.flightSprite.src'),await client.evaluate('window.teamArcade.personality.flightSprite.src'));
    const alpha=await client.evaluate(`(()=>{const image=document.barkleyGame.portrait;const c=document.createElement('canvas');c.width=100;c.height=100;const ctx=c.getContext('2d');ctx.drawImage(image,0,0,100,100);const data=ctx.getImageData(0,0,100,100).data;let count=0;for(let i=3;i<data.length;i+=4)if(data[i]<10)count++;return count/10000;})()`);
    assert.ok(alpha>0.15,`Sprite background is opaque: ${team.id} (${alpha})`);
    await client.evaluate('document.barkleyGame.flap();document.barkleyGame.togglePause()');
    assert.equal(await client.evaluate('document.barkleyGame.state'),'paused');
    await go(`jalen.html?team=${team.id}`);
    await client.until('!!document.jalenGame?.image && !document.jalenGame.loading');
    assert.equal(await client.evaluate('document.jalenGame.mode'),'photo',`Default is not photographic: ${team.id}`);
    if (team.id !== 'eagles') {
        assert.equal(await client.evaluate('document.jalenGame.photoSet.authentic'), false);
        assert.equal(await client.evaluate('document.jalenGame.playerName'), await client.evaluate('window.teamArcade.personality.searchPlayer.name'));
        assert.equal(await client.evaluate('document.jalenGame.scenes.every(scene => scene.kind === "generated")'), true);
        assert.ok(await client.evaluate('document.querySelector(".photo-disclosure").textContent.includes("AI-created fictional")'));
    }
    for(let level=0;level<5;level++) {
        await client.until(`document.jalenGame.level===${level} && !document.jalenGame.loading`);
        await client.evaluate('document.jalenGame.choosePoint(0,0)');
        assert.equal(await client.evaluate('document.jalenGame.found'), false, `Wrong guess accepted ${team.id}/${level}`);
        await client.evaluate('(()=>{const game=document.jalenGame;const [x,y,w,h]=game.scenes[game.level].target;game.choosePoint((x+w/2)*game.canvas.width,(y+h/2)*game.canvas.height);})()');
        assert.equal(await client.evaluate('document.jalenGame.found'),true,`Photo hit failed ${team.id}/${level}`);
        if(level<4)await client.evaluate("document.getElementById('search-next').click()");
    }
    assert.equal(await client.evaluate("window.teamArcade.storage.getItem('jalenCleared')"),'5');
    await go(`jalen.html?team=${team.id}`);
    await client.until('!!document.jalenGame?.image && !document.jalenGame.loading');
    assert.equal(await client.evaluate('document.jalenGame.found'),true);
    assert.equal(await client.evaluate('document.jalenGame.level'),4);
}
console.log('PASS: all32teams have10unique rendered covers, transparent player flight sprites, photographic defaults, all 160 photo hit targets and misses and saved photo completion.');
await go('barkley.html?team=eagles');
assert.match(await client.evaluate('document.barkleyGame.portrait.src'),/assets\/barkley-flight.png$/);
await go('jalen.html?team=eagles');
await client.until('!!document.jalenGame?.image && !document.jalenGame.loading');
assert.match(await client.evaluate('document.jalenGame.image.src'),/search-level-5-v2.jpg$/);
for(const mode of ['pocket','shove','recall','punt','blitz','signal']) {
    await go(`playbook.html?team=eagles&game=${mode}`);
    await client.evaluate('document.playbook.reset()');
    assert.equal(await client.evaluate('document.querySelectorAll(".on-field-story").length'),1);
    if(mode==='shove')assert.equal(await client.evaluate('document.querySelectorAll(".line-jersey").length'),3);
    if(mode==='recall')assert.equal(await client.evaluate('document.querySelectorAll(".route-diagram").length'),4);
    if(mode==='punt')assert.equal(await client.evaluate('document.getElementById("punt-ball").tagName'),'IMG');
}
for(const team of ['eagles','cowboys','lions','patriots','browns','chargers']) {
    for(const page of ['index.html','games.html','barkley.html','jalen.html','playbook.html?game=shove']) {
        await go(page+(page.includes('?')?'&':'?')+'team='+team);
        if(page.includes('playbook'))await client.evaluate('document.playbook.reset()');
        for(const width of [1440,768,390,320]) {
            await client.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
            for(const theme of ['light','dark']) {
                await client.evaluate(`document.documentElement.dataset.theme='${theme}'`);
                assert.equal(await client.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`Overflow ${team} ${page} ${width} ${theme}`);
            }
        }
    }
}
await go('choose.html');
await client.until('document.querySelectorAll(".team-choice-art img").length === 32');
assert.equal(await client.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Team picker overflow');
await client.evaluate('document.getElementById("team-search").value="Dallas";document.getElementById("team-search").dispatchEvent(new Event("input"))');
assert.equal(await client.evaluate('document.querySelectorAll(".team-choice").length'), 1);
await client.until('document.querySelector(".team-choice-art img")?.naturalWidth > 0');
for (const [team, page, width] of [['cowboys','counter.html',1440],['vikings','counter.html',390],['chiefs','index.html',1440],['cowboys','jalen.html',390]]) {
    await client.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    await go(`${page}?team=${team}`);
    await client.evaluate('new Promise(resolve => setTimeout(resolve, 300))');
    if (page === 'jalen.html') await client.until('!!document.jalenGame?.image && !document.jalenGame.loading');
    const shot = await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    await writeFile(`/private/tmp/team-refresh-${team}-${page}-${width}.png`,Buffer.from(shot.data,'base64'));
}
assert.deepEqual(client.errors.map(error=>error.exception?.description||error.text),[]);
console.log('PASS: original Eagles assets preserved, six personalized live playbook scenes, six teams ×five pages×four widths×both themes; no JavaScript exceptions.');
client.ws.close();browser.ws.close();
