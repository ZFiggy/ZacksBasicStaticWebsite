class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreDisplay = document.getElementById('game-score');
        this.statusDisplay = document.getElementById('game-status');
        this.reset();

        document.addEventListener('keydown', (event) => {
            if (event.target.closest('button, a, input, textarea, select')) return;
            this.handleInput(event);
        });
        document.getElementById('restart-game').addEventListener('click', () => this.reset());
        document.querySelectorAll('[data-direction]').forEach((button) => {
            button.addEventListener('pointerdown', (event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                this.stopMoving();
                button.setPointerCapture(event.pointerId);
                this.move(button.dataset.direction);
                this.movementTimer = window.setInterval(() => this.move(button.dataset.direction), 100);
            });
            for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
                button.addEventListener(eventName, () => this.stopMoving());
            }
            button.addEventListener('click', (event) => {
                // Keyboard and assistive clicks have no pointerdown event.
                if (event.detail === 0) this.move(button.dataset.direction);
            });
        });
        window.addEventListener('blur', () => this.stopMoving());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.stopMoving();
        });
        new MutationObserver(() => this.redraw()).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }

    reset() {
        this.stopMoving();
        this.recordedWin = false;
        this.score = 0;
        this.shapes = [
            { x: 270, y: 660, width: 50, height: 50, name: 'Main' },
            { x: 130, y: 220, width: 50, height: 50, name: 'collectable' },
            { x: 420, y: 440, width: 50, height: 50, name: 'collectable' }
        ];
        this.update();
    }

    stopMoving() {
        window.clearInterval(this.movementTimer);
    }

    redraw() {
        const ctx = this.ctx;
        const styles = getComputedStyle(document.documentElement);
        ctx.fillStyle = styles.getPropertyValue('--field').trim();
        ctx.fillRect(0, 0, 600, 800);
        ctx.fillStyle = styles.getPropertyValue('--field-stripe').trim();
        for (let y = 80; y < 720; y += 128) ctx.fillRect(0, y, 600, 64);

        ctx.fillStyle = '#00383f';
        ctx.fillRect(0, 0, 600, 80);
        ctx.fillRect(0, 720, 600, 80);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#eef5f4';
        ctx.font = 'italic 700 32px Arial';
        ctx.fillText('PHILADELPHIA', 300, 42);
        ctx.fillText('GO BIRDS', 300, 760);

        ctx.strokeStyle = '#d8eeee80';
        ctx.lineWidth = 2;
        for (let y = 80; y <= 720; y += 64) {
            ctx.beginPath();
            ctx.moveTo(24, y);
            ctx.lineTo(576, y);
            ctx.stroke();
            if (y > 80 && y < 720) {
                ctx.fillStyle = '#e2f0ecb0';
                ctx.font = '700 24px Arial';
                const yard = Math.min((y - 80) / 64, (720 - y) / 64) * 10;
                ctx.fillText(yard.toString(), 65, y - 18);
                ctx.fillText(yard.toString(), 535, y - 18);
            }
        }
        for (let y = 96; y < 720; y += 16) {
            for (const x of [225, 375]) {
                ctx.fillStyle = '#d8eeee85';
                ctx.fillRect(x, y, 10, 2);
            }
        }
        ctx.strokeStyle = '#f1f6f4';
        ctx.lineWidth = 3;
        ctx.strokeRect(12, 10, 576, 780);

        for (const shape of this.shapes) {
            if (shape.name === 'Main') this.drawJersey(shape);
            else this.drawFootball(shape);
        }
        if (this.shapes.length === 1) {
            ctx.fillStyle = '#002b35e8';
            ctx.fillRect(60, 300, 480, 180);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'italic 800 46px Arial';
            ctx.fillText('FLY EAGLES FLY!', 300, 365);
            ctx.font = '20px Arial';
            ctx.fillText('All footballs collected. Go Birds.', 300, 420);
        }
    }

    drawJersey(shape) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(shape.x, shape.y);
        ctx.shadowColor = '#001c2c80';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#004c54';
        ctx.strokeStyle = '#edf4f3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 2);
        ctx.lineTo(2, 10);
        ctx.lineTo(0, 23);
        ctx.lineTo(10, 25);
        ctx.lineTo(10, 48);
        ctx.lineTo(40, 48);
        ctx.lineTo(40, 25);
        ctx.lineTo(50, 23);
        ctx.lineTo(48, 10);
        ctx.lineTo(38, 2);
        ctx.lineTo(31, 7);
        ctx.lineTo(19, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 26px Arial';
        ctx.fillText('1', 25, 29);
        ctx.restore();
    }

    drawFootball(shape) {
        footballArt.draw(this.ctx, shape.x + 25, shape.y + 25, 52, -Math.PI / 4);
    }

    handleInput(event) {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const keys = { w: 'ArrowUp', a: 'ArrowLeft', s: 'ArrowDown', d: 'ArrowRight' };
        const direction = keys[event.key.toLowerCase()] || event.key;
        if (!['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(direction)) return;
        event.preventDefault();
        this.move(direction);
    }

    move(direction) {
        if (this.shapes.length === 1) return;
        const player = this.shapes[0];
        switch (direction) {
            case 'ArrowUp': player.y -= 20; break;
            case 'ArrowLeft': player.x -= 20; break;
            case 'ArrowDown': player.y += 20; break;
            case 'ArrowRight': player.x += 20; break;
            default: return;
        }
        player.x = Math.max(0, Math.min(player.x, this.canvas.width - player.width));
        player.y = Math.max(0, Math.min(player.y, this.canvas.height - player.height));
        this.update();
    }

    checkCollision(first, second) {
        return first.x < second.x + second.width &&
            first.x + first.width > second.x &&
            first.y < second.y + second.height &&
            first.y + first.height > second.y;
    }

    update() {
        for (let i = this.shapes.length - 1; i >= 1; i--) {
            if (this.checkCollision(this.shapes[0], this.shapes[i])) {
                this.score++;
                this.shapes.splice(i, 1);
            }
        }
        this.scoreDisplay.textContent = this.score.toString();
        this.statusDisplay.textContent = this.score === 2 ? 'All footballs collected. Fly Eagles Fly!' :
            this.score === 1 ? 'One down. One football to go!' : 'Take the field. Two footballs to go.';
        if (this.score === 2 && !this.recordedWin) {
            this.recordedWin = true;
            try {
                const stored = Number(localStorage.getItem('fieldRunWins'));
                const wins = Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
                localStorage.setItem('fieldRunWins', Math.min(wins + 1, Number.MAX_SAFE_INTEGER).toString());
            } catch {
                // Winning still works if browser storage is unavailable.
            }
            document.dispatchEvent(new Event('arcade:progress'));
        }
        this.redraw();
    }
}

document.myGame = new Game();
