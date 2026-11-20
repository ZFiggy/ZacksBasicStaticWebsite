class FieldGoalGame {
    constructor() {
        this.canvas = document.getElementById('kickCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.button = document.getElementById('kick-button');
        this.status = document.getElementById('kick-status');
        this.marker = document.getElementById('kick-marker');
        this.frame = null;
        this.best = 0;
        try {
            const stored = Number(localStorage.getItem('fieldGoalBest'));
            if (Number.isInteger(stored) && stored >= 0 && stored <= 15 && stored % 3 === 0) this.best = stored;
        } catch {
            // A new round is still playable when browser storage is blocked.
        }
        this.button.addEventListener('click', () => this.act());
        this.canvas.addEventListener('keydown', (event) => {
            if (event.code !== 'Space') return;
            event.preventDefault();
            if (!event.repeat) this.act();
        });
        document.getElementById('restart-kicks').addEventListener('click', () => this.reset());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'running') {
                cancelAnimationFrame(this.frame);
                this.state = 'ready';
                this.button.textContent = 'Start meter';
                this.status.textContent = 'Meter paused. Start again when you are ready.';
            }
        });
        this.reset();
    }

    reset() {
        cancelAnimationFrame(this.frame);
        this.points = 0;
        this.attempts = 0;
        this.position = 0;
        this.shotProgress = 0;
        this.lastResult = null;
        this.targetX = 300;
        this.state = 'ready';
        this.setWind();
        this.button.disabled = false;
        this.button.textContent = 'Start meter';
        this.status.textContent = 'Press Start to line up your first kick.';
        this.updateDisplay();
        this.draw();
    }

    get zoneWidth() {
        return Math.max(0.065, 0.16 - this.attempts * 0.023);
    }

    setWind() {
        this.wind = (Math.random() * 2 - 1) * (0.09 + this.attempts * 0.018);
        this.zoneCenter = 0.5 - this.wind;
    }

    updateDisplay() {
        document.getElementById('kick-score').textContent = this.points.toString();
        document.getElementById('kick-best').textContent = this.best.toString();
        document.getElementById('kick-attempt').textContent = `KICK ${Math.min(this.attempts + 1, 5)} / 5`;
        document.getElementById('kick-zone').style.width = `${this.zoneWidth * 100}%`;
        document.getElementById('kick-zone').style.left = `${this.zoneCenter * 100}%`;
        document.getElementById('kick-wind').textContent = `${Math.round(Math.abs(this.wind) * 100)} MPH ${this.wind >= 0 ? 'RIGHT' : 'LEFT'} · AIM INTO THE WIND`;
        this.marker.style.left = `${this.position * 100}%`;
    }

    act() {
        if (this.state === 'ready') {
            this.state = 'running';
            this.lastResult = null;
            this.shotProgress = 0;
            this.startedAt = performance.now();
            this.position = 0;
            this.button.textContent = 'Kick!';
            this.status.textContent = 'Time your kick. Stop the marker inside the green zone.';
            this.tick(this.startedAt);
        } else if (this.state === 'running') {
            // Sample the same meter position that is currently shown on screen.
            this.lastResult = Math.abs(this.position - this.zoneCenter) <= this.zoneWidth / 2;
            this.targetX = 300 + (this.position - this.zoneCenter) * (220 / this.zoneWidth);
            this.state = 'flight';
            this.flightStartedAt = performance.now();
            this.button.disabled = true;
            this.button.textContent = 'Ball in the air…';
            this.status.textContent = 'The kick is up…';
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                cancelAnimationFrame(this.frame);
                this.shotProgress = 1;
                this.finishKick();
            }
        }
    }

    tick(now) {
        if (this.state === 'running') {
            const phase = (now - this.startedAt) / (950 - this.attempts * 100) % 2;
            this.position = phase <= 1 ? phase : 2 - phase;
            this.marker.style.left = `${this.position * 100}%`;
            this.draw();
        } else if (this.state === 'flight') {
            this.shotProgress = Math.min(1, (now - this.flightStartedAt) / 950);
            this.draw();
            if (this.shotProgress === 1) {
                this.finishKick();
                return;
            }
        } else {
            return;
        }
        this.frame = requestAnimationFrame((time) => this.tick(time));
    }

    finishKick() {
        if (this.lastResult) this.points += 3;
        if (this.points > this.best) {
            this.best = this.points;
            try {
                localStorage.setItem('fieldGoalBest', this.best.toString());
            } catch {
                // Keep this session's personal best even without storage.
            }
        }
        this.attempts++;
        this.state = this.attempts === 5 ? 'complete' : 'ready';
        const result = this.lastResult ? 'It is good! +3 points.' : 'Wide of the uprights. No points.';
        this.status.textContent = this.state === 'complete' ? `${result} Round complete: ${this.points} of 15 points. Start a new round to play again.` : `${result} Get ready for kick ${this.attempts + 1}.`;
        this.button.disabled = this.state === 'complete';
        this.button.textContent = this.state === 'complete' ? 'Round complete' : 'Start next kick';
        if (this.state !== 'complete') this.setWind();
        this.updateDisplay();
        document.dispatchEvent(new Event('arcade:progress'));
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const sky = ctx.createLinearGradient(0, 0, 0, 380);
        sky.addColorStop(0, '#062735');
        sky.addColorStop(1, '#17646b');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 600, 650);
        ctx.fillStyle = '#8eb6b746';
        for (let row = 0; row < 4; row++) {
            for (let x = 12; x < 600; x += 20) ctx.fillRect(x, 235 + row * 17, 8, 6);
        }
        ctx.fillStyle = '#26735c';
        ctx.beginPath();
        ctx.moveTo(0, 330);
        ctx.lineTo(600, 330);
        ctx.lineTo(600, 650);
        ctx.lineTo(0, 650);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e2efdf80';
        ctx.lineWidth = 2;
        for (const y of [365, 410, 480, 590]) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(240, 330); ctx.lineTo(70, 650);
        ctx.moveTo(360, 330); ctx.lineTo(530, 650);
        ctx.stroke();
        ctx.fillStyle = '#004c54';
        ctx.fillRect(0, 310, 600, 45);
        ctx.fillStyle = '#e6f1ee';
        ctx.textAlign = 'center';
        ctx.font = 'italic 800 25px Arial';
        ctx.fillText('PHILADELPHIA EAGLES', 300, 340);
        ctx.strokeStyle = '#ffda65';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(190, 120); ctx.lineTo(190, 260); ctx.lineTo(410, 260); ctx.lineTo(410, 120);
        ctx.moveTo(300, 260); ctx.lineTo(300, 350);
        ctx.stroke();
        const progress = this.shotProgress;
        const ballX = 300 + ((this.targetX ?? 300) - 300) * progress;
        const ballY = 570 - 365 * progress - 135 * Math.sin(Math.PI * progress);
        ctx.save();
        ctx.translate(ballX, ballY);
        ctx.rotate(-0.6 + progress * 5);
        ctx.fillStyle = '#ab6339';
        ctx.strokeStyle = '#f4dbb5';
        ctx.lineWidth = 2;
        const size = 1 - progress * 0.5;
        ctx.scale(size, size);
        ctx.beginPath(); ctx.ellipse(0, 0, 26, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#fff9eb';
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
        for (let x = -8; x <= 8; x += 8) { ctx.moveTo(x, -5); ctx.lineTo(x, 5); }
        ctx.stroke();
        ctx.restore();
        if (this.lastResult !== null && this.state !== 'flight') {
            ctx.fillStyle = '#002e36e8';
            ctx.fillRect(90, 30, 420, 65);
            ctx.fillStyle = this.lastResult ? '#b7f5cc' : '#ffffff';
            ctx.font = 'italic 800 32px Arial';
            ctx.fillText(this.lastResult ? 'IT’S GOOD! +3' : 'WIDE OF THE POSTS', 300, 73);
        }
    }
}

document.kickGame = new FieldGoalGame();
