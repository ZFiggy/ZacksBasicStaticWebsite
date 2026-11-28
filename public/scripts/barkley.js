class BarkleyBird {
    constructor() {
        this.canvas = document.getElementById('birdCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.status = document.getElementById('bird-status');
        this.button = document.getElementById('bird-flap');
        this.pauseButton = document.getElementById('bird-pause');
        this.pauseButton.addEventListener('click', () => this.togglePause());
        this.best = 0;
        try {
            const stored = Number(window.teamArcade.storage.getItem('barkleyBest'));
            if (Number.isSafeInteger(stored) && stored >= 0 && stored <= 1000000) this.best = stored;
        } catch { /* Local play is still available without storage. */ }
        this.portrait = new Image();
        this.portrait.onload = () => this.draw();
        this.portrait.onerror = () => this.draw();
        this.flightSprite = window.teamArcade.personality.flightSprite;
        this.portrait.src = this.flightSprite.src;
        this.button.addEventListener('click', () => this.flap());
        this.canvas.addEventListener('pointerdown', (event) => { if (event.button === 0) { event.preventDefault(); this.flap(); } });
        document.addEventListener('keydown', (event) => {
            const target = event.target;
            const flightTarget = target === this.canvas || target === this.button || target === document.body || target === document.documentElement;
            if (!flightTarget || event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.code === 'KeyP') {
                event.preventDefault();
                if (!event.repeat) this.togglePause();
                return;
            }
            if (event.code === 'Space' || event.key === 'ArrowUp') {
                event.preventDefault(); if (!event.repeat) this.flap();
            }
        });
        document.getElementById('bird-reset').addEventListener('click', () => this.reset());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing') {
                this.togglePause();
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === 'playing') this.togglePause();
        });
        window.barkleyScores = {
            getCount: () => this.best,
            restoreCount: (value) => {
                if (Number.isSafeInteger(value) && value > this.best && value <= 1000000) {
                    this.best = value; this.saveBest(); this.updateDisplay();
                }
            }
        };
        this.reset();
    }

    saveBest() {
        try { window.teamArcade.storage.setItem('barkleyBest', this.best.toString()); } catch { /* Keep this session's best. */ }
        document.dispatchEvent(new Event('arcade:progress'));
    }

    reset() {
        cancelAnimationFrame(this.frame);
        this.state = 'ready'; this.score = 0; this.y = 310; this.velocity = 0;
        this.pipes = []; this.distance = 0; this.lastTime = null;
        this.button.textContent = 'Flap / Start'; this.button.disabled = false;
        this.pauseButton.disabled = true;
        this.pauseButton.textContent = 'Pause';
        this.status.textContent = 'Tap Flap or press Space to take off.';
        this.updateDisplay(); this.draw();
    }

    flap() {
        if (this.state === 'over') this.reset();
        if (this.state === 'ready' || this.state === 'paused') {
            this.state = 'playing'; this.lastTime = null;
            this.frame = requestAnimationFrame(time => this.tick(time));
        }
        this.velocity = -360;
        // Give the input visible feedback now, rather than waiting for the next animation frame.
        this.y -= 2;
        this.pauseButton.disabled = false;
        this.pauseButton.textContent = 'Pause';
        this.button.textContent = 'Flap';
        this.status.textContent = 'Keep your flying star between the uprights.';
        this.draw();
    }

    togglePause() {
        if (this.state === 'playing') {
            cancelAnimationFrame(this.frame);
            this.state = 'paused';
            this.pauseButton.textContent = 'Resume';
            this.button.textContent = 'Resume / Flap';
            this.status.textContent = 'Flight paused. Use Resume to continue or Flap to launch upward.';
            this.draw();
        } else if (this.state === 'paused') {
            this.state = 'playing';
            this.lastTime = null;
            this.pauseButton.textContent = 'Pause';
            this.button.textContent = 'Flap';
            this.status.textContent = 'Keep your flying star between the uprights.';
            this.frame = requestAnimationFrame(time => this.tick(time));
        }
    }

    spawnPipe() {
        const gap = Math.max(165, 230 - this.score * 3);
        const top = 95 + Math.random() * (410 - gap);
        this.pipes.push({x: 500, top, bottom: top + gap, passed: false});
    }

    tick(time) {
        if (this.state !== 'playing') return;
        const dt = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, 1 / 30);
        this.lastTime = time;
        this.step(dt);
        this.draw();
        if (this.state === 'playing') this.frame = requestAnimationFrame(next => this.tick(next));
    }

    step(dt) {
        if (this.state !== 'playing') return;
        this.velocity += 1100 * dt;
        this.y += this.velocity * dt;
        const speed = Math.min(280, 165 + this.score * 4);
        this.distance += speed * dt;
        if (!this.pipes.length || this.pipes[this.pipes.length - 1].x < 220) this.spawnPipe();
        for (const pipe of this.pipes) {
            pipe.x -= speed * dt;
            if (this.collides(pipe)) { this.end(); return; }
            if (!pipe.passed && pipe.x + 69 < 120 + this.playerShape().left) {
                pipe.passed = true; this.score++;
                if (this.score > this.best) {
                    this.best = this.score; this.saveBest();
                    document.dispatchEvent(new CustomEvent('barkley:change', {detail: {count: this.best}}));
                }
                this.updateDisplay();
            }
        }
        this.pipes = this.pipes.filter(pipe => pipe.x > -80);
        const shape = this.playerShape();
        if (this.y + shape.top <= 0 || this.y + shape.bottom >= 628) this.end();
    }

    drawPlayer(ctx) {
        ctx.rotate(Math.max(-0.3, Math.min(0.5, this.velocity / 1000)));
        if (this.portrait.complete && this.portrait.naturalWidth) {
            window.teamArcade.drawGameCover(ctx, this.portrait, this.flightSprite, -42, -42, 84, 84, 'contain');
        } else {
            window.teamArt.mascot(ctx, 0, 0, 36);
        }
    }

    playerShape() {
        const angle = Math.max(-0.3, Math.min(0.5, this.velocity / 1000));
        const loaded = !!(this.portrait.complete && this.portrait.naturalWidth);
        if (this.cachedShape?.angle === angle && this.cachedShape.loaded === loaded) return this.cachedShape;
        if (!this.collisionCanvas) {
            this.collisionCanvas = document.createElement('canvas');
            this.collisionCanvas.width = this.collisionCanvas.height = 120;
            this.collisionContext = this.collisionCanvas.getContext('2d', {willReadFrequently: true});
        }
        const ctx = this.collisionContext;
        ctx.clearRect(0, 0, 120, 120);
        ctx.save();
        ctx.translate(60, 60);
        this.drawPlayer(ctx);
        ctx.restore();
        const pixels = ctx.getImageData(0, 0, 120, 120).data;
        const shape = {angle, loaded, runs: [], left: 60, top: 60, bottom: -60};
        // Keep opaque pixel runs, excluding transparent space around and within the sprite.
        for (let y = 0; y < 120; y++) {
            let start = -1;
            for (let x = 0; x <= 120; x++) {
                const solid = x < 120 && pixels[(y * 120 + x) * 4 + 3] >= 32;
                if (solid && start < 0) start = x;
                if (!solid && start >= 0) {
                    shape.runs.push({left: start - 60, right: x - 60, top: y - 60, bottom: y - 59});
                    shape.left = Math.min(shape.left, start - 60);
                    shape.top = Math.min(shape.top, y - 60);
                    shape.bottom = Math.max(shape.bottom, y - 59);
                    start = -1;
                }
            }
        }
        this.cachedShape = shape;
        return shape;
    }

    collides(pipe) {
        const rectangles = [
            [pipe.x, 0, pipe.x + 66, pipe.top],
            [pipe.x, pipe.bottom, pipe.x + 66, 628],
            [pipe.x - 3, pipe.top - 10, pipe.x + 69, pipe.top],
            [pipe.x - 3, pipe.bottom, pipe.x + 69, pipe.bottom + 10]
        ];
        return this.playerShape().runs.some(run => rectangles.some(([left, top, right, bottom]) =>
            120 + run.right >= left && 120 + run.left <= right
            && this.y + run.bottom >= top && this.y + run.top <= bottom));
    }

    end() {
        this.state = 'over'; cancelAnimationFrame(this.frame);
        this.button.textContent = 'Play again';
        this.pauseButton.disabled = true;
        this.status.textContent = `Flight over: ${this.score} ${this.score === 1 ? 'point' : 'points'}. Best: ${this.best}. Try again!`;
        document.dispatchEvent(new CustomEvent('barkley:change', {detail: {count: this.best}}));
    }

    updateDisplay() {
        document.getElementById('bird-score').textContent = this.score.toString();
        document.getElementById('bird-best').textContent = this.best.toString();
    }

    draw() {
        const ctx = this.ctx;
        const sky = ctx.createLinearGradient(0, 0, 0, 680);
        sky.addColorStop(0, '#071e34');
        sky.addColorStop(0.55, window.teamArcade.team.primary);
        sky.addColorStop(1, window.teamArcade.team.secondary);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 480, 680);
        const glow = ctx.createRadialGradient(365, 240, 10, 365, 240, 260);
        glow.addColorStop(0, '#f3deb94a');
        glow.addColorStop(1, '#e4deba00');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 480, 680);
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const drift = reduced ? 0 : this.distance;
        // Soft cloud banks, skyline and the stadium move at different depths.
        ctx.fillStyle = window.teamArcade.tint('#d9e8e516');
        for (let i = 0; i < 5; i++) {
            const x = ((i * 145 - drift * 0.06) % 800 + 800) % 800 - 160;
            const y = 155 + i % 3 * 58;
            ctx.beginPath();
            ctx.ellipse(x, y, 78, 11, 0, 0, Math.PI * 2);
            ctx.ellipse(x + 24, y - 6, 40, 15, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = window.teamArcade.tint('#163e51');
        // Wrap the whole repeating skyline, so each building keeps its height
        // until it leaves the screen. Include the partially visible edge buildings.
        const skylineHeights = [55, 90, 65, 110, 75, 140];
        const skylinePeriod = skylineHeights.length * 48;
        const skylineOffset = drift * 0.11 % skylinePeriod;
        for (let i = 0; i < Math.ceil((480 + skylinePeriod) / 48); i++) {
            const x = i * 48 - skylineOffset;
            const height = skylineHeights[i % skylineHeights.length];
            ctx.fillRect(x, 440 - height, 35, height);
            if (i % 3 === 0) {
                ctx.beginPath(); ctx.moveTo(x, 440 - height); ctx.lineTo(x + 17, 420 - height); ctx.lineTo(x + 35, 440 - height); ctx.fill();
            }
        }
        // Stadium bowl, light towers and illuminated fascia.
        ctx.fillStyle = window.teamArcade.tint('#10323e');
        ctx.beginPath(); ctx.moveTo(0, 410); ctx.quadraticCurveTo(240, 485, 480, 410); ctx.lineTo(480, 628); ctx.lineTo(0, 628); ctx.closePath(); ctx.fill();
        for (const x of [30, 435]) {
            ctx.fillStyle = window.teamArcade.tint('#1b4e5c'); ctx.fillRect(x + 6, 220, 5, 215);
            ctx.fillStyle = '#e4e7cf'; ctx.fillRect(x - 9, 218, 40, 8);
            ctx.fillStyle = '#f4edbd80'; ctx.fillRect(x - 11, 216, 44, 3);
        }
        for (let row = 0; row < 7; row++) {
            const y = 466 + row * 21;
            ctx.fillStyle = row % 2 ? window.teamArcade.tint('#1a4853') : window.teamArcade.tint('#214f58');
            ctx.fillRect(0, y, 480, 17);
            for (let x = 0; x < 480; x += 12) {
                ctx.fillStyle = (x / 12 + row) % 5 === 0 ? '#d4d7b9a0' : window.teamArcade.tint('#62a19c80');
                ctx.fillRect(x + 2, y + 5, 4, 4);
            }
        }
        ctx.fillStyle = window.teamArcade.tint('#04252e'); ctx.fillRect(0, 444, 480, 19);
        ctx.fillStyle = window.teamArcade.tint('#9cd5c9'); ctx.textAlign = 'center'; ctx.font = '700 10px Arial';
        ctx.fillText(`${window.teamArcade.team.city.toUpperCase()} · ${window.teamArcade.team.motto.toUpperCase()}`, 240, 457);
        window.teamArt.atmosphere(ctx, 480, 430, this.distance);
        const visiblePipes = this.state === 'ready' ? [{x: 375, top: 185, bottom: 440}] : this.pipes;
        for (const pipe of visiblePipes) {
            const pad = ctx.createLinearGradient(pipe.x, 0, pipe.x + 66, 0);
            pad.addColorStop(0, window.teamArcade.team.primary); pad.addColorStop(0.45, window.teamArcade.team.secondary); pad.addColorStop(1, window.teamArcade.team.primary);
            ctx.fillStyle = pad;
            ctx.fillRect(pipe.x, 0, 66, pipe.top);
            ctx.fillRect(pipe.x, pipe.bottom, 66, 628 - pipe.bottom);
            ctx.strokeStyle = window.teamArcade.tint('#7eaba770'); ctx.lineWidth = 1;
            ctx.strokeRect(pipe.x + 5, -1, 56, pipe.top - 5);
            ctx.strokeRect(pipe.x + 5, pipe.bottom + 5, 56, 628 - pipe.bottom);
            ctx.fillStyle = window.teamArcade.tint('#bfd3ce');
            ctx.fillRect(pipe.x - 3, pipe.top - 10, 72, 10);
            ctx.fillRect(pipe.x - 3, pipe.bottom, 72, 10);
            ctx.fillStyle = '#e4f2e9';
            ctx.fillRect(pipe.x - 3, pipe.top - 10, 72, 3);
            ctx.fillRect(pipe.x - 3, pipe.bottom, 72, 3);
            ctx.fillStyle = '#dce9df80'; ctx.font = 'italic 800 18px Arial';
            if (pipe.top > 65) ctx.fillText(window.teamArcade.team.short, pipe.x + 33, pipe.top - 30);
        }
        // Turf and sideline.
        ctx.fillStyle = '#125c49'; ctx.fillRect(0, 628, 480, 52);
        ctx.fillStyle = '#dbe6d5'; ctx.fillRect(0, 628, 480, 4);
        ctx.fillStyle = '#2b7c60';
        for (let x = 0; x < 520; x += 36) ctx.fillRect(x - drift % 36, 637, 18, 3);
        ctx.fillStyle = '#c6e4d9'; ctx.font = 'italic 800 17px Arial'; ctx.fillText(`${window.teamArcade.personality.flierTitle.toUpperCase()}`, 240, 666, 440);
        if (this.state === 'playing' && !reduced) {
            for (let i = 1; i <= 4; i++) {
                ctx.fillStyle = window.teamArcade.team.secondary + Math.round((0.27 - i * 0.05) * 255).toString(16).padStart(2, '0');
                ctx.beginPath(); ctx.arc(120 - i * 15, this.y + 8 + i * 2, 4 - i * 0.5, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.save();
        ctx.translate(120, this.y);
        this.drawPlayer(ctx);
        ctx.restore();
        // Always-visible broadcast score, clear of the playable character.
        ctx.fillStyle = window.teamArcade.tint('#06252bbf');
        ctx.beginPath(); ctx.roundRect(171, 24, 138, 75, 12); ctx.fill();
        ctx.fillStyle = window.teamArcade.tint('#b8d8d2'); ctx.font = '700 10px Arial'; ctx.fillText('GAPS CLEARED', 240, 43);
        ctx.fillStyle = '#ffffff'; ctx.font = '800 36px Arial'; ctx.fillText(this.score.toString(), 240, 83);
        if (this.state !== 'playing') {
            ctx.fillStyle = window.teamArcade.tint('#072934ed'); ctx.strokeStyle = window.teamArcade.tint('#8dbab580'); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(40, 140, 400, 132, 14); ctx.fill(); ctx.stroke();
            ctx.fillStyle = window.teamArcade.tint('#9cd8c9'); ctx.font = '700 11px Arial'; ctx.fillText(`${window.teamArcade.personality.runner.name.toUpperCase()} · #${window.teamArcade.personality.runner.number}`, 240, 175);
            ctx.fillStyle = '#ffffff'; ctx.font = 'italic 800 32px Arial';
            ctx.fillText(this.state === 'over' ? 'FLIGHT OVER' : this.state === 'paused' ? 'TAKE A BREATHER' : window.teamArcade.team.games.bird.toUpperCase(), 240, 217, 360);
            ctx.fillStyle = window.teamArcade.tint('#c8e1dc'); ctx.font = '15px Arial';
            ctx.fillText(this.state === 'over' ? `${this.score} POINTS · BEST ${this.best} · TAP TO RETRY` : 'TAP OR PRESS SPACE TO TAKE FLIGHT', 240, 252);
        }
    }
}

document.barkleyGame = new BarkleyBird();
