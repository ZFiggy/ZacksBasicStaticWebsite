class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreDisplay = document.getElementById('game-score');
        this.statusDisplay = document.getElementById('game-status');
        this.rule = window.teamArcade.ruleFor('game');
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
        this.carrying = false;
        this.steps = 0;
        this.defender = {x: 30, y: 360, width: 50, height: 50};
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

        ctx.fillStyle = window.teamArcade.team.primary;
        ctx.fillRect(0, 0, 600, 80);
        ctx.fillRect(0, 720, 600, 80);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = window.teamArcade.tint('#eef5f4');
        ctx.font = 'italic 700 32px Arial';
        ctx.fillText(window.teamArcade.team.city.toUpperCase(), 300, 42);
        ctx.fillText(this.rule.variant === 'return' ? 'HOME · RETURN THE BALL' : `GO ${window.teamArcade.team.nickname.toUpperCase()}`, 300, 760);

        ctx.strokeStyle = window.teamArcade.tint('#d8eeee80');
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
                ctx.fillStyle = window.teamArcade.tint('#d8eeee85');
                ctx.fillRect(x, y, 10, 2);
            }
        }
        ctx.strokeStyle = '#f1f6f4';
        ctx.lineWidth = 3;
        ctx.strokeRect(12, 10, 576, 780);

        window.teamArt.gameScene(ctx, 'game', 0, 80, 600, 640, 0.38);
        if (this.rule.variant === 'rush' && this.shapes.length > 1) {
            if (!window.teamCharacters.draw(ctx, 'defender', this.defender.x - 20, this.defender.y - 40, 90, 100)) {
            ctx.fillStyle = '#ffad75';
            ctx.fillRect(this.defender.x, this.defender.y, 50, 50);
            ctx.fillStyle = '#121d2c';
            ctx.font = 'bold 26px Arial';
            ctx.fillText('D', this.defender.x + 25, this.defender.y + 25);
            }
        }
        for (const shape of this.shapes) {
            if (shape.name === 'Main') this.drawJersey(shape);
            else this.drawFootball(shape);
        }
        if (this.shapes.length === 1 && !this.carrying) {
            ctx.fillStyle = window.teamArcade.tint('#002b35e8');
            ctx.fillRect(60, 300, 480, 180);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'italic 800 46px Arial';
            ctx.font = 'italic 800 30px Arial';
            ctx.fillText(`${window.teamArcade.team.nickname.toUpperCase()} WIN!`, 300, 365);
            ctx.font = '20px Arial';
            ctx.fillText(`All footballs collected. Go ${window.teamArcade.team.nickname}.`, 300, 420);
        }
    }

    drawJersey(shape) {
        const ctx = this.ctx;
        if (window.teamCharacters.draw(ctx, 'runner', shape.x - 25, shape.y - 50, 100, 112)) return;
        ctx.save();
        ctx.translate(shape.x, shape.y);
        ctx.shadowColor = window.teamArcade.tint('#001c2c80');
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = window.teamArcade.team.primary;
        ctx.strokeStyle = window.teamArcade.tint('#edf4f3');
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
        ctx.fillText(String(window.teamArcade.personality.runner.number), 25, 29);
        ctx.restore();
    }

    drawFootball(shape) {
        footballArt.draw(this.ctx, shape.x + 25, shape.y + 25, 52, -Math.PI / 4);
        if (this.rule.variant === 'gates') {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 22px Arial';
            this.ctx.fillText(shape.x === 130 ? '1' : '2', shape.x + 25, shape.y - 10);
        }
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
        if (this.shapes.length === 1 && !this.carrying) return;
        const player = this.shapes[0];
        const stride = this.rule.variant === 'ice' ? 40 : this.carrying ? 10 : 20;
        this.steps++;
        switch (direction) {
            case 'ArrowUp': player.y -= stride; break;
            case 'ArrowLeft': player.x -= stride; break;
            case 'ArrowDown': player.y += stride; break;
            case 'ArrowRight': player.x += stride; break;
            default: return;
        }
        player.x = Math.max(0, Math.min(player.x, this.canvas.width - player.width));
        player.y = Math.max(0, Math.min(player.y, this.canvas.height - player.height));
        if (this.rule.variant === 'rush') {
            const phase = this.steps % 48;
            this.defender.x = 30 + (phase <= 24 ? phase : 48 - phase) * 20;
            if (this.checkCollision(player, this.defender)) {
                player.x = 270; player.y = 660;
            }
        }
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
            if (this.rule.variant === 'return' && this.carrying) continue;
            if (this.rule.variant === 'gates' && i !== 1) continue;
            if (this.checkCollision(this.shapes[0], this.shapes[i])) {
                if (this.rule.variant === 'return') this.carrying = true;
                else this.score++;
                this.shapes.splice(i, 1);
            }
        }
        if (this.carrying && this.shapes[0].y >= 720) {
            this.carrying = false;
            this.score++;
        }
        this.scoreDisplay.textContent = this.score.toString();
        this.statusDisplay.textContent = this.score === 2 ? `All footballs collected. ${window.teamArcade.team.motto}` :
            this.score === 1 ? 'One down. One football to go!' : `Run with ${window.teamArcade.personality.runner.name}. Two footballs to go.`;
        if (this.carrying) this.statusDisplay.textContent = 'Football secured. Carry it back to the HOME end zone at the bottom.';
        if (this.score === 2 && !this.recordedWin) {
            this.recordedWin = true;
            try {
                const stored = Number(window.teamArcade.storage.getItem('fieldRunWins'));
                const wins = Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
                window.teamArcade.storage.setItem('fieldRunWins', Math.min(wins + 1, Number.MAX_SAFE_INTEGER).toString());
            } catch {
                // Winning still works if browser storage is unavailable.
            }
            document.dispatchEvent(new Event('arcade:progress'));
        }
        this.redraw();
    }
}

document.myGame = new Game();
