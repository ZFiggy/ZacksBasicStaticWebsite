class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.rules = window.TouchdownRules;
        this.api = window.teamArcade;
        this.rival = this.api.teams.find(t => t.id === this.api.rivalFor());
        window.playerMotion.preload(window.teamArcade.team.id).catch(() => {});
        window.playerMotion.preload(this.rival.id).catch(() => {});
        this.keys = {ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]};
        this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.best = window.fanArcade.number('touchdownRushBest');
        let saved;
        try { saved = JSON.parse(this.api.storage.getItem('touchdownRushProgress')); } catch { /* Start a new run. */ }
        this.level = saved?.version === 1 && Number.isSafeInteger(saved.level) && saved.level > 0 && saved.level <= 1000000 ? saved.level : 1;
        this.seed = saved?.version === 1 && Number.isInteger(saved.seed) ? saved.seed >>> 0 : this.newSeed();
        document.querySelector('.game-intro > p:last-child').textContent = 'Find the football. Read the rush. Take it all the way.';
        document.getElementById('rush-matchup').textContent = `${this.api.team.short} vs ${this.rival.short}`;
        document.getElementById('rush-runner').textContent = `${this.api.personality.runner.name} · #${this.api.personality.runner.number}`;
        document.getElementById('rush-rival').textContent = `${this.rival.nickname} defense`;
        this.canvas.setAttribute('aria-label', `${this.api.personality.runner.name} against the ${this.rival.nickname}. Horizontal football field. Collect the ball, then reach the right end zone.`);
        document.getElementById('restart-game').addEventListener('click', () => this.load());
        document.getElementById('rush-action').addEventListener('click', () => this.action());
        document.getElementById('rush-wait').addEventListener('click', () => this.move(0, 0));
        document.getElementById('rush-hint').addEventListener('click', () => this.hint());
        document.getElementById('rush-view').addEventListener('click', () => {
            document.querySelector('.rush-field-wrap').classList.toggle('is-overview');
            this.updateViewLabel();
            this.focusRunner();
        });
        document.addEventListener('keydown', event => {
            if (document.querySelector('.game-demo[open]') || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, select, textarea, a, dialog')) return;
            const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
            if (event.target.closest('button') && !this.keys[key]) return;
            if (key === 'p') { event.preventDefault(); if (!event.repeat) this.pause(); return; }
            if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) this.move(0, 0); return; }
            if (!this.keys[key]) return;
            event.preventDefault();
            if (event.repeat) return;
            this.stopMoving();
            this.move(...this.keys[key]);
            if (this.phase !== 'playing') return;
            this.heldKey = key;
            this.movementTimer = setInterval(() => this.move(...this.keys[key]), 180);
        });
        document.addEventListener('keyup', event => {
            if (event.key === this.heldKey || event.key.toLowerCase() === this.heldKey) this.stopMoving();
        });
        document.querySelectorAll('[data-direction]').forEach(button => {
            button.addEventListener('pointerdown', event => {
                if (event.button !== 0) return;
                event.preventDefault();
                this.stopMoving();
                button.setPointerCapture(event.pointerId);
                this.move(...this.keys[button.dataset.direction]);
                if (this.phase !== 'playing') return;
                this.movementTimer = setInterval(() => this.move(...this.keys[button.dataset.direction]), 180);
            });
            for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => this.stopMoving());
            button.addEventListener('click', event => { if (!event.detail) this.move(...this.keys[button.dataset.direction]); });
        });
        window.addEventListener('blur', () => this.pause(true));
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(true); });
        window.addEventListener('pagehide', () => { this.stopMoving(); cancelAnimationFrame(this.frame); });
        new MutationObserver(() => this.redraw()).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
        const status = document.getElementById('game-status');
        document.querySelector('.rush-view-frame').before(status);
        this.load();
    }

    newSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
    stopMoving() { clearInterval(this.movementTimer); this.heldKey = null; }
    saveProgress() {
        this.api.storage.setItem('touchdownRushProgress', JSON.stringify({version: 1, level: this.level, seed: this.seed}));
    }
    load() {
        this.stopMoving();
        cancelAnimationFrame(this.frame);
        this.field = this.rules.generate(this.level, this.seed);
        this.player = this.rules.initial(this.field);
        this.turnover = null;
        this.hints = 0;
        this.result = null;
        this.previous = null;
        this.phase = 'ready';
        this.hintCell = null;
        this.saveProgress();
        this.message('Move first; then chasers move. Sharing a tile means a tackle. Check the next-move labels before running.');
        this.focusRunner();
        this.updateViewLabel();
        this.update();
        this.focusRunner();
    }
    message(text) { document.getElementById('game-status').textContent = text; }
    action() {
        if (this.phase === 'turnover') { this.finishTurnover(); return; }
        if (this.phase === 'won') {
            this.level = Math.min(1000000, this.level + 1);
            this.seed = this.newSeed();
            this.load();
        } else if (this.phase === 'lost') this.load();
        else if (this.phase === 'ready' || this.phase === 'paused') {
            this.phase = 'playing';
            this.message('✓ means safe for this turn. × means tackled. Adjacent defenders cannot steal the ball.');
            this.focusRunner();
            this.update();
            this.canvas.focus({preventScroll: true});
        } else this.pause();
    }
    pause(onlyPause = false) {
        this.stopMoving();
        if (this.phase === 'playing') {
            this.phase = 'paused';
            this.message('Paused. Your next step can wait.');
            this.update();
        } else if (!onlyPause && this.phase === 'paused') this.action();
    }
    move(dx, dy) {
        if (this.phase !== 'playing') return;
        const next = this.rules.step(this.field, this.player, dx, dy);
        if (!next) { this.message('Blocked. Find another gap; that move did not use a step.'); return; }
        const wasCarrying = this.player.carrying;
        this.previous = this.player;
        this.previousTime = performance.now();
        this.hintCell = null;
        if (next.caught) {
            this.player = next;
            this.lose(next.tackleReason === 'contact' ? 'You stepped onto a chaser’s tile.' : next.turn % this.field.burstEvery === 0 ? 'A chaser reached your tile on a two-move burst.' : 'A chaser reached your tile after your move.');
        } else {
            this.player = next;
            if (next.x === this.rules.cols - 1 && next.carrying) this.win();
            else if (next.turn >= this.field.budget) {
                this.lose('Out of steps: the drive ended and possession changes.', true);
            } else if (!wasCarrying && next.carrying) this.message('Football secured! Carry it into the right end zone.');
            else if (this.rules.protectedAt(this.field, next)) this.message('SHIELDED: chasers cannot enter this outlined green tile. Diagonal tiles have no protection.');
            else this.message(next.carrying ? 'Ball in hand. Find the gap to the right end zone.' : 'Collect the glowing football before scoring.');
        }
        if (this.phase !== 'playing') this.stopMoving();
        this.update();
        this.focusRunner();
        this.animate();
    }
    win() {
        this.phase = 'won';
        this.celebrationAt = performance.now();
        this.result = this.rules.rating(this.field, this.player.turn, this.hints);
        this.api.storage.setItem('touchdownRushPointsBest', Math.max(window.fanArcade.number('touchdownRushPointsBest'), this.result.points));
        this.best = Math.max(this.best, this.level);
        this.api.storage.setItem('touchdownRushBest', this.best);
        this.api.storage.setItem('fieldRunWins', Math.min(1000000, window.fanArcade.number('fieldRunWins') + 1));
        // Save the next round immediately so a reload never awards the same TD twice.
        this.api.storage.setItem('touchdownRushProgress', JSON.stringify({version: 1, level: Math.min(1000000, this.level + 1), seed: this.newSeed()}));
        this.message(`Touchdown, ${this.api.team.nickname}! Level ${this.level}: ${this.player.turn} steps / ${this.field.par} par · ${this.result.stars} stars · ${this.result.points} points.`);
        document.dispatchEvent(new Event('arcade:progress'));
    }
    hint() {
        if (this.phase !== 'playing') return;
        const route = this.rules.solve(this.field, this.player, 16000, this.field.budget);
        if (!route || route.length > this.field.budget - this.player.turn) {
            this.message('Coach couldn’t find a route within your remaining steps. Retry this field for a fresh approach.');
            return;
        }
        this.hints++;
        this.update();
        const [dx, dy] = route[0];
        this.hintCell = {x: this.player.x + dx, y: this.player.y + dy};
        this.message(dx === 0 && dy === 0 ? 'Coach: wait one step to let the rush pass.' : `Coach: move ${dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up'} toward the highlighted tile.`);
        this.redraw();
    }
    update() {
        document.getElementById('game-score').textContent = this.level;
        document.getElementById('rush-steps').textContent = this.field.budget - this.player.turn;
        document.getElementById('rush-best').textContent = window.fanArcade.number('touchdownRushPointsBest');
        document.getElementById('rush-bonus').textContent = Math.max(0, (this.field.budget - this.player.turn) * 100 - this.hints * 250);
        document.getElementById('rush-efficiency').textContent = `★★★ ${this.field.par} steps · ★★ ≤${this.field.par + 2} steps · −100 pts / step · Hint: −250 pts, 1★ cap`;
        document.getElementById('rush-burst').textContent = `CHASE BURST IN ${this.field.burstEvery - this.player.turn % this.field.burstEvery} STEPS`;
        document.getElementById('rush-possession').textContent = this.turnover?.captured ? `${this.rival.short} BALL` : this.player.carrying ? 'BALL SECURED' : 'FIND THE BALL';
        document.getElementById('rush-action').textContent = {ready: 'Start level', playing: 'Pause', paused: 'Resume', won: 'Next level', lost: 'Retry level', turnover: 'Skip return'}[this.phase];
        for (const id of ['rush-wait', 'rush-hint']) document.getElementById(id).disabled = this.phase !== 'playing';
        document.querySelectorAll('[data-direction]').forEach(button => { button.disabled = this.phase !== 'playing'; });
        document.getElementById('rush-overlay').hidden = ['playing', 'turnover'].includes(this.phase);
        document.getElementById('rush-overlay-title').textContent = {ready: `LEVEL ${this.level}`, paused: 'PAUSED', won: 'TOUCHDOWN!', lost: `${this.rival.short} TOUCHDOWN!`}[this.phase] || '';
        document.getElementById('rush-overlay-copy').textContent = {ready: `${this.field.rushers.length} rushers · ${this.field.walls.length} blockers · ${this.field.budget} steps`, paused: 'Resume when you’re ready.', won: `${'★'.repeat(this.result?.stars || 0)}${'☆'.repeat(3 - (this.result?.stars || 0))} · ${this.result?.points || 0} POINTS`, lost: 'Same field. A new approach.'}[this.phase] || '';
        this.updateForecast();
        this.redraw();
    }
    updateForecast() {
        this.forecast = this.rules.preview(this.field, this.player);
        const labels = {blocked: 'Blocked', tackle: 'TACKLE', expired: 'NO STEPS', touchdown: 'SCORE', protected: 'SHIELDED', safe: 'SAFE'};
        for (const button of document.querySelectorAll('[data-direction], #rush-wait')) {
            const [dx, dy] = this.keys[button.dataset.direction] || [0, 0];
            const prediction = this.forecast.find(p => p.dx === dx && p.dy === dy);
            let label = button.querySelector('.rush-move-outcome');
            if (!label) {
                label = document.createElement('small');
                label.className = 'rush-move-outcome';
                button.append(label);
            }
            button.dataset.outcome = prediction.outcome;
            label.textContent = labels[prediction.outcome];
            const direction = {ArrowLeft: 'Move left', ArrowRight: 'Move right', ArrowUp: 'Move up', ArrowDown: 'Move down'}[button.dataset.direction] || 'Wait one turn';
            button.setAttribute('aria-label', `${direction}: ${labels[prediction.outcome]} this turn`);
        }
        const burst = (this.player.turn + 1) % this.field.burstEvery === 0;
        const panel = document.getElementById('rush-contact-rule');
        panel.dataset.burst = burst;
        panel.textContent = this.phase === 'turnover' || this.phase === 'lost' ? this.turnover?.expired ? 'DRIVE ENDED · The step limit changed possession; this was not a tackle.' : 'TACKLED · The chaser and runner occupied the same tile.' : `${burst ? 'BURST NOW: chasers move 2 tiles' : 'NEXT TURN: chasers move 1 tile'} · You move first. Same tile = tackle · Green tiles = protected`;
    }
    updateViewLabel() {
        document.getElementById('rush-view').textContent = document.querySelector('.rush-field-wrap').classList.contains('is-overview') ? 'Close view' : 'Full field';
    }
    focusRunner(p = this.player) {
        const wrap = document.querySelector('.rush-field-wrap');
        if (!wrap || wrap.scrollWidth <= wrap.clientWidth) return;
        const scale = this.canvas.clientWidth / 1064;
        wrap.scrollLeft = this.point(p).x * scale - wrap.clientWidth * 0.4;
    }
    lose(reason, expired = false) {
        this.phase = 'turnover';
        const defenders = this.player.defenders;
        const pickup = this.player.carrying ? this.player : this.field.ball;
        const approaches = defenders.map(r => this.rules.returnRoute(this.field, r, pickup));
        const captor = this.player.captor >= 0 ? this.player.captor : approaches.reduce((best, route, i) => this.rules.same(route.at(-1), pickup) && route.length < approaches[best].length ? i : best, 0);
        this.turnover = {
            start: performance.now(), captor, pickup, expired,
            approach: approaches[captor],
            route: this.rules.returnRoute(this.field, pickup),
            position: {...defenders[captor]}, captured: false, scored: false
        };
        this.message(`${reason} ${this.rival.nickname} ${expired ? 'take possession for the return' : this.player.carrying ? 'strip the ball on contact' : 'recover the football after the tackle'}.`);
    }
    finishTurnover() {
        if (this.turnover) {
            this.turnover.position = this.turnover.route.at(-1);
            this.turnover.captured = true;
            this.turnover.scored = true;
        }
        this.phase = 'lost';
        this.stopMoving();
        cancelAnimationFrame(this.frame);
        this.message(`${this.rival.nickname} score at the other end. Retry this field: use your blockers and take a tighter route.`);
        this.update();
    }
    animate() {
        cancelAnimationFrame(this.frame);
        const followPath = (path, t) => {
            const progress = Math.min(1, t) * (path.length - 1);
            const i = Math.min(path.length - 1, Math.floor(progress));
            const a = path[i], b = path[Math.min(i + 1, path.length - 1)], f = progress - i;
            return {x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f};
        };
        const tick = () => {
            if (this.phase === 'turnover') {
                const elapsed = performance.now() - this.turnover.start;
                const pickupTime = this.reducedMotion ? 120 : 500;
                const runTime = this.reducedMotion ? 200 : Math.max(1800, this.turnover.route.length * 100);
                this.turnover.captured = elapsed >= pickupTime;
                if (this.turnover.captured) document.getElementById('rush-possession').textContent = `${this.rival.short} BALL`;
                if (this.reducedMotion) this.turnover.position = elapsed < pickupTime ? this.turnover.pickup : this.turnover.route.at(-1);
                else this.turnover.position = elapsed < pickupTime ? followPath(this.turnover.approach, elapsed / pickupTime) : followPath(this.turnover.route, (elapsed - pickupTime) / runTime);
                this.focusRunner(this.turnover.position);
                if (elapsed >= pickupTime + runTime + 350) { this.finishTurnover(); return; }
                this.redraw();
                this.frame = requestAnimationFrame(tick);
            } else {
                this.redraw();
                if (!this.reducedMotion && (performance.now() - this.previousTime < 180 || this.phase === 'won' && performance.now() - this.celebrationAt < 1400)) this.frame = requestAnimationFrame(tick);
            }
        };
        tick();
    }
    point(p) { return {x: 38 + (p.x + 0.5) * 52, y: 42 + (p.y + 0.5) * 52}; }
    tile(p, color, inset = 4) {
        const c = this.point(p);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.roundRect(c.x - 26 + inset, c.y - 26 + inset, 52 - inset * 2, 52 - inset * 2, 7);
        this.ctx.fill();
    }
    drawPlayer(p, team, role, kind, flip = false) {
        const ctx = this.ctx;
        const c = this.point(p);
        ctx.fillStyle = '#001c2380';
        ctx.beginPath(); ctx.ellipse(c.x, c.y + 18, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
        if (kind === 'ally') this.tile(p, '#85efb54a', 7);
        const moving = this.phase === 'turnover' || this.previous && performance.now() - this.previousTime < 150;
        const spriteRole = kind === 'ally' || kind === 'wall' ? 'lineman' : kind === 'rusher' ? 'rusher' : role;
        const action = kind === 'ally' || kind === 'wall' ? 'block' : moving ? 'run' : 'idle';
        if (!window.playerMotion.draw(ctx, spriteRole, c.x - 24, c.y - 30, 48, 54, {teamId: team.id, action, time: this.reducedMotion ? 0 : performance.now() / 1000, variant: Math.round(p.y), flip})) {
            ctx.fillStyle = team.primary; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(c.x, c.y, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        if (kind !== 'runner') {
            const marker = kind === 'ally' ? '+' : kind === 'wall' ? '■' : '!';
            ctx.fillStyle = kind === 'ally' ? '#123d32' : kind === 'wall' ? '#17252f' : '#7f2832';
            ctx.fillRect(c.x + 11, c.y - 25, 14, 16);
            ctx.fillStyle = kind === 'ally' ? '#a7ffd2' : '#fff';
            ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
            ctx.fillText(marker, c.x + 18, c.y - 12);
        }
        ctx.fillStyle = kind === 'ally' ? '#a7ffd2' : kind === 'runner' ? '#fff' : '#ffbb9c';
        ctx.beginPath(); ctx.arc(c.x, c.y + 22, kind === 'runner' ? 4 : 3, 0, Math.PI * 2); ctx.fill();
    }
    redraw() {
        if (!this.field) return;
        const ctx = this.ctx;
        const {cols, rows} = this.rules;
        ctx.clearRect(0, 0, 1064, 552);
        ctx.fillStyle = '#102c31'; ctx.fillRect(0, 0, 1064, 552);
        ctx.fillStyle = '#e5efeb'; ctx.font = '700 13px Arial'; ctx.textAlign = 'left';
        ctx.fillText(`${this.api.team.city.toUpperCase()} · HOME FIELD`, 40, 26);
        ctx.textAlign = 'right'; ctx.fillStyle = '#a9c7bd'; ctx.fillText('COLLECT · DODGE · SCORE', 1024, 26);
        for (let x = 0; x < cols; x++) {
            ctx.fillStyle = x === 0 ? this.rival.primary : x === cols - 1 ? this.api.team.primary : x % 2 ? '#267c56' : '#23724f';
            ctx.fillRect(38 + x * 52, 42, 52, rows * 52);
        }
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
            const p = {x, y};
            if (!this.rules.protectedAt(this.field, p) || !this.rules.walkable(this.field, p)) continue;
            this.tile(p, '#a7ffd23d', 2);
            const c = this.point(p);
            ctx.strokeStyle = '#a7ffd2'; ctx.lineWidth = 2;
            ctx.strokeRect(c.x - 23, c.y - 23, 46, 46);
            ctx.fillStyle = '#c7ffdc'; ctx.textAlign = 'left'; ctx.font = 'bold 13px Arial';
            ctx.fillText('+', c.x - 20, c.y - 9);
        }
        ctx.lineWidth = 1;
        for (let x = 1; x < cols; x++) {
            ctx.strokeStyle = x % 2 ? '#eafff340' : '#eafff380';
            ctx.beginPath(); ctx.moveTo(38 + x * 52, 42); ctx.lineTo(38 + x * 52, 510); ctx.stroke();
        }
        for (let y = 1; y < rows; y++) {
            ctx.strokeStyle = '#ffffff14';
            ctx.beginPath(); ctx.moveTo(38, 42 + y * 52); ctx.lineTo(1026, 42 + y * 52); ctx.stroke();
        }
        for (let x = 2; x < cols - 1; x += 2) {
            const yard = Math.min(x, 18 - x) * 5;
            ctx.fillStyle = '#eafff36b'; ctx.font = '700 18px Arial'; ctx.textAlign = 'center';
            ctx.fillText(String(yard), 38 + x * 52, 67);
            ctx.fillText(String(yard), 38 + x * 52, 496);
        }
        ctx.save(); ctx.translate(1010, 276); ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#ffffffbb'; ctx.font = 'italic 900 21px Arial'; ctx.fillText('TOUCHDOWN', 0, 0); ctx.restore();
        if (['playing', 'ready', 'paused'].includes(this.phase)) {
            for (const p of this.forecast || []) {
                if (p.outcome === 'blocked' || p.dx === 0 && p.dy === 0) continue;
                const c = this.point(p);
                const danger = ['tackle', 'expired'].includes(p.outcome);
                this.tile(p, danger ? '#d932446e' : '#a7ffd232', 3);
                ctx.strokeStyle = danger ? '#ffb2b9' : '#cbffdc'; ctx.lineWidth = 2;
                ctx.strokeRect(c.x - 22, c.y - 22, 44, 44);
                ctx.fillStyle = danger ? '#fff0f2' : '#e0ffe9'; ctx.font = 'bold 19px Arial'; ctx.textAlign = 'right';
                ctx.fillText(danger ? '×' : p.outcome === 'touchdown' ? 'TD' : '✓', c.x + 19, c.y - 5);
            }
        }
        if (this.hintCell) { this.tile(this.hintCell, '#ffe07a99'); }
        for (const p of this.field.walls) {
            this.tile(p, '#172e35b0', 5);
            this.drawPlayer(p, this.rival, 'defender', 'wall');
        }
        for (const p of this.field.allies) this.drawPlayer(p, this.api.team, 'defender', 'ally');
        const current = this.player.defenders;
        const t = this.previous && !this.reducedMotion ? Math.min(1, (performance.now() - this.previousTime) / 150) : 1;
        const lerp = (a, b) => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t});
        const old = this.previous ? this.previous.defenders : current;
        current.forEach((p, i) => {
            if (this.turnover && this.turnover.captor === i) return;
            ctx.globalAlpha = this.turnover ? 0.35 : 1;
            const c = this.point(lerp(old[i], p));
            ctx.strokeStyle = '#ffbb9c'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(c.x, c.y + 17, 22, 9, 0, 0, Math.PI * 2); ctx.stroke();
            this.drawPlayer(lerp(old[i], p), this.rival, 'defender', 'rusher');
            ctx.globalAlpha = 1;
        });
        if (!this.player.carrying && !this.turnover?.captured) {
            const c = this.point(this.field.ball);
            ctx.fillStyle = '#ffe7a1'; ctx.beginPath(); ctx.arc(c.x, c.y, 21, 0, Math.PI * 2); ctx.fill();
            footballArt.draw(ctx, c.x, c.y, footballArt.gameplayWidth, -0.4);
        }
        const runner = this.previous ? lerp(this.previous, this.player) : this.player;
        ctx.save();
        if (this.turnover?.captured) {
            const c = this.point(runner);
            ctx.translate(c.x, c.y); ctx.rotate(-Math.PI / 2); ctx.translate(-c.x, -c.y);
            ctx.globalAlpha = 0.6;
        }
        this.drawPlayer(runner, this.api.team, 'runner', 'runner');
        ctx.restore();
        if (this.player.carrying && !this.turnover?.captured) { const c = this.point(runner); footballArt.draw(ctx, c.x + 16, c.y + 5, footballArt.gameplayWidth, -0.4); }
        if (this.turnover) {
            this.drawPlayer(this.turnover.position, this.rival, 'defender', 'rusher', true);
            if (this.turnover.captured) { const c = this.point(this.turnover.position); footballArt.draw(ctx, c.x - 13, c.y + 4, footballArt.gameplayWidth, 0.4); }
        }
        if (this.phase === 'won' && !this.reducedMotion) {
            const age = (performance.now() - this.celebrationAt) / 1400;
            if (age < 1) for (let i = 0; i < 45; i++) {
                ctx.fillStyle = [this.api.team.secondary, '#ffdb64', '#fff'][i % 3];
                const x = (i * 137 + age * 90) % 1064, y = -40 + age * (500 + i % 6 * 50);
                ctx.save(); ctx.translate(x, y); ctx.rotate(age * 8 + i); ctx.fillRect(-3, -3, 6, 11); ctx.restore();
            }
        }
        ctx.strokeStyle = '#e2f6e6'; ctx.lineWidth = 3; ctx.strokeRect(38, 42, 988, 468);
        ctx.fillStyle = '#aecbc0'; ctx.font = '13px Arial'; ctx.textAlign = 'left';
        ctx.fillText('✓ SAFE THIS TURN · × TACKLE · + SHIELDED', 40, 535);
        ctx.textAlign = 'right'; ctx.fillText(`DEFENDERS CHASE · BURST EVERY ${this.field.burstEvery} STEPS`, 1024, 535);
    }
}

document.myGame = new Game();
