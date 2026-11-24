// Illustrated crowd-search variant for every team; the original Eagles photo round remains optional.
class TeamSearch {
    constructor() {
        this.team = window.teamArcade.team;
        this.canvas = document.getElementById('searchCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 1200; this.canvas.height = 780;
        this.status = document.getElementById('search-status');
        this.viewport = document.getElementById('search-viewport');
        this.next = document.getElementById('search-next');
        this.targets = [[0.17,0.31],[0.71,0.54],[0.40,0.73],[0.81,0.27],[0.58,0.42]];
        this.level = 0; this.found = false; this.misses = 0;
        try {
            const saved = JSON.parse(window.teamArcade.storage.getItem('captainProgress'));
            if (Number.isInteger(saved?.level) && saved.level >= 0 && saved.level < 5 && typeof saved.found === 'boolean' && Number.isSafeInteger(saved.misses) && saved.misses >= 0) Object.assign(this,{level:saved.level,found:saved.found,misses:saved.misses});
        } catch { /* New crowd. */ }
        this.canvas.addEventListener('click', event => {
            const box = this.canvas.getBoundingClientRect();
            this.choosePoint((event.clientX-box.left)*1200/box.width,(event.clientY-box.top)*780/box.height);
        });
        this.canvas.addEventListener('keydown', event => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            const moves = {ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
            if (Object.hasOwn(moves,event.key)) {
                event.preventDefault();
                this.cursor ||= {x:600,y:390};
                const step = event.shiftKey ? 5 : 28;
                this.cursor.x = Math.max(0,Math.min(1200,this.cursor.x+moves[event.key][0]*step));
                this.cursor.y = Math.max(0,Math.min(780,this.cursor.y+moves[event.key][1]*step));
                const scale = this.canvas.getBoundingClientRect().width/1200;
                this.viewport.scrollTo(this.cursor.x*scale-this.viewport.clientWidth/2,this.cursor.y*scale-this.viewport.clientHeight/2);
                this.draw();
            } else if (event.key==='Enter'||event.code==='Space') { event.preventDefault(); if(this.cursor)this.choosePoint(this.cursor.x,this.cursor.y); }
        });
        this.next.addEventListener('click',()=>{ if(!this.found)return;this.level=this.level===4?0:this.level+1;this.found=false;this.hint=false;this.cursor=null;this.load(); });
        document.getElementById('search-reset').addEventListener('click',()=>{this.level=0;this.found=false;this.misses=0;this.hint=false;this.cursor=null;this.load();});
        document.getElementById('search-hint').addEventListener('click',()=>{
            this.hint=true;
            const [x,y]=this.targets[this.level];
            this.status.textContent=`Your captain is in the ${x<0.5?'left':'right'} half, ${y<0.5?'upper':'lower'} rows. Look for a white headband and jersey 1.`;
            this.draw();
        });
        const zoom=()=>{this.canvas.style.width=`${Math.max(760,this.viewport.clientWidth)*Number(document.getElementById('search-zoom').value)}px`;};
        document.getElementById('search-zoom').addEventListener('change',zoom);window.addEventListener('resize',zoom);zoom();
        this.image=new Image();this.image.onload=()=>this.draw();this.image.src=window.teamArcade.artFor(this.team).src;
        document.querySelector('.search-heading h1').textContent=this.team.games.search.toUpperCase();
        document.querySelector('.search-heading .eyebrow').textContent=`${this.team.nickname} crowd hunt · Five illustrated scenes`;
        document.querySelector('.search-heading > div > p:last-child').textContent='Find the captain: jersey 1, a white headband, and the only raised gold football. Everyone else is a decoy. Use zoom or the keyboard crosshair to search.';
        const ref=document.querySelector('.jalen-reference');
        ref.replaceChildren();const reference=document.createElement('canvas');reference.width=100;reference.height=110;reference.setAttribute('role','img');reference.setAttribute('aria-label','Target captain: white headband, number 1, raised gold football');
        this.fan(reference.getContext('2d'),50,55,1,true,1.4);const clue=document.createElement('span');clue.textContent='WHITE HEADBAND · #1 · GOLD BALL';ref.append(reference,clue);
        const disclosure=document.querySelector('.photo-disclosure');disclosure.textContent='Original illustrated fan crowds. Every team has its own colors, character backdrop, and crowd arrangement.';
        if(this.team.id==='eagles'){
            const original=document.createElement('a');original.href=window.teamArcade.link('jalen.html?photos=1');original.textContent=' Play the original Jalen photo search';disclosure.append(original);
        }
        document.getElementById('search-help').textContent='Tap the captain. Zoom and scroll to inspect. Keyboard: arrows move the crosshair, Shift makes small moves, Enter checks your choice.';
        document.getElementById('search-hint').textContent='Captain clue';
        this.canvas.setAttribute('aria-label',`${this.team.name} illustrated fan crowd. Find the captain with white headband and number 1.`);
        this.load();
    }
    random(seed) { const value=Math.sin(seed*127.1+this.level*311.7+[...this.team.id].reduce((sum,letter)=>sum+letter.charCodeAt(0),0)*71.3)*43758.5453;return value-Math.floor(value); }
    fan(ctx,x,y,index,target=false,scale=1) {
        ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
        const skin=['#d89b73','#804f36','#f0c39c','#ad7352'][index%4];
        ctx.fillStyle=this.team.primary;ctx.strokeStyle='#ffffffaa';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(-28,22);ctx.lineTo(-17,27);ctx.lineTo(-15,45);ctx.lineTo(16,45);ctx.lineTo(18,25);ctx.lineTo(28,20);ctx.lineTo(17,0);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.fillStyle=this.team.ink;ctx.font='bold 20px Arial';ctx.textAlign='center';ctx.fillText(target?'1':String(2+index%97),0,28);
        ctx.fillStyle=skin;ctx.beginPath();ctx.arc(0,-10,15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#242029';ctx.beginPath();ctx.arc(0,-13,15,Math.PI,Math.PI*2);ctx.fill();
        ctx.fillStyle=target?'#ffffff':index%3===0?this.team.secondary:this.team.primary;ctx.fillRect(-15,-17,30,6);
        ctx.fillStyle='#201e26';ctx.fillRect(-6,-9,3,3);ctx.fillRect(4,-9,3,3);ctx.strokeStyle='#4d342b';ctx.beginPath();ctx.arc(0,-3,5,0,Math.PI);ctx.stroke();
        if(target){ctx.strokeStyle=skin;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(19,9);ctx.lineTo(29,-24);ctx.stroke();ctx.fillStyle='#ffcf64';ctx.beginPath();ctx.ellipse(29,-30,8,13,0.6,0,Math.PI*2);ctx.fill();}
        ctx.restore();
    }
    load() {
        document.getElementById('search-level').textContent=`Scene ${this.level+1} / 5`;
        document.getElementById('search-scene').textContent=[`${this.team.city} tailgate`,'Upper-deck home crowd','Halftime fan parade','Under the stadium lights','The loudest home section'][this.level];
        this.status.textContent=this.found?'Captain found! Continue to the next scene.':`Find your ${this.team.nickname} captain. White headband, jersey 1, gold ball. ${this.misses} wrong guesses.`;
        this.next.disabled=!this.found;this.next.textContent=this.level===4?'Play five scenes again':'Next scene';
        this.viewport.scrollTo(0,0);this.save();this.draw();
    }
    save() {
        window.teamArcade.storage.setItem('captainProgress',JSON.stringify({level:this.level,found:this.found,misses:this.misses}));
        if(this.found)window.teamArcade.storage.setItem('jalenCleared',String(Math.max(Number(window.teamArcade.storage.getItem('jalenCleared'))||0,this.level+1)));
        const steps=document.getElementById('photo-progress');steps.replaceChildren();
        for(let i=0;i<5;i++){const step=document.createElement('li');step.textContent=i+1;step.className=i<this.level||(i===this.level&&this.found)?'is-complete':i===this.level?'is-current':'';step.setAttribute('aria-label',`Scene ${i+1}`);steps.append(step);}
        document.dispatchEvent(new Event('arcade:progress'));
    }
    choosePoint(x,y) {
        if(this.found)return;
        const [tx,ty]=this.targets[this.level];
        if(Math.abs(x-tx*1200)<=29&&y>=ty*780-45&&y<=ty*780+46){this.found=true;this.next.disabled=false;this.status.textContent=this.level===4?`All five captains found! ${this.team.motto}`:'Captain found! Next scene is ready.';window.teamArcade.celebrate?.();}
        else{this.misses++;this.status.textContent='That is a decoy. Find the white headband, number 1, and raised gold ball.';}
        this.save();this.draw();
    }
    draw() {
        const ctx=this.ctx;ctx.fillStyle=this.team.primary;ctx.fillRect(0,0,1200,780);
        if(this.image?.complete&&this.image.naturalWidth){const a=window.teamArcade.artFor(this.team);ctx.globalAlpha=0.22;ctx.drawImage(this.image,a.col*this.image.naturalWidth/4,a.row*this.image.naturalHeight/2,this.image.naturalWidth/4,this.image.naturalHeight/2,0,0,1200,780);ctx.globalAlpha=1;}
        const [tx,ty]=this.targets[this.level];
        for(let row=0;row<8;row++){
            ctx.fillStyle='#00000025';ctx.fillRect(0,120+row*82,1200,8);
            for(let col=0;col<18;col++){
                const n=row*18+col;
                const x=30+col*67+this.random(n+1)*20,y=100+row*83+this.random(n+19)*18;
                if(Math.abs(x-tx*1200)<50&&Math.abs(y-ty*780)<85)continue;
                this.fan(ctx,x,y,n,false,0.78+this.random(n+31)*0.2);
            }
        }
        this.fan(ctx,tx*1200,ty*780,1,true,0.9);
        if(this.found){ctx.strokeStyle='#ffdf76';ctx.lineWidth=5;ctx.strokeRect(tx*1200-31,ty*780-47,62,95);}
        if(this.hint&&!this.found){ctx.strokeStyle='#ffdf7680';ctx.lineWidth=4;ctx.strokeRect(tx<0.5?3:603,ty<0.5?3:393,594,384);}
        if(this.cursor&&!this.found){ctx.strokeStyle='white';ctx.lineWidth=3;ctx.beginPath();ctx.arc(this.cursor.x,this.cursor.y,20,0,Math.PI*2);ctx.moveTo(this.cursor.x-28,this.cursor.y);ctx.lineTo(this.cursor.x+28,this.cursor.y);ctx.moveTo(this.cursor.x,this.cursor.y-28);ctx.lineTo(this.cursor.x,this.cursor.y+28);ctx.stroke();}
        ctx.fillStyle='#071c32da';ctx.fillRect(0,0,1200,48);ctx.fillStyle='white';ctx.font='bold 23px Arial';ctx.textAlign='center';ctx.fillText(`${this.team.name.toUpperCase()} · ${this.team.city.toUpperCase()} CROWD ${this.level+1}`,600,32);
    }
}
