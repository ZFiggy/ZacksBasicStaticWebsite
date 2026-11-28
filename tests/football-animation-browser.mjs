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
    await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await client.send('Page.navigate',{url:'http://localhost:8000/playbook.html?team=eagles&game=pocket'});
    await client.until('!!document.passingGame && !!window.footballPlayers');
    await client.evaluate('localStorage.setItem("sundayArcade.demo.passing-drive","answered");document.passingGame.reset();cancelAnimationFrame(document.passingGame.frame)');
    await client.evaluate('Promise.all([footballPlayers.preload(),footballPlayers.preload(document.passingGame.rival.id)])');
    const assignments = await client.evaluate(`(() => {
        const samples=[];
        for(const team of NFL_TEAMS) for(let look=0;look<6;look++) {
            const home=[footballPlayers.identity('quarterback',team.id), ...[0,1,2].map(i=>footballPlayers.identity('receiver',team.id,i)), ...[0,1].map(i=>footballPlayers.identity('lineman',team.id,i))];
            const defense=[...[0,1,2].map(i=>footballPlayers.identity('corner',team.id,i)), ...[0,1].map(i=>footballPlayers.identity('safety',team.id,i)), ...[0,1,2].map(i=>footballPlayers.identity('rusher',team.id,i))];
            const kicking=['kicker','holder','snapper'].map(r=>footballPlayers.identity(r,team.id)).concat([0,1].map(i=>footballPlayers.identity('lineman',team.id,i)));
            samples.push({team:team.id,home,defense,kicking});
        }
        return samples;
    })()`);
    for(const sample of assignments) for(const key of ['home','defense','kicking']) assert.equal(new Set(sample[key].map(p=>p.id)).size,sample[key].length,`${sample.team}: distinct ${key}`);
    const likenesses = await client.evaluate(`(async () => {
        const result=[];
        for(const team of NFL_TEAMS) {
            await footballPlayers.preload(team.id);
            const cast=currentRosters.teams[team.id].cast;
            for(const [role,count] of Object.entries({quarterback:1,receiver:3,lineman:2,corner:3,safety:2,rusher:3,kicker:1,holder:1,snapper:1})) for(let i=0;i<count;i++) {
                const p=cast[role][i],art=footballPlayers.headFor(p);
                result.push({id:p.id,name:p.name,hasArt:!!art,ready:art?.image.complete&&!!art?.image.naturalWidth});
            }
        }
        return result;
    })()`);
    assert.equal(likenesses.length,544);
    assert.ok(likenesses.every(p=>p.hasArt&&p.ready),'Every on-field player loads an individual cartoon likeness');
    const labels = await client.evaluate(`(() => {
        const g=document.passingGame;g.reset();const text=[],fill=g.ctx.fillText;
        g.ctx.fillText=function(t,...args){text.push(String(t));return fill.call(this,t,...args);};
        try {g.player(g.qb,'quarterback',false,'#fff');} finally {g.ctx.fillText=fill;}
        return text;
    })()`);
    assert.deepEqual(labels,[String(assignments[0].home[0].number)],'The quarterback draws their jersey number');
    const tackle = await client.evaluate(`(() => {
        const g=document.passingGame;g.reset();g.action();g.scramble();g.defenders=[{x:g.qb.x+1,y:g.qb.y,type:'cover',rosterIndex:0}];g.rushers=[];g.update(.016);
        const actions=[];const draw=footballPlayers.draw;
        footballPlayers.draw=(c,role,x,y,w,h,o)=>{actions.push({role,action:o.action,ball:o.ball});return draw(c,role,x,y,w,h,o);};
        g.resultAt=performance.now()-400;g.draw();footballPlayers.draw=draw;
        return {phase:g.phase,kind:g.resultKind,actions};
    })()`);
    assert.equal(tackle.phase,'result');
    assert.equal(tackle.actions.filter(p=>p.action==='tackle').length,1);
    assert.equal(tackle.actions.filter(p=>p.action==='tackled').length,1);
    assert.equal(tackle.actions.filter(p=>p.ball).length,1);
    await client.send('Page.captureScreenshot').then(r=>writeFile('/private/tmp/football-tackle.png',Buffer.from(r.data,'base64')));
    const interception=await client.evaluate(`(() => {
        const g=document.passingGame;g.reset();g.action();g.rushers=[];g.throw(0);
        const b=g.ball;b.elapsed=b.duration*.45;b.style='bullet';
        g.defenders=[{x:b.from.x+(b.target.x-b.from.x)*.45,y:b.from.y+(b.target.y-b.from.y)*.45,type:'cover',rosterIndex:0}];
        g.update(.001);g.resultAt=performance.now()-350;
        const actions=[];const draw=footballPlayers.draw;footballPlayers.draw=(c,r,x,y,w,h,o)=>{actions.push(o);return draw(c,r,x,y,w,h,o);};g.draw();footballPlayers.draw=draw;
        return {kind:g.resultKind,ball:g.ball,actions};
    })()`);
    assert.equal(interception.kind,'interception');assert.equal(interception.ball,null);
    assert.equal(interception.actions.filter(o=>o.ball).length,1);
    assert.ok(interception.actions.some(o=>o.action==='intercept' && o.ball));
    await client.send('Page.captureScreenshot').then(r=>writeFile('/private/tmp/football-interception.png',Buffer.from(r.data,'base64')));
    await client.evaluate(`(() => {const g=document.passingGame;g.drive.spot=92;g.drive.ended=false;g.setup();g.draw();})()`);
    await new Promise(r=>setTimeout(r,300));await client.evaluate('document.passingGame.draw()');
    await client.send('Page.captureScreenshot').then(r=>writeFile('/private/tmp/football-endzone.png',Buffer.from(r.data,'base64')));
    const edge=await client.evaluate(`(() => {const g=document.passingGame;const c=g.ctx;const rgb=x=>Array.from(c.getImageData(x,400,1,1).data);return {end:g.x(110),inside:rgb(g.x(109)),apron:rgb(g.x(111)),outside:rgb(g.x(113)+1)};})()`);
    assert.ok(edge.end<1040);assert.notDeepEqual(edge.inside,edge.apron);assert.notDeepEqual(edge.apron,edge.outside);
    const sheet=await client.evaluate(`(() => {
        const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1440;const c=canvas.getContext('2d');c.fillStyle='#ccd9de';c.fillRect(0,0,1400,1440);
        const actions=[['quarterback','throw'],['receiver','catch'],['corner','intercept'],['rusher','tackle'],['receiver','tackled'],['kicker','kick'],['holder','holder'],['lineman','block']];
        actions.forEach(([role,action],row)=>{c.fillStyle='#152b34';c.font='bold 18px Arial';c.fillText(role+' / '+action,12,row*180+23);for(let i=0;i<7;i++) footballPlayers.draw(c,role,i*195+50,row*180+40,95,127,{action,progress:i/6,time:i/6});});
        return canvas.toDataURL().split(',')[1];
    })()`);
    await writeFile('/private/tmp/football-jointed-poses.png',Buffer.from(sheet,'base64'));
    await client.send('Page.navigate',{url:'http://localhost:8000/kick.html?team=eagles'});await client.until('!!document.kickGame');
    await client.evaluate('Promise.all([footballPlayers.preload(),footballPlayers.preload(document.kickGame.rival.id)])');
    await client.evaluate('localStorage.setItem("sundayArcade.demo.field-goals","answered");document.kickGame.reset()');
    const kick=await client.evaluate(`(() => {
        const g=document.kickGame;g.act();g.power=.9;g.position=.5;g.launch();cancelAnimationFrame(g.frame);
        g.flightElapsed=.82;g.strikeProgress=.82/1.1;g.shotProgress=0;g.draw();
        const k=g.kickerPose();
        const foot=footballPlayers.foot('kicker',k.x-38,k.y-116,76,116,{action:k.action,progress:k.progress});
        return {error:Math.hypot(foot.x-g.formation.ballX,foot.y-g.formation.ballY+7),holder:footballPlayers.identity('holder').name};
    })()`);
    assert.ok(kick.error<2,'Kicking foot reaches ball at release');assert.equal(kick.holder,'Braden Mann');
    await client.send('Page.captureScreenshot').then(r=>writeFile('/private/tmp/football-kick-contact.png',Buffer.from(r.data,'base64')));
    const block = await client.evaluate(`(() => {
        const g=document.kickGame;g.shot.outcome='blocked';g.shotProgress=.5;g.elapsed=g.protection;
        let rusher,ball;const draw=footballPlayers.draw,football=footballArt.draw;
        footballPlayers.draw=(c,role,x,y,w,h,o)=>{if(role==='rusher'&&o.variant===1)rusher={x,y,w,h,o};return draw(c,role,x,y,w,h,o);};
        footballArt.draw=(c,x,y,...rest)=>{ball={x,y};return football.call(footballArt,c,x,y,...rest);};
        g.draw();footballPlayers.draw=draw;footballArt.draw=football;
        const hand=footballPlayers.hand('rusher',rusher.x,rusher.y,rusher.w,rusher.h,{...rusher.o,action:'jump',progress:.5});
        return {error:Math.hypot(ball.x-hand.x,ball.y-hand.y)};
    })()`);
    assert.ok(block.error<1,'Blocked kick meets rusher hand before deflecting');
    await client.send('Page.captureScreenshot').then(r=>writeFile('/private/tmp/football-block-contact.png',Buffer.from(r.data,'base64')));
    assert.deepEqual(client.errors,[]);
    console.log('PASS 32 unique passing/defensive/kicking casts; paired tackle; defender interception ownership; finite end zone; foot-ball contact and Eagles holder; pose and game screenshots.');
} finally {client.ws.close();browser.ws.close();}
