// Pocket Read + route concepts + live pursuit. Drive transitions live in PassingRules.
class PassingGame {
    constructor() {
        this.id = 'pocket';
        this.api = window.teamArcade;
        this.rival = window.NFL_TEAMS.find(team => team.id === this.api.rivalFor());
        footballPlayers.preload().catch(() => {});
        footballPlayers.preload(this.rival.id).catch(() => {});
        this.keys = new Set();
        this.concept = 'slants';
        this.playSeed = Math.floor(Math.random() * 0xffffffff);
        this.style = 'bullet';
        this.phase = 'ready';
        this.drive = PassingRules.initial();
        try {
            const saved = JSON.parse(this.api.storage.getItem('passingDrive-v1'));
            if (saved && Number.isInteger(saved.spot) && saved.spot >= 0 && saved.spot <= 100 && saved.down >= 1 && saved.down <= 5 && saved.toGo >= 0 && saved.toGo <= 100 && saved.drive >= 1 && saved.drive <= 3 && typeof saved.ended === 'boolean' && ['points', 'completions', 'attempts'].every(key => Number.isSafeInteger(saved[key]) && saved[key] >= 0)) this.drive = saved;
        } catch { /* An unreadable save starts a new game. */ }
        document.body.classList.add('passing-page');
        document.title = `Passing Drive · ${this.api.team.name} · Sunday Arcade`;
        document.getElementById('game-title').textContent = 'PASSING DRIVE';
        document.querySelector('.game-intro .eyebrow').textContent = `${window.playerMotion.identity('quarterback').name} · ${this.api.team.short} vs ${this.rival.short}`;
        document.getElementById('game-tagline').textContent = 'Call the route. Work the pocket. Turn the catch into a touchdown.';
        document.querySelector('.game-instructions').replaceChildren();
        this.api.renderGameTabs();
        const currentQuarterback = window.playerMotion.identity('quarterback');
        document.querySelector('.field-heading span:first-child').textContent = `${currentQuarterback.name} · #${currentQuarterback.number}`;
        this.status = document.getElementById('playbook-status');
        this.start = document.getElementById('playbook-start');
        this.start.textContent = 'New 3-drive game';
        this.start.addEventListener('click', () => this.reset());
        this.stage = document.getElementById('playbook-stage');
        this.stage.innerHTML = '<canvas id="passing-canvas" width="1064" height="552" tabindex="0" aria-label="Passing field. Arrow keys move; 1, 2, 3 throw; Space snaps; B switches Bullet/Lob; X slides; P pauses." aria-describedby="playbook-status"></canvas>';
        this.canvas = this.stage.firstChild;
        this.ctx = this.canvas.getContext('2d');
        this.board = document.createElement('div'); this.board.className = 'passing-board';
        this.stage.before(this.board);
        this.controls = document.getElementById('playbook-controls');
        this.controls.innerHTML = '<div class="passing-left"><div class="passing-calls" role="group" aria-label="Route concept"></div><div class="passing-targets" role="group" aria-label="Throw to receiver"></div><div class="passing-actions"></div></div><div class="passing-move" role="group" aria-label="Move quarterback or ball carrier"></div>';
        this.callButtons = Object.entries(PassingRules.concepts).map(([id, play]) => this.button(play.name, () => { this.concept = id; this.setup(); }, '.passing-calls'));
        this.targetButtons = [0, 1, 2].map(i => this.button(`${i + 1} · Receiver`, () => this.throw(i), '.passing-targets'));
        this.actionButton = this.button('Snap · Space', () => this.action(), '.passing-actions');
        this.styleButton = this.button('Pass: Bullet', () => this.togglePassStyle(), '.passing-actions');
        this.styleButton.setAttribute('aria-keyshortcuts', 'B');
        this.scrambleButton = this.button('Tuck & run · Q', () => this.scramble(), '.passing-actions');
        this.awayButton = this.button('Throw away · T', () => this.throwAway(), '.passing-actions');
        this.sprintButton = this.button('Sprint · Shift', () => {}, '.passing-actions');
        this.sprintButton.addEventListener('pointerdown', event => { event.preventDefault(); this.sprintButton.setPointerCapture(event.pointerId); this.keys.add('Shift'); });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.sprintButton.addEventListener(type, () => this.keys.delete('Shift'));
        this.slideButton = this.button('Slide · X', () => this.slide(), '.passing-actions');
        this.slideButton.setAttribute('aria-keyshortcuts', 'X');
        this.pauseButton = this.button('Pause · P', () => this.pause(), '.passing-actions');
        for (const [label, key] of [['↑', 'ArrowUp'], ['←', 'ArrowLeft'], ['↓', 'ArrowDown'], ['→', 'ArrowRight']]) {
            const button = this.button(label, () => {}, '.passing-move');
            button.setAttribute('aria-label', `Move ${label === '↑' ? 'up' : label === '↓' ? 'down' : label === '←' ? 'left' : 'right'}`);
            button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); this.keys.add(key); });
            for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => this.keys.delete(key));
        }
        document.querySelector('.field-panel').addEventListener('keydown', event => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input,select,textarea')) return;
            const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
            const move = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'].includes(key);
            if (move) { event.preventDefault(); this.keys.add(key); }
            if (event.repeat) return;
            if (['1', '2', '3'].includes(event.key)) { event.preventDefault(); this.throw(Number(event.key) - 1); }
            if (event.code === 'Space' && !event.target.closest('button')) { event.preventDefault(); this.action(); }
            if (event.key.toLowerCase() === 'q') { event.preventDefault(); this.scramble(); }
            if (event.key.toLowerCase() === 't') { event.preventDefault(); this.throwAway(); }
            if (event.key === 'Shift') { event.preventDefault(); this.keys.add('Shift'); }
            if (key === 'b') { event.preventDefault(); this.togglePassStyle(); }
            if (key === 'x') { event.preventDefault(); this.slide(); }
            if (event.key.toLowerCase() === 'p') this.pause();
        });
        window.addEventListener('keyup', event => this.keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
        window.addEventListener('blur', () => { this.keys.clear(); this.pause(true); });
        document.addEventListener('visibilitychange', () => { if (document.hidden) { this.keys.clear(); this.pause(true); } });
        this.canvas.addEventListener('pointerdown', event => {
            this.canvas.focus({preventScroll: true});
            if (this.phase !== 'live') return;
            const box = this.canvas.getBoundingClientRect();
            const x = (event.clientX - box.left) * 1064 / box.width, y = (event.clientY - box.top) * 552 / box.height;
            const receiver = this.receivers.findIndex(r => Math.hypot(this.x(r.x) - x, this.y(r.y) - 24 - y) < 52);
            if (receiver >= 0) this.throw(receiver);
        });
        this.status.classList.add('passing-live-status');
        this.stage.after(this.status);
        this.setup();
        this.last = performance.now();
        const loop = now => {
            const dt = Math.min(0.035, (now - this.last) / 1000); this.last = now;
            if (!this.paused) this.update(dt);
            this.draw(); this.frame = requestAnimationFrame(loop);
        };
        this.frame = requestAnimationFrame(loop);
        window.addEventListener('pagehide', () => cancelAnimationFrame(this.frame), {once: true});
    }

    button(label, action, selector) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.addEventListener('click', action); this.controls.querySelector(selector).append(button); return button;
    }

    togglePassStyle() {
        if (!['ready', 'live'].includes(this.phase) || this.paused) return;
        this.style = this.style === 'bullet' ? 'lob' : 'bullet';
        this.sync();
    }

    reset() {
        this.drive = PassingRules.initial(); this.playSeed = Math.floor(Math.random() * 0xffffffff); this.paused = false; this.keys.clear(); this.setup();
    }

    setup() {
        this.phase = 'ready'; this.time = 0; this.stamina = 1; this.sprinting = false; this.resultAt = 0; this.tackler = null; this.tackleDirection = 1; this.interceptor = null; this.caughtBy = null; this.ball = null; this.carrier = null; this.thrown = false; this.completed = false;
        this.slideElapsed = 0; this.slid = false; this.slideSpot = null;
        this.camera = Math.max(0, Math.min(32, this.drive.spot - 15));
        this.qb = {x: this.drive.spot - 5, y: 26.5};
        this.call = PassingRules.callFor(this.concept, this.playSeed);
        this.receivers = this.call.receivers.map((r, i) => ({x: this.drive.spot, y: r.startY, ...r, rosterIndex: i}));
        const look = this.call.look;
        this.coverage = look.name;
        const recent = Array.isArray(this.drive.recentTargets) ? this.drive.recentTargets.filter(i => Number.isInteger(i) && i >= 0 && i < 3).slice(-3) : [];
        this.drive.recentTargets = recent;
        this.shadedReceiver = recent.length >= 2 && recent.filter(i => i === recent.at(-1)).length >= 2 ? recent.at(-1) : this.playSeed % 3;
        this.defenders = this.receivers.map((r, i) => ({
            x: Math.min(98, r.x + look.depth), y: Math.max(3, Math.min(50, r.y + (i % 2 ? -look.spread : look.spread))),
            type: 'cover', assignment: i, reaction: 0.32 + i * 0.07, rosterIndex: i
        }));
        const safeties = look.coverage === 'two' ? [15, 38] : [this.receivers[this.shadedReceiver].y];
        safeties.forEach((y, i) => this.defenders.push({x: Math.min(98, this.drive.spot + look.safetyDepth), y, type: 'safety', assignment: i, rosterIndex: i}));
        this.rushers = look.rush.map((y, i) => ({x: this.drive.spot + 2 + i % 2, y, type: 'rush', rosterIndex: i}));
        this.blockers = look.rush.slice(0, 2).map((y, i) => ({x: this.drive.spot - 2, y, rosterIndex: i}));
        this.api.storage.setItem('passingDrive-v1', JSON.stringify(this.drive));
        if (this.drive.ended) {
            this.phase = 'result';
            this.message(`Saved drive complete: ${this.drive.outcome}. ${this.drive.points} points. Continue when ready.`);
        } else this.message('Choose a route, then snap.');
        this.sync();
    }

    sync() {
        const d = this.drive;
        this.board.replaceChildren(...[`DRIVE ${d.drive}/3`, `${['', '1ST', '2ND', '3RD', '4TH'][Math.min(d.down, 4)]} & ${d.toGo}`, `${d.spot < 50 ? 'OWN' : 'OPP'} ${d.spot <= 50 ? d.spot : 100 - d.spot}`, `${d.points} PTS`, `${d.completions}/${d.attempts} PASS`].map(text => { const span = document.createElement('span'); span.textContent = text; return span; }));
        document.getElementById('playbook-score').textContent = d.completions;
        document.getElementById('playbook-best').textContent = `Best: ${window.fanArcade.number('passingPointsBest')} pts · ${window.fanArcade.number('playbook-pocket-best')} completions`;
        this.callButtons.forEach((button, i) => { button.disabled = this.phase !== 'ready'; button.setAttribute('aria-pressed', String(Object.keys(PassingRules.concepts)[i] === this.concept)); });
        this.targetButtons.forEach((button, i) => { button.style.borderColor = ['#b3f7d1', '#ffdf91', '#bfcfff'][i]; button.disabled = this.phase !== 'live' || !!this.paused; if (this.phase === 'ready') button.textContent = `${i + 1} · ${window.playerMotion.identity('receiver', this.api.team.id, i).name.split(' ').at(-1)}`; });
        this.actionButton.disabled = ['live', 'flight', 'run', 'slide'].includes(this.phase);
        this.actionButton.textContent = this.phase === 'over' ? 'Play again' : this.phase === 'result' ? (d.ended ? (d.drive === 3 ? 'Finish game' : 'Next drive') : 'Next down') : 'Snap · Space';
        this.styleButton.textContent = `Pass: ${this.style === 'bullet' ? 'Bullet' : 'Lob'} · B`;
        this.styleButton.setAttribute('aria-pressed', String(this.style === 'lob'));
        this.styleButton.setAttribute('aria-label', `Pass type: ${this.style}. Switch to ${this.style === 'bullet' ? 'lob' : 'bullet'}`);
        this.styleButton.disabled = !['ready', 'live'].includes(this.phase) || !!this.paused;
        this.scrambleButton.disabled = this.phase !== 'live' || !!this.paused;
        this.awayButton.disabled = this.phase !== 'live' || !!this.paused;
        this.sprintButton.disabled = !['live', 'run'].includes(this.phase) || !!this.paused;
        this.slideButton.disabled = !['live', 'run'].includes(this.phase) || !!this.paused;
        this.pauseButton.disabled = !['live', 'flight', 'run', 'slide'].includes(this.phase);
        this.pauseButton.textContent = this.paused ? 'Resume · P' : 'Pause · P';
    }

    message(text) { this.status.textContent = text; }

    action() {
        if (this.paused) return;
        if (this.phase === 'over') { this.reset(); return; }
        if (this.phase === 'result') {
            if (this.drive.ended && this.drive.drive === 3) { this.phase = 'over'; this.message(`Game complete: ${this.drive.points} points, ${this.drive.completions}/${this.drive.attempts} passing. Start another three drives.`); this.sync(); return; }
            if (this.drive.ended) this.drive = PassingRules.nextDrive(this.drive);
            this.playSeed = (Math.imul(this.playSeed, 1664525) + 1013904223) >>> 0;
            this.setup(); return;
        }
        if (this.phase !== 'ready') return;
        this.phase = 'live'; this.keys.clear();
        this.message('Work the pocket. Throw 1–3 to lead a receiver. Release before the rush arrives!'); this.sync();
        this.canvas.focus({preventScroll: true});
        if (matchMedia('(max-width: 650px)').matches) this.stage.scrollIntoView({block: 'start', behavior: 'instant'});
    }

    pause(force = false) {
        if (!['live', 'flight', 'run', 'slide'].includes(this.phase)) return;
        this.paused = force || !this.paused; this.keys.clear();
        this.message(this.paused ? 'Paused. Press P or Resume to continue this play.' : this.phase === 'slide' ? 'Sliding safely. Ball spotted at the start of the slide.' : this.phase === 'run' ? 'You control the ball carrier. Run for the gold line, or X / Slide to give yourself up.' : 'Play resumed. Read the coverage.'); this.sync();
    }

    routeAt(r, time) {
        // Round route corners in space; prediction and the receiver use the same path.
        if (!r.path) {
            const points = [[0, 0], ...r.route], path = [points[0]];
            for (let i = 1; i < points.length - 1; i++) {
                const a = points[i - 1], b = points[i], c = points[i + 1];
                const before = Math.hypot(b[0] - a[0], b[1] - a[1]);
                const after = Math.hypot(c[0] - b[0], c[1] - b[1]);
                const radius = Math.min(1.6, before * 0.24, after * 0.24);
                const entry = b.map((v, j) => v + (a[j] - v) * radius / before);
                const exit = b.map((v, j) => v + (c[j] - v) * radius / after);
                path.push(entry);
                for (let step = 1; step <= 8; step++) {
                    const t = step / 8;
                    path.push(b.map((v, j) => (1 - t) ** 2 * entry[j] + 2 * (1 - t) * t * v + t * t * exit[j]));
                }
            }
            path.push(points.at(-1)); r.path = path;
        }
        // Ease out of the stance over the first quarter second.
        let distance = Math.max(0, time - 0.125 * (1 - Math.exp(-time / 0.125))) * 6.8, last = [0, 0];
        for (const point of r.path) {
            const length = Math.hypot(point[0] - last[0], point[1] - last[1]);
            if (length && distance <= length) {
                const f = distance / length;
                return {x: Math.min(103, this.drive.spot + last[0] + (point[0] - last[0]) * f), y: Math.max(3, Math.min(50, r.startY + last[1] + (point[1] - last[1]) * f))};
            }
            distance -= length; last = point;
        }
        return {x: Math.min(103, this.drive.spot + last[0]), y: Math.max(3, Math.min(50, r.startY + last[1]))};
    }

    chase(actor, target, speed, dt) {
        const distance = Math.hypot(target.x - actor.x, target.y - actor.y), step = Math.min(distance, speed * dt);
        if (Math.abs(target.x - actor.x) > 0.12) actor.facing = target.x < actor.x;
        actor.moving = step > 0.001;
        if (distance) { actor.x += (target.x - actor.x) / distance * step; actor.y += (target.y - actor.y) / distance * step; }
    }

    scramble() {
        if (this.phase !== 'live' || this.paused) return;
        this.carrier = this.qb; this.phase = 'run'; this.runTime = 0;
        this.message('Ball tucked! You control the quarterback. Cross the blue line and run for the gold first-down marker. Passing is closed.');
        this.sync();
    }

    slide() {
        if (this.paused || !['live', 'run'].includes(this.phase)) return;
        if (this.phase === 'live') this.carrier = this.qb;
        this.slideSpot = {x: this.carrier.x, y: this.carrier.y};
        this.slideElapsed = 0; this.slid = true; this.phase = 'slide';
        this.carrier.moving = false; this.carrier.vx = 0; this.carrier.vy = 0;
        this.sprinting = false; this.keys.clear();
        this.message('Sliding safely. The ball is spotted where the slide starts.');
        this.sync();
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.finishSlide();
    }

    finishSlide() {
        if (this.phase !== 'slide') return;
        this.slideElapsed = 0.65;
        // Give-up starts the dead ball: animation cannot add yards or evade a
        // tackle that already ended the play. Round down before resolving the spot.
        this.endPlay('run', Math.floor(this.slideSpot.x) - this.drive.spot, 'Slid safely.');
    }

    throwAway() {
        if (this.phase !== 'live' || this.paused) return;
        this.thrown = true;
        this.endPlay('incomplete', 0, 'Thrown safely out of bounds. Down used; no yards lost.');
    }

    throw(index) {
        if (this.phase !== 'live' || this.paused) return;
        if (this.qb.x > this.drive.spot) return;
        const r = this.receivers[index];
        const speed = this.style === 'bullet' ? 34 : 22;
        let duration = Math.max(0.22, Math.hypot(r.x - this.qb.x, r.y - this.qb.y) / speed);
        let target;
        for (let iteration = 0; iteration < 4; iteration++) {
            target = this.routeAt(r, this.time + duration + 0.32);
            duration = Math.max(0.22, Math.hypot(target.x - this.qb.x, target.y - this.qb.y) / speed);
        }
        target = this.routeAt(r, this.time + duration + 0.32);
        this.ball = {from: {...this.qb}, target, x: this.qb.x, y: this.qb.y, duration, elapsed: -0.32, receiver: index, style: this.style};
        this.drive.recentTargets = [...(this.drive.recentTargets || []), index].slice(-3);
        this.thrown = true; this.phase = 'flight'; this.message(`${this.style === 'bullet' ? 'Bullet' : 'Lob'} to ${footballPlayers.identity('receiver', this.api.team.id, index).name} (${index + 1})…`); this.sync();
    }

    update(dt) {
        if (this.paused) return;
        if (this.phase === 'slide') {
            this.slideElapsed = Math.min(0.65, this.slideElapsed + dt);
            if (this.slideElapsed >= 0.65) this.finishSlide();
            return;
        }
        if (this.paused || !['live', 'flight', 'run'].includes(this.phase)) return;
        const positions = new Map([this.qb, ...this.receivers, ...this.defenders, ...this.rushers, ...this.blockers].map(p => [p, {x: p.x, y: p.y}]));
        this.time += dt;
        const actor = this.phase === 'run' ? this.carrier : this.qb;
        if (this.phase !== 'flight') {
            let dx = Number(this.keys.has('ArrowRight') || this.keys.has('d')) - Number(this.keys.has('ArrowLeft') || this.keys.has('a'));
            let dy = Number(this.keys.has('ArrowDown') || this.keys.has('s')) - Number(this.keys.has('ArrowUp') || this.keys.has('w'));
            const moving = dx !== 0 || dy !== 0;
            const energy = PassingRules.energy(this.stamina, this.keys.has('Shift'), moving, dt);
            this.stamina = energy.stamina; this.sprinting = energy.sprinting;
            const norm = Math.hypot(dx, dy) || 1;
            const baseSpeed = this.phase === 'run' && this.carrier !== this.qb ? PassingRules.movement.carrier : PassingRules.movement.quarterback;
            const speed = baseSpeed * (this.sprinting ? PassingRules.movement.sprint : 1);
            actor.moving = moving; actor.sprinting = this.sprinting;
            if (this.phase === 'run' && dx) actor.facing = dx < 0;
            // Ease starting/stopping without making controls sluggish.
            actor.vx = (actor.vx || 0) + (dx / norm * speed - (actor.vx || 0)) * Math.min(1, dt * 14);
            actor.vy = (actor.vy || 0) + (dy / norm * speed - (actor.vy || 0)) * Math.min(1, dt * 14);
            if (dx) actor.facing = dx < 0;
            actor.x = Math.max(-1, Math.min(this.phase === 'run' ? 101 : this.drive.spot, actor.x + actor.vx * dt));
            actor.y = Math.max(1, Math.min(52, actor.y + actor.vy * dt));
        }
        this.receivers.filter(r => r !== this.carrier).forEach(r => {
            const next = this.routeAt(r, this.time);
            r.moving = Math.hypot(next.x - r.x, next.y - r.y) > 0.001;
            if (Math.abs(next.x - r.x) > 0.001) r.facing = next.x < r.x;
            Object.assign(r, next);
        });
        const ballTarget = this.phase === 'flight' ? this.ball.target : this.phase === 'run' ? actor : null;
        this.defenders.forEach((defender, i) => {
            let target = this.receivers[defender.assignment % 3];
            let speed = 6.1;
            const reactedToThrow = this.phase === 'flight' && this.ball.elapsed >= (defender.type === 'safety' ? 0.32 : 0.22);
            if (this.phase === 'run' || reactedToThrow) { 
                // Lead the runner slightly: pursuit takes an angle instead of following a tail.
                const lead = this.phase === 'run' ? 0.28 : 0;
                target = {x: ballTarget.x + (this.keys.has('ArrowRight') || this.keys.has('d') ? 1.8 * lead : 0), y: ballTarget.y};
                speed = PassingRules.movement.pursuit;
            } else if (defender.type === 'safety') {
                const half = defender.assignment === 0 ? this.receivers.filter(r => r.y < 26.5) : this.receivers.filter(r => r.y >= 26.5);
                const shaded = this.call.look.coverage === 'two'
                    ? (half.sort((a, b) => b.x - a.x)[0] || this.receivers[this.shadedReceiver])
                    : this.receivers[this.shadedReceiver];
                const cushion = this.call.look.coverage === 'robber' ? 1.5 : 6;
                target = {x: Math.min(101, shaded.x + cushion), y: shaded.y}; speed = 6.2;
            } else if (this.call.look.coverage === 'two' || this.call.look.coverage === 'three' || this.call.look.coverage === 'robber') {
                const depth = this.call.look.coverage === 'three' ? 15 : this.call.look.coverage === 'robber' ? 7 : 10;
                const r = this.receivers[defender.assignment];
                target = {x: this.drive.spot + depth + Math.max(0, r.x - this.drive.spot - depth) * 0.55, y: r.startY + (r.y - r.startY) * 0.65};
                speed = 6.5;
            } else {
                // Defenders trail the route they saw, so a cut creates a real throwing window.
                target = this.routeAt(target, Math.max(0, this.time - defender.reaction));
            }
            this.chase(defender, target, speed, dt);
        });
        this.rushers.forEach((rusher, i) => {
            const blocker = this.blockers[i];
            const holdUntil = 2.4 + i * 0.22;
            const engaged = blocker && this.phase !== 'run' && this.time < holdUntil;
            rusher.engaged = !!engaged;
            if (blocker) blocker.engaged = !!engaged;
            if (engaged) {
                // Both athletes share the contact plane, leaning and driving against it.
                const approach = Math.min(1, this.time / 0.3);
                const drive = Math.max(0, this.time - 0.3) * 0.3;
                const contact = this.drive.spot - drive;
                const gap = 3.35;
                blocker.x = contact - gap / 2; rusher.x = contact + gap / 2;
                blocker.y = rusher.y = this.call.look.rush[i];
                blocker.facing = false; rusher.facing = true;
                blocker.contactProgress = rusher.contactProgress = approach;
            } else {
                // A shed goes around the outside shoulder instead of through a blocker.
                const shedding = blocker && this.phase !== 'run' && this.time < holdUntil + 0.55;
                const target = shedding ? {x: blocker.x - 1, y: blocker.y + (i ? 4 : -4)} : this.phase === 'run' ? actor : this.qb;
                this.chase(rusher, target, PassingRules.movement.rush, dt);
                if (blocker) this.chase(blocker, {x: rusher.x - 3.35, y: rusher.y}, 2.5, dt);
            }
        });
        for (const [p, before] of positions) footballPlayers.advance(p, (p.x - before.x) * 12, (p.y - before.y) * 8, dt);
        if (this.phase === 'live') {
            this.receivers.forEach((receiver, i) => {
                const text = `${i + 1} · ${window.playerMotion.identity('receiver', this.api.team.id, i).name.split(' ').at(-1)} · ${Math.round(receiver.x - this.drive.spot)} yd`;
                if (this.targetButtons[i].textContent !== text) this.targetButtons[i].textContent = text;
            });
            if (this.rushers.some(r => Math.hypot(r.x - actor.x, r.y - actor.y) < 1.8) || this.time > 8) this.endPlay('sack', this.qb.x - this.drive.spot, 'Sacked. The rush got home.');
            else if (actor.y <= 1 || actor.y >= 52) this.endPlay('run', actor.x - this.drive.spot, 'Quarterback out of bounds.');
        } else if (this.phase === 'flight') {
            const b = this.ball;
            if (b.elapsed < 0 && this.rushers.some(r => Math.hypot(r.x - this.qb.x, r.y - this.qb.y) < 1.8)) {
                this.thrown = false; this.ball = null;
                this.endPlay('sack', this.qb.x - this.drive.spot, 'Sacked during the windup. Release earlier against pressure.'); return;
            }
            b.elapsed += dt; const f = Math.max(0, Math.min(1, b.elapsed / b.duration));
            b.x = b.from.x + (b.target.x - b.from.x) * f; b.y = b.from.y + (b.target.y - b.from.y) * f;
            const canPick = b.elapsed >= 0 && (b.style === 'bullet' || f > 0.86);
            const picker = canPick && this.defenders.find(d => Math.hypot(d.x - b.x, d.y - b.y) < 1.6);
            if (picker) {
                this.interceptor = picker;
                this.caughtBy = footballPlayers.identity(picker.type === 'safety' ? 'safety' : 'corner', this.rival.id, picker.rosterIndex || 0);
                this.ball = null;
                this.endPlay('interception', 0, `Intercepted by ${this.caughtBy.name} (#${this.caughtBy.number}, ${this.rival.short}).`); return;
            }
            if (f >= 1) {
                const receiver = this.receivers[b.receiver];
                if (Math.hypot(receiver.x - b.x, receiver.y - b.y) > 4) { this.endPlay('incomplete', 0, 'Incomplete. The route outran the pass.'); return; }
                this.catchAt = this.time; this.carrier = receiver; this.caughtBy = footballPlayers.identity('receiver', this.api.team.id, receiver.rosterIndex); this.completed = true; this.phase = 'run'; this.ball = null; this.runTime = 0;
                this.message(`Complete to ${this.caughtBy.name} (#${this.caughtBy.number})! You control the receiver. Run after the catch.`); this.sync();
            }
        } else if (this.phase === 'run') {
            this.runTime += dt;
            this.camera = Math.max(this.camera, Math.min(32, actor.x - 55));
            if (actor.x >= 100) this.endPlay('run', 100 - this.drive.spot, 'TOUCHDOWN! Six points.');
            else if ([...this.defenders, ...this.rushers].some(d => Math.hypot(d.x - actor.x, d.y - actor.y) < 1.7)) this.endPlay('run', actor.x - this.drive.spot, this.completed ? 'Tackled after the catch.' : 'Quarterback tackled on the run.');
            else if (actor.y <= 1 || actor.y >= 52 || this.runTime > 12) this.endPlay('run', actor.x - this.drive.spot, this.runTime > 12 ? 'Whistle. Forward progress stopped.' : 'Out of bounds.');
        }
    }

    endPlay(kind, yards, message) {
        if (!['live', 'flight', 'run', 'slide'].includes(this.phase)) return;
        const before = {...this.drive};
        this.drive = PassingRules.resolve(before, {kind, yards, thrown: this.thrown, complete: this.completed});
        this.phase = 'result';
        if (kind === 'sack' || message.toLowerCase().includes('tackled')) {
            const victim = this.carrier || this.qb;
            this.tackler = [...this.defenders, ...this.rushers].sort((a, b) => Math.hypot(a.x - victim.x, a.y - victim.y) - Math.hypot(b.x - victim.x, b.y - victim.y))[0];
            if (this.tackler && Math.hypot(this.tackler.x - victim.x, this.tackler.y - victim.y) > 3.8) this.tackler = null;
            if (this.tackler) {
                this.tackleDirection = this.tackler.x >= victim.x ? -1 : 1;
                // Preserve the actual point of contact; both bodies carry the hit's momentum.
                this.tackler.facing = this.tackleDirection < 0;
                victim.facing = this.tackleDirection < 0;
            }
        }
        this.resultAt = performance.now(); this.resultKind = kind; this.tackled = !!this.tackler; this.keys.clear();
        const gain = this.drive.spot - before.spot;
        const suffix = this.drive.outcome === 'touchdown' ? 'Touchdown! +6 points.' : this.drive.ended ? `Drive over: ${this.drive.outcome === 'downs' ? 'turnover on downs' : this.drive.outcome}.` : this.drive.down === 1 ? 'First down!' : `${this.drive.down} & ${this.drive.toGo}.`;
        this.resultTitle = this.drive.outcome === 'touchdown' ? 'TOUCHDOWN +6' : kind === 'interception' ? 'INTERCEPTED' : kind === 'incomplete' ? 'INCOMPLETE' : kind === 'sack' ? 'SACK' : `${gain >= 0 ? '+' : ''}${gain} YARDS`;
        this.message(`${this.completed && this.caughtBy ? `Complete to ${this.caughtBy.name} (#${this.caughtBy.number}). ` : ''}${message} ${gain >= 0 ? '+' : ''}${gain} yards. ${suffix}`);
        for (const [key, value] of [['playbook-pocket-best', this.drive.completions], ['passingPointsBest', this.drive.points]]) {
            if (value > window.fanArcade.number(key)) window.fanArcade.write(key, value);
        }
        this.api.storage.setItem('passingDrive-v1', JSON.stringify(this.drive));
        document.dispatchEvent(new CustomEvent('football:play-result', {detail: {mode: 'pass', before, after: {...this.drive}, play: {kind, yards: gain, complete: this.completed, caughtBy: this.caughtBy ? {id: this.caughtBy.id, name: this.caughtBy.name, number: this.caughtBy.number} : null}}}));
        document.dispatchEvent(new Event('arcade:progress')); this.sync();
    }

    x(yards) { return 70 + (yards - this.camera) * 12; }
    y(yards) { return 60 + yards * 8; }

    draw() {
        const c = this.ctx; c.clearRect(0, 0, 1064, 552);
        c.fillStyle = '#102b29'; c.fillRect(0, 0, 1064, 552);
        c.fillStyle = '#eff9f4'; c.textAlign = 'left'; c.font = 'bold 17px system-ui';
        c.fillText(`${this.api.team.short} OFFENSE  /  ${this.rival.short} DEFENSE`, 24, 28);
        c.textAlign = 'right'; c.fillStyle = '#ffe69a';
        c.fillText(this.paused ? 'PAUSED' : this.phase === 'live' ? `POCKET ${Math.max(0, 8 - this.time).toFixed(1)}s` : this.phase === 'slide' ? 'SLIDING · BALL DEAD' : this.phase === 'run' ? this.carrier === this.qb ? 'QUARTERBACK SCRAMBLE' : 'YOU CONTROL THE RECEIVER' : this.phase === 'flight' ? 'BALL IN THE AIR' : 'READ THE COVERAGE', 1040, 28);
        c.save(); c.beginPath(); c.rect(24, 50, 1016, 440); c.clip();
        for (let yard = Math.max(0, Math.floor(this.camera / 5) * 5 - 5); yard < Math.min(100, this.camera + 85); yard += 5) {
            c.fillStyle = yard % 10 === 0 ? '#215b3f' : '#1b5139'; c.fillRect(this.x(yard), 50, 60, 440);
            c.strokeStyle = '#ffffff40'; c.lineWidth = 1; c.beginPath(); c.moveTo(this.x(yard), 50); c.lineTo(this.x(yard), 490); c.stroke();
            if (yard > 0 && yard < 100 && yard % 10 === 0) {
                c.fillStyle = '#e0eadea8'; c.font = 'bold 20px system-ui'; c.textAlign = 'center';
                c.save(); c.translate(this.x(yard), 84); c.rotate(Math.PI); c.fillText(Math.min(yard, 100 - yard), 0, 0); c.restore();
                c.fillText(Math.min(yard, 100 - yard), this.x(yard), 470);
            }
        }
        footballField.endzone(c, this.x(100), 50, 120, 440, this.api.team);
        c.fillStyle = '#576862'; c.fillRect(this.x(110) + 2, 50, 34, 440);
        c.strokeStyle = '#c0cac18c'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(this.x(110) + 22, 50); c.lineTo(this.x(110) + 22, 490); c.stroke();
        c.fillStyle = '#102b29'; c.fillRect(this.x(110) + 36, 50, 1064, 440);
        footballField.goalpost(c, this.x(110) + 18, 305, this.api.team);
        for (const yy of [54, 486]) for (const yard of [100, 110]) footballField.pylon(c, this.x(yard), yy);
        for (const [yard, color] of [[this.drive.spot, '#69d6ff'], [Math.min(100, this.drive.spot + this.drive.toGo), '#ffdb64']]) {
            c.strokeStyle = color; c.lineWidth = 3; c.beginPath(); c.moveTo(this.x(yard), 50); c.lineTo(this.x(yard), 490); c.stroke();
        }
        if (['ready', 'live'].includes(this.phase)) this.receivers.forEach((r, i) => {
            c.strokeStyle = ['#b3f7d1', '#ffdf91', '#bfcfff'][i]; c.lineWidth = 3; c.setLineDash([8, 6]);
            c.beginPath(); c.moveTo(this.x(this.drive.spot), this.y(r.startY));
            r.route.forEach(p => c.lineTo(this.x(Math.min(103, this.drive.spot + p[0])), this.y(Math.max(3, Math.min(50, r.startY + p[1])))));
            c.stroke(); c.setLineDash([]);
        });
        if (this.phase === 'flight' && this.ball?.elapsed >= 0) {
            const f = this.ball.elapsed / this.ball.duration;
            if (this.ball.style === 'bullet' || f > 0.86) for (const d of this.defenders) {
                c.strokeStyle = '#ff7969'; c.lineWidth = 2; c.setLineDash([3, 4]);
                c.beginPath(); c.ellipse(this.x(d.x), this.y(d.y)+4, 1.6*12, 1.6*8, 0, 0, Math.PI*2); c.stroke(); c.setLineDash([]);
            }
        }
        const actors = [
            ...this.blockers.map(p => ({p, role: 'lineman', rival: false, ring: '#a8efb8'})),
            ...[...this.defenders, ...this.rushers].map(p => ({p, role: p.type === 'safety' ? 'safety' : p.type === 'rush' ? 'rusher' : 'corner', rival: true, ring: '#ffa7a0'})),
            ...this.receivers.map((p, i) => ({p, role: 'receiver', rival: false, ring: this.carrier === p ? '#ffdb64' : ['#b3f7d1', '#ffdf91', '#bfcfff'][i]})),
            {p: this.qb, role: 'quarterback', rival: false, ring: '#69d6ff'}
        ];
        actors.sort((a, b) => a.p.y - b.p.y).forEach(({p, role, rival, ring}) => this.player(p, role, rival, ring));
        // Draw after the athletes so each key remains legible through crossing routes.
        if (['ready', 'live', 'flight'].includes(this.phase)) this.receivers.forEach((r, i) => {
            const xx = Math.max(43, Math.min(1021, this.x(r.x))), yy = Math.max(68, this.y(r.y) - 62);
            const color = ['#b3f7d1', '#ffdf91', '#bfcfff'][i];
            c.strokeStyle = color; c.lineWidth = 1.5; c.fillStyle = '#071e30';
            c.beginPath(); c.roundRect(xx - 13, yy - 14, 26, 27, 6); c.fill(); c.stroke();
            c.fillStyle = color; c.textAlign = 'center'; c.font = '900 20px system-ui'; c.fillText(i + 1, xx, yy + 7);
        });
        const ball = this.ball?.elapsed >= 0 ? this.ball : null;
        if (ball) {
            const lift = this.ball ? Math.sin(Math.PI * Math.max(0, Math.min(1, this.ball.elapsed / this.ball.duration))) * (this.ball.style === 'lob' ? 65 : 20) : 0;
            const fraction = this.ball ? Math.max(0, Math.min(1, this.ball.elapsed / this.ball.duration)) : 1;
            const origin = footballPlayers.hand('quarterback', this.x(this.ball.from.x) - 23, this.y(this.ball.from.y) - 48, 46, 60, {action: 'throw', progress: 0.5});
            const destination = footballPlayers.hand('receiver', this.x(this.ball.target.x) - 23, this.y(this.ball.target.y) - 48, 46, 60, {teamId: this.api.team.id, variant: this.ball.receiver, action: 'catch', progress: 1/3});
            footballArt.draw(c, origin.x + (destination.x - origin.x) * fraction, origin.y + (destination.y - origin.y) * fraction - lift, footballArt.gameplayWidth, -0.3 + fraction * 2.5);

        }
        c.restore();
        c.strokeStyle = '#e8f4e7'; c.lineWidth = 3; c.strokeRect(24, 50, 1016, 440);
        c.textAlign = 'left'; c.fillStyle = '#bde8fa'; c.font = 'bold 16px system-ui'; c.fillText('BLUE: SCRIMMAGE', 24, 526);
        c.fillStyle = '#ffdb64'; c.fillText('GOLD: FIRST DOWN', 230, 526);
        c.fillStyle = '#122d31'; c.fillRect(440, 500, 100, 12);
        c.fillStyle = this.stamina > 0.25 ? '#b3f7d1' : '#ffad83'; c.fillRect(440, 500, this.stamina * 100, 12);
        c.fillStyle = '#fff'; c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.fillText('BURST', 490, 535);
        c.fillStyle = '#f1f6f2'; c.textAlign = 'right'; c.fillText(this.phase === 'ready' ? 'CHOOSE A PLAY • SNAP TO START' : this.phase === 'result' || this.phase === 'over' ? 'PLAY OVER • USE THE BUTTON TO CONTINUE' : '1 / 2 / 3 TO PASS • ARROWS / WASD TO MOVE', 1040, 526);
        if (this.phase === 'result' && this.resultTitle && performance.now() - this.resultAt > 1250) {
            c.fillStyle = '#081e2eea'; c.beginPath(); c.roundRect(342, 220, 380, 90, 12); c.fill();
            c.fillStyle = this.drive.outcome === 'touchdown' ? '#ffdb64' : '#fff'; c.textAlign = 'center'; c.font = '900 30px system-ui'; c.fillText(this.resultTitle, 532, 258);
            c.fillStyle = '#c2d7d4'; c.font = '16px system-ui'; c.fillText(this.caughtBy ? `${this.completed ? 'Caught' : 'Intercepted'} by ${this.caughtBy.name} · #${this.caughtBy.number}` : this.drive.ended ? 'Drive complete' : `${this.drive.down} & ${this.drive.toGo} · Next down when ready`, 532, 287);
        }
        if (this.paused) { c.fillStyle = '#071e30bb'; c.fillRect(24, 50, 1016, 440); c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = 'bold 40px system-ui'; c.fillText('PAUSED', 532, 280); }
    }

    player(p, role, rival, ring) {
        const c = this.ctx;
        const settling = this.phase === 'result' && this.tackled && (p === this.tackler || p === (this.carrier || this.qb)) ? Math.min(1, (performance.now() - this.resultAt) / 1050) : 0;
        const sliding = this.slid && p === this.carrier;
        const slideProgress = sliding ? Math.min(1, this.slideElapsed / 0.65) : 0;
        const slideEase = slideProgress * (2 - slideProgress);
        const x = this.x(p.x) + (sliding ? (p.facing ? -1 : 1) * 14 * slideEase : 0) + settling * (this.tackleDirection || 1) * (p === this.tackler ? 16 : 9), y = this.y(p.y) + settling * 3;
        c.fillStyle = '#001c2280'; c.beginPath(); c.ellipse(x, y + 8, 16, 7, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = ring; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y + 8, 19, 9, 0, 0, Math.PI * 2); c.stroke();
        const team = rival ? this.rival : this.api.team;
        const live = !this.paused && ['live', 'flight', 'run'].includes(this.phase);
        const catching = this.phase === 'flight' && this.ball?.receiver === p.rosterIndex && role === 'receiver' && this.ball.elapsed / this.ball.duration > 0.72;
        const catchPose = this.carrier === p && this.time - this.catchAt < 0.6;
        const down = this.phase === 'result' && this.tackled && p === (this.carrier || this.qb);
        const tackling = this.phase === 'result' && p === this.tackler;
        const picking = this.phase === 'result' && p === this.interceptor;
        const resultProgress = Math.min(1, (performance.now() - this.resultAt) / 1050);
        const reaching = rival && this.phase === 'flight' && this.ball?.elapsed >= 0 && Math.hypot(p.x-this.ball.x,p.y-this.ball.y)<3 && (this.ball.style === 'bullet' || this.ball.elapsed/this.ball.duration>0.8);
        const action = sliding ? 'slide' : down ? 'tackled' : tackling ? 'tackle' : picking || reaching ? 'intercept' : catching || catchPose ? 'catch' : p.engaged && live ? 'block' : role === 'quarterback' && this.phase === 'flight' ? 'throw' : live && (p.moving || p.movement > 0.05) ? 'run' : 'idle';
        window.footballPlayers.draw(c, role, x - 23, y - 48, 46, 60, {
            teamId: team.id, action, time: this.time, stride: p.stride, movement: p.movement, variant: p.rosterIndex || 0, flip: action === 'throw' || catching ? false : p.facing ?? rival,
            progress: sliding ? slideProgress : picking ? 1/3 + resultProgress*2/3 : reaching ? 0.3 : down || tackling ? resultProgress : catching ? Math.max(0, Math.min(1, (this.ball.elapsed / this.ball.duration - 0.72) / 0.28)) / 3 : catchPose ? 1/3 + (this.time - this.catchAt) / 0.6 * 2/3 : p.engaged ? p.contactProgress : this.ball ? (this.ball.elapsed + 0.32) / 0.64 : 0.7,
            ball: picking || !this.interceptor && (p === (this.carrier || this.qb)) && (!this.ball || this.ball.elapsed < 0)
        });
    }
}
