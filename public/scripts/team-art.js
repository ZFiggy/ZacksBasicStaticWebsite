(() => {
    const api = window.teamArcade;
    const team = api.team;
    const art = api.artFor(team);
    const image = new Image();
    image.src = art.src;
    const gameImages = new Map();
    for (const id of ['game','kick','pocket','blitz']) {
        const order = team.id === 'eagles' ? ['game','kick','pocket','shove','recall','punt','blitz','signal'] : ['game','bird','search','kick','pocket','shove','recall','punt','blitz','signal'];
        const cover = {src: `assets/game-covers/${team.id}.png`, cols: team.id === 'eagles' ? 4 : 5, rows: 2, index: order.indexOf(id)};
        api.loadGameImage(cover.src).then(image => { gameImages.set(id, image); document.myGame?.redraw(); document.kickGame?.draw(); }).catch(() => {});
    }
    window.teamArt = {
        gameScene(ctx, id, x, y, width, height, alpha = 1) {
            const order = team.id === 'eagles' ? ['game','kick','pocket','shove','recall','punt','blitz','signal'] : ['game','bird','search','kick','pocket','shove','recall','punt','blitz','signal'];
            const cover = {src: `assets/game-covers/${team.id}.png`, cols: team.id === 'eagles' ? 4 : 5, rows: 2, index: order.indexOf(id)};
            const source = gameImages.get(id);
            if (!source) return;
            ctx.save(); ctx.globalAlpha = alpha;
            api.drawGameCover(ctx, source, cover, x, y, width, height, 'cover');
            ctx.restore();
        },
        image,
        mascot(ctx, x, y, size) {
            ctx.save();
            ctx.beginPath(); ctx.arc(x,y,size/2,0,Math.PI*2); ctx.clip();
            ctx.fillStyle=team.primary;ctx.fillRect(x-size/2,y-size/2,size,size);
            if(image.complete&&image.naturalWidth)ctx.drawImage(image,art.col*image.naturalWidth/4,art.row*image.naturalHeight/2,image.naturalWidth/4,image.naturalHeight/2,x-size/2,y-size/2,size,size);
            else {ctx.fillStyle=team.ink;ctx.font=`bold ${size/3}px Arial`;ctx.textAlign='center';ctx.fillText(team.short,x,y+size/8);}
            ctx.restore();
            ctx.save();ctx.strokeStyle=team.secondary;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.stroke();ctx.restore();
        },
        atmosphere(ctx,width,height,phase=0) {
            const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
            const shift=reduced?0:phase;
            ctx.save();ctx.globalAlpha=0.35;ctx.fillStyle=team.secondary;ctx.strokeStyle=team.secondary;
            for(let i=0;i<14;i++){
                const x=(i*79+shift*0.09)%width,y=(i*47+shift*0.12)%(height*0.62);
                ctx.beginPath();
                if(team.effects==='snow'){ctx.arc(x,y,2+i%3,0,Math.PI*2);ctx.fill();}
                else if(team.effects==='bolts'){ctx.moveTo(x,y);ctx.lineTo(x-8,y+14);ctx.lineTo(x+1,y+11);ctx.lineTo(x-5,y+25);ctx.stroke();}
                else if(team.effects==='stars'){for(let a=0;a<10;a++){const radius=a%2?3:7;ctx.lineTo(x+Math.cos(a*Math.PI/5)*radius,y+Math.sin(a*Math.PI/5)*radius);}ctx.closePath();ctx.fill();}
                else if(team.effects==='waves'){ctx.ellipse(x,y,20,4,0,0,Math.PI);ctx.stroke();}
                else if(team.effects==='feathers'){ctx.ellipse(x,y,8,2,-0.6,0,Math.PI*2);ctx.fill();}
                else if(team.effects==='fire'){ctx.moveTo(x,y);ctx.lineTo(x-5,y+15);ctx.lineTo(x+5,y+15);ctx.closePath();ctx.fill();}
                else {ctx.fillRect(x,y,4,8);}
            }
            ctx.restore();
        }
    };
    image.onload=()=>{document.myGame?.redraw();document.kickGame?.draw();document.barkleyGame?.draw();};
})();
