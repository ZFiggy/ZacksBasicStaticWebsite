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
    await client.until('document.readyState === "complete" && !!window.footballPlayers');
    await client.evaluate(`localStorage.setItem('sundayArcade.demo.passing-drive','answered');localStorage.setItem('sundayArcade.demo.field-goal','answered')`);
    await client.until('!!document.passingGame || !!document.kickGame');
    await client.evaluate('Promise.all([footballPlayers.preload(), footballPlayers.preload((document.passingGame || document.kickGame).rival.id)])');
}
async function artifact(name, expression) {
    const data = await client.evaluate(expression);
    await writeFile(`/private/tmp/${name}.png`, Buffer.from(data, 'base64'));
}
try {
    await client.send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false});
    await go('playbook.html?team=eagles&game=pocket');
    const carriedSizes = await client.evaluate(`(() => {
        const cv=document.createElement('canvas'),c=cv.getContext('2d'),sizes=[];
        const draw=footballArt.draw;
        footballArt.draw=(ctx,x,y,width,angle)=>{const t=ctx.getTransform();sizes.push(width*Math.hypot(t.a,t.b));return draw.call(footballArt,ctx,x,y,width,angle);};
        try {
            for(const height of [60,106,116]) footballPlayers.draw(c,'quarterback',0,0,76,height,{ball:true});
        } finally {footballArt.draw=draw;}
        return sizes;
    })()`);
    assert.ok(carriedSizes.every(size=>Math.abs(size-18)<.001),'Carried football size stays independent of athlete scale');
    const mechanics = await client.evaluate(`(() => {
        const back=footballPlayers.rig('kicker',{action:'kick',progress:.26}).p;
        const strike=footballPlayers.rig('kicker',{action:'kick',progress:.5}).p;
        const follow=footballPlayers.rig('kicker',{action:'kick',progress:.66}).p;
        const plant=[];
        for(let i=26;i<=66;i++)plant.push(footballPlayers.rig('kicker',{action:'kick',progress:i/100}).p[8]);
        const release=footballPlayers.rig('quarterback',{action:'throw',progress:.5}).p;
        return {sameLeg:back[10][0]<back[2][0]&&strike[10][0]>strike[2][0]&&follow[10][1]<strike[10][1],
            plant:Math.max(...plant.map(p=>Math.hypot(p[0]-plant[0][0],p[1]-plant[0][1]))),
            oppositeStep:release[8][0]>release[10][0]&&release[6][0]>release[5][0],
            throwPlant:[.5,.6,.7,.8,.9,1].every(progress=>Math.abs(footballPlayers.rig('quarterback',{action:'throw',progress}).p[8][1])<.001)};
    })()`);
    assert.equal(mechanics.sameLeg,true,'The striking leg is the leg that cocks behind the hip');
    assert.ok(mechanics.plant<.001,'Opposite foot stays planted through backswing, strike, follow-through');
    assert.equal(mechanics.throwPlant,true,'The lead foot stays on the turf from release through follow-through');
    assert.equal(mechanics.oppositeStep,true,'Throwing hand and opposite lead foot drive forward together');
    const anatomy = await client.evaluate(`(() => {
        const rows=[];
        for (const role of ['quarterback','receiver','lineman','rusher','kicker','holder']) {
            for (const action of ['run','throw','catch','block','kick','holder','snapBlock','jump','tackle','tackled']) {
                for(let i=0;i<=60;i++) {
                    const {p,normal,bulk,player}=footballPlayers.rig(role,{action,time:i/60,progress:i/60});
                    const stature=Math.max(.94,Math.min(1.07,(player.height||74)/74));
                    for(const side of [-1,1]) {
                        const h=side===-1?4:6, f=side===-1?8:10;
                        const start=[p[1][0]+normal[0]*side*13*bulk,p[1][1]+normal[1]*side*13*bulk+2];
                        const hip=[p[2][0]+side*6*bulk,p[2][1]+1];
                        rows.push(Math.abs(Math.hypot(p[h-1][0]-start[0],p[h-1][1]-start[1])-21*stature));
                        rows.push(Math.abs(Math.hypot(p[h][0]-p[h-1][0],p[h][1]-p[h-1][1])-20*stature));
                        rows.push(Math.abs(Math.hypot(p[f-1][0]-hip[0],p[f-1][1]-hip[1])-24*stature));
                        rows.push(Math.abs(Math.hypot(p[f][0]-p[f-1][0],p[f][1]-p[f-1][1])-23*stature));
                    }
                }
            }
        }
        return Math.max(...rows);
    })()`);
    assert.ok(anatomy < .001, `Limb lengths stay fixed throughout interpolated actions: ${anatomy}`);
    const torsoJoin = await client.evaluate(`(() => {
        const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300;
        const c = cv.getContext('2d'), errors = [];
        for (const teamId of ['eagles', 'bears', 'chiefs', 'ravens']) {
            for (const [role, action] of [['holder','holder'],['snapper','snapBlock'],['lineman','block'],['rusher','block']]) {
                for (const flip of [false, true]) for (const progress of [0,.25,.5,.75,1]) {
                    const options = {teamId, action, progress, flip};
                    const {p} = footballPlayers.rig(role, options);
                    const length = Math.hypot(p[2][0]-p[1][0],p[2][1]-p[1][1]);
                    const original = c.strokeText;
                    c.strokeText = function(...args) {
                        const m = c.getTransform();
                        const waist = new DOMPoint(0,length).matrixTransform(m);
                        const expected = {x:200+p[2][0]*(flip?-1:1),y:200+p[2][1]};
                        errors.push(Math.hypot(waist.x-expected.x,waist.y-expected.y));
                        return original.apply(this,args);
                    };
                    try {footballPlayers.draw(c,role,162,90,76,110,options);} finally {c.strokeText=original;}
                }
            }
        }
        return {count:errors.length,maximum:Math.max(...errors)};
    })()`);
    assert.equal(torsoJoin.count,160);
    assert.ok(torsoJoin.maximum < .001, 'Rendered jersey waist stays joined to hips in kneeling, snapping and blocking poses');

    const runningArms = await client.evaluate(`(() => {
        let lowestElbow = Infinity, largestStep = 0;
        for (const role of ['quarterback', 'receiver', 'lineman', 'rusher']) {
            for (const movement of [.25, .5, 1]) {
                let previous;
                for (let i = 0; i <= 240; i++) {
                    const {p, normal, bulk} = footballPlayers.rig(role, {action: 'run', stride: i / 240, movement});
                    for (const side of [-1, 1]) {
                        const elbow = side === -1 ? 3 : 5;
                        const shoulderY = p[1][1] + normal[1] * side * 13 * bulk + 2;
                        lowestElbow = Math.min(lowestElbow, p[elbow][1] - shoulderY);
                        if (previous) for (const joint of [elbow, elbow + 1]) largestStep = Math.max(largestStep, Math.hypot(p[joint][0] - previous[joint][0], p[joint][1] - previous[joint][1]));
                    }
                    previous = p;
                }
            }
        }
        return {lowestElbow, largestStep};
    })()`);
    assert.ok(runningArms.lowestElbow > 5, `Running elbows stay below shoulders: ${JSON.stringify(runningArms)}`);
    assert.ok(runningArms.largestStep < 2, `Arms swing continuously through a full stride: ${JSON.stringify(runningArms)}`);
    await artifact('football-motion-poses', `(() => {
        const cv=document.createElement('canvas');cv.width=1440;cv.height=1680;const c=cv.getContext('2d');c.fillStyle='#cbd9df';c.fillRect(0,0,cv.width,cv.height);
        const actions=[['receiver','run'],['quarterback','throw'],['receiver','catch'],['lineman','block'],['kicker','kick'],['holder','holder'],['rusher','jump'],['receiver','tackled']];
        actions.forEach(([role,action],row)=>{c.fillStyle='#152b34';c.font='bold 18px Arial';c.fillText(role+' / '+action,12,row*210+23);for(let i=0;i<8;i++)footballPlayers.draw(c,role,i*180+40,row*210+45,95,145,{action,progress:i/7,time:i/7});});
        return cv.toDataURL().split(',')[1];
    })()`);
    const markers = await client.evaluate(`(() => {
        const g=document.passingGame;cancelAnimationFrame(g.frame);g.reset();
        const capture=()=>{
            const labels=[],fill=g.ctx.fillText;
            g.ctx.fillText=function(text,x,y,...rest){if(this.font==='900 20px system-ui'&&Number.isInteger(text)&&text>=1&&text<=3)labels.push({key:text,x,y});return fill.call(this,text,x,y,...rest);};
            try {g.draw();} finally {g.ctx.fillText=fill;}
            return labels;
        };
        const ready=capture();g.action();g.rushers=[];g.defenders=[];
        for(let i=0;i<40;i++)g.update(1/60);
        const live=capture();
        const tracked=live.every(label=>Math.abs(label.x-g.x(g.receivers[label.key-1].x))<.01);
        const box=g.canvas.getBoundingClientRect(),label=live.find(p=>p.key===2);
        g.canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:box.left+label.x/1064*box.width,clientY:box.top+(label.y-7)/552*box.height,bubbles:true}));
        const tapped=g.ball?.receiver===1;
        return {ready:ready.map(p=>p.key),live:live.map(p=>p.key),tracked,tapped};
    })()`);
    assert.deepEqual(markers.ready,[1,2,3]);assert.deepEqual(markers.live,[1,2,3]);
    assert.equal(markers.tracked,true,'Numbered keys follow their assigned receivers');
    assert.equal(markers.tapped,true,'Tapping the on-field 2 badge targets receiver 2');
    const passing = await client.evaluate(`(() => {
        const g=document.passingGame;cancelAnimationFrame(g.frame);g.reset();g.action();
        for(let i=0;i<90;i++)g.update(1/60);
        const pairs=g.blockers.map((p,i)=>({gap:(g.rushers[i].x-p.x)*12,engaged:p.engaged&&g.rushers[i].engaged}));
        const stride=g.receivers.map(p=>p.stride);
        g.pause();const frozen=g.time;g.update(.2);const paused=g.time===frozen;g.pause();
        // A controlled open throw checks ownership, result text and score exactly once.
        g.rushers=[];g.defenders=[];g.throw(1);
        for(let i=0;i<400&&g.phase==='flight';i++)g.update(1/120);
        const catcher=footballPlayers.identity('receiver',teamArcade.team.id,1);
        const complete=g.completed&&g.status.textContent.includes(catcher.name);
        g.carrier.y=1;g.update(.016);
        const namedResult=g.status.textContent.includes(catcher.name)&&g.drive.completions===1;
        g.reset();g.action();g.rushers=[];g.throw(0);
        const b=g.ball;b.elapsed=b.duration*.45;b.style='bullet';
        g.defenders=[{x:b.from.x+(b.target.x-b.from.x)*.45,y:b.from.y+(b.target.y-b.from.y)*.45,type:'cover',rosterIndex:0}];
        g.update(.001);
        const defender=footballPlayers.identity('corner',g.rival.id,0);
        const picked=g.resultKind==='interception'&&g.status.textContent.includes(defender.name)&&g.caughtBy.id===defender.id;
        return {pairs,stride,paused,complete,namedResult,picked};
    })()`);
    assert.ok(passing.pairs.every(p=>p.engaged && p.gap>39&&p.gap<42));
    assert.ok(passing.stride.every(n=>n>0));
    for (const key of ['paused','complete','namedResult','picked']) assert.equal(passing[key],true,key);
    await artifact('football-passing-sequence', `(() => {
        const g=document.passingGame;g.reset();g.playSeed=7919;g.setup();g.action();
        const cv=document.createElement('canvas');cv.width=1596;cv.height=1104;const c=cv.getContext('2d');
        for(let frame=0;frame<12;frame++) {
            for(let i=0;i<12;i++)g.update(1/60);
            if(frame===5)g.throw(1);
            g.draw();c.drawImage(g.canvas,frame%3*532,Math.floor(frame/3)*276,532,276);
        }
        return cv.toDataURL().split(',')[1];
    })()`);
    await go('kick.html?team=bears');
    for (const viewport of [1440,390]) {
        await client.send('Emulation.setDeviceMetricsOverride',{width:viewport,height:1000,deviceScaleFactor:1,mobile:viewport<600});
        const sizes = await client.evaluate(`(() => {
            const g=document.kickGame,sizes=[],draw=footballArt.draw;
            footballArt.draw=(ctx,x,y,width,angle)=>{const t=ctx.getTransform();sizes.push(width*Math.hypot(t.a,t.b));return draw.call(footballArt,ctx,x,y,width,angle);};
            try {
                g.reset();g.draw();g.act();cancelAnimationFrame(g.frame);g.power=.9;g.launch();cancelAnimationFrame(g.frame);g.shot.outcome='good';
                for(const time of [.4,.9,1.4,2]) {g.flightElapsed=time;g.shotProgress=Math.max(0,(time-.82)/1.35);g.draw();}
            } finally {footballArt.draw=draw;g.reset();}
            return sizes;
        })()`);
        const uprightSize = sizes[0] * 30 / 18;
        assert.ok(sizes.length>=5 && sizes.every(size=>Math.abs(size-sizes[0])<.001 || Math.abs(size-uprightSize)<.001),`Each kicking camera keeps a fixed ball size at ${viewport}px: ${JSON.stringify(sizes)}`);
        assert.ok(sizes.filter(size=>Math.abs(size-uprightSize)<.001).length>=3,'Upright flight uses the larger ball throughout');
    }
    await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    const aimingGuide = await client.evaluate(`(() => {
        const g = document.kickGame; g.reset();
        const samples = [];
        const arc = g.ctx.arc;
        g.ctx.arc = function(x, y, radius, ...rest) {
            if (radius === 8 && y === 62) samples.push(x);
            return arc.call(this, x, y, radius, ...rest);
        };
        try { g.setAim(-.7); g.draw(); g.setAim(.7); g.draw(); }
        finally { g.ctx.arc = arc; g.reset(); }
        return {samples, keyBelowField: document.querySelector('.game-surface').contains(document.querySelector('.kick-field-guide')),
            spot: document.getElementById('kick-spot').textContent, manualCollapsed: !document.querySelector('.kick-manual-aim').open};
    })()`);
    assert.ok(aimingGuide.samples[0] < aimingGuide.samples[1], 'Right input moves the aiming dot right');
    assert.equal(aimingGuide.keyBelowField, true);
    assert.equal(aimingGuide.manualCollapsed, true);
    assert.match(aimingGuide.spot, /hash/);
    const variety = await client.evaluate(`(() => {
        const g=document.kickGame;g.reset();
        const wrong=g.protection;document.querySelector('[data-protect="'+g.situation.rush+'"]').click();
        const correct=g.protection;
        g.act();cancelAnimationFrame(g.frame);g.position=.9;g.act();cancelAnimationFrame(g.frame);
        const singleMeter=getComputedStyle(document.querySelector('.kick-meter')).display==='none'&&!document.querySelector('.kick-steer').hidden;
        const aim=g.aim;g.steeringKeys.add('d');g.lastTick=g.startedAt+200;g.tick(g.startedAt+250);cancelAnimationFrame(g.frame);g.steeringKeys.clear();
        const steer=g.aim>aim;
        g.pause();const offset=g.liveOffset,elapsed=g.elapsed;g.tick(g.startedAt+500);const frozen=g.liveOffset===offset&&g.elapsed===elapsed;
        g.pause();cancelAnimationFrame(g.frame);
        return {protection:correct>=wrong,singleMeter,steer,frozen};
    })()`);
    for(const [key,value] of Object.entries(variety))assert.equal(value,true,key);
    const kick = await client.evaluate(`(() => {
        const g=document.kickGame;g.reset();g.act();cancelAnimationFrame(g.frame);g.elapsed=1;g.power=.9;g.position=.5;g.launch();
        g.flightElapsed=.82;g.strikeProgress=.82/1.1;g.shotProgress=0;
        const k=g.kickerPose();
        const foot=footballPlayers.foot('kicker',k.x-38,k.y-116,76,116,{action:k.action,progress:k.progress});
        const contact=Math.hypot(foot.x-g.formation.ballX,foot.y-(g.formation.ballY-7));
        const actors=g.defenseActors();
        const frame=t=>{
            g.flightElapsed=t;g.shotProgress=Math.max(0,(t-.82)/1.35);
            return g.defenseActors().map(p=>JSON.stringify(footballPlayers.rig(p.role,{teamId:p.teamId,variant:p.variant||0,action:p.action,progress:p.progress,time:g.animationTime}).p));
        };
        const before=frame(.4),after=frame(.6);
        const animated=before.map((p,i)=>p!==after[i]);
        g.shot.outcome='blocked';g.shotProgress=.5;g.flightElapsed=.82+1.35*.5;
        let ball;const draw=footballArt.draw;footballArt.draw=(c,x,y,...rest)=>{ball={x,y};return draw.call(footballArt,c,x,y,...rest);};g.draw();footballArt.draw=draw;
        const r=g.defenseActors().find(p=>p.role==='rusher'&&p.variant===1);
        const hand=footballPlayers.hand('rusher',r.x-38,r.y-106,76,106,{teamId:g.rival.id,variant:1,action:'jump',progress:.5,flip:true});
        return {contact,animated,block:Math.hypot(hand.x-ball.x,hand.y-ball.y)};
    })()`);
    assert.ok(kick.contact<.01,`Foot meets football: ${kick.contact}`);
    assert.ok(kick.animated.every(Boolean),'Every supporting athlete continues animating during flight');
    assert.ok(kick.block<.01,'Blocked ball reaches the actual drawn hand');
    await artifact('football-kick-sequence', `(() => {
        const g=document.kickGame;g.reset();g.act();cancelAnimationFrame(g.frame);g.power=.9;g.position=.5;g.elapsed=1.1;g.launch();
        const cv=document.createElement('canvas');cv.width=1596;cv.height=1380;const c=cv.getContext('2d');
        const times=[-.9,-.78,-.65,-.4,0,.12,.25,.36,.55,.72,.82,1,1.3,1.7,2.05];
        for(let frame=0;frame<times.length;frame++) {
            const t=times[frame];g.state=t<0?'running':'flight';g.elapsed=t<0?t+.9:1.1;g.flightElapsed=Math.max(0,t);g.shotProgress=Math.max(0,Math.min(1,(t-.82)/1.35));g.draw();
            c.drawImage(g.canvas,frame%3*532,Math.floor(frame/3)*276,532,276);
        }
        return cv.toDataURL().split(',')[1];
    })()`);
    await client.evaluate('footballField.preload()');
    await artifact('football-endzones', `(() => {
        const cv=document.createElement('canvas');cv.width=1440;cv.height=1152;const c=cv.getContext('2d');c.fillStyle='#ccd9df';c.fillRect(0,0,cv.width,cv.height);
        NFL_TEAMS.forEach((team,i)=>{
            const col=i%4,row=Math.floor(i/4),x=col*360,y=row*144;
            c.fillStyle='#132a35';c.font='bold 16px Arial';c.textAlign='left';c.fillText(team.name,x+12,y+21);
            c.save();c.translate(x+180,y+85);c.rotate(Math.PI/2);footballField.endzone(c,-44,-166,88,332,team);c.restore();
        });
        return cv.toDataURL().split(',')[1];
    })()`);
    await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:true});
    await client.evaluate(`(()=>{const g=document.kickGame;g.reset();g.act();cancelAnimationFrame(g.frame);g.position=.9;g.act();cancelAnimationFrame(g.frame);g.canvas.focus();})()`);
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'D',code:'KeyD'});
    assert.equal(await client.evaluate('document.kickGame.steeringKeys.has("d")'),true,'Keyboard steering accepts shifted input');
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'D',code:'KeyD'});
    assert.equal(await client.evaluate('document.kickGame.steeringKeys.size'),0);
    await client.evaluate(`document.querySelector('[data-steer="-1"]').scrollIntoView({block:'center',behavior:'instant'})`);
    const touch=await client.evaluate(`(()=>{const b=document.querySelector('[data-steer="-1"]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()`);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
    assert.equal(await client.evaluate('document.kickGame.steeringKeys.has("a")'),true,'Real touch holds aiming left');
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await client.evaluate('document.kickGame.steeringKeys.size'),0,'Touch release clears steering');
    assert.equal(await client.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    await client.send('Page.captureScreenshot',{captureBeyondViewport:true}).then(r=>writeFile('/private/tmp/football-live-aim-mobile.png',Buffer.from(r.data,'base64')));
    await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert.equal(await client.evaluate(`JSON.stringify(footballPlayers.pose('run',0,.5))===JSON.stringify(footballPlayers.pose('run',.2,.5))`),true);
    assert.deepEqual(client.errors,[]);
    console.log('PASS constant bone lengths; paired protection; distance-based gait; named completions/interceptions; paused movement; moving kick support; precise foot/ball and block contact. Review sheets saved to /private/tmp/football-*-sequence.png and football-motion-poses.png.');
} finally {client.ws.close();browser.ws.close();}
