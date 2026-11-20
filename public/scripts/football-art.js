// Match assets/football.svg so canvas games and page illustrations share a style.
const footballArt = {
    outline: new Path2D('M4 38C16 17 36 6 60 6S104 17 116 38C104 59 84 70 60 70S16 59 4 38Z'),
    highlight: new Path2D('M13 35C29 17 44 12 60 12S91 17 107 35'),
    seam: new Path2D('M7 39Q60 62 113 39'),
    laceBed: new Path2D('M38 36H82'),
    laces: new Path2D('M39 35H81M44 29V42M52 28V43M60 28V43M68 28V43M76 29V42'),

    draw(ctx, x, y, width, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(width / 120, width / 120);
        ctx.translate(-60, -38);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const leather = ctx.createLinearGradient(0, 0, 30, 76);
        leather.addColorStop(0, '#cf8a50');
        leather.addColorStop(0.45, '#a65c32');
        leather.addColorStop(1, '#60321f');
        ctx.fillStyle = leather;
        ctx.shadowColor = '#001b2b66';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
        ctx.fill(this.outline);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#45291d';
        ctx.lineWidth = 2;
        ctx.stroke(this.outline);
        ctx.strokeStyle = '#efba7d99';
        ctx.lineWidth = 1.5;
        ctx.stroke(this.highlight);
        ctx.strokeStyle = '#542d1fa6';
        ctx.stroke(this.seam);
        ctx.strokeStyle = '#633722';
        ctx.lineWidth = 6;
        ctx.stroke(this.laceBed);
        ctx.strokeStyle = '#fff2d8';
        ctx.lineWidth = 3;
        ctx.stroke(this.laces);
        ctx.restore();
    }
};
