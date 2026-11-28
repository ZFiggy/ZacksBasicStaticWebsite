class FieldGoalGame {
    constructor() {
        this.canvas = document.getElementById('kickCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.button = document.getElementById('kick-button');
        this.status = document.getElementById('kick-status');
        this.pauseButton = document.getElementById('kick-pause');
        this.coach = document.getElementById('kick-coach');
        this.hash = 0;
        this.steeringKeys = new Set();
        this.protectionLane = 0;
        this.paused = false;
        this.pauseButton.addEventListener('click', () => this.pause());
        this.marker = document.getElementById('kick-marker');
        this.setup = document.getElementById('kick-setup');
        this.aimInput = document.getElementById('kick-aim');
        this.physics = window.fieldGoalRules;
        this.rule = window.teamArcade.ruleFor('kick');
        this.rival = this.physics.rivalFor(window.teamArcade.teams, window.teamArcade.team, window.teamArcade.rivalFor());
        footballPlayers.preload().catch(() => {});
        footballPlayers.preload(this.rival.id).catch(() => {});
        this.best = 0;
        try {
            const stored = Number(window.teamArcade.storage.getItem('fieldGoalBest'));
            if (Number.isInteger(stored) && stored >= 0 && stored <= 15 && stored % 3 === 0) this.best = stored;
        } catch { /* Play remains available without storage. */ }
        document.getElementById('kick-matchup').textContent = `${window.teamArcade.team.short} vs ${this.rival.short} · Roster ${window.currentRosters.updatedAt.slice(0,10)}`;
        document.querySelector('.game-intro > p:last-child').textContent = `Kick over the ${this.rival.nickname} rush. Read the wind, pick your arc, and build a perfect five-kick round.`;
        this.canvas.setAttribute('aria-label', `${window.playerMotion.identity('kicker').name} kicking over ${this.rival.nickname} defenders. Snap, lock power, steer with Left/Right or A/D, then kick.`);
        const currentKicker = window.playerMotion.identity('kicker');
        document.querySelector('.field-heading span:first-child').textContent = `${currentKicker.name} · #${currentKicker.number}`;
        this.button.addEventListener('click', () => this.act());
        this.canvas.addEventListener('click', () => { this.canvas.focus({preventScroll: true}); this.act(); });
        this.canvas.closest('.field-panel').addEventListener('keydown', event => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input,select,textarea')) return;
            const key = event.key.toLowerCase();
            if (this.state === 'accuracy' && ['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
                event.preventDefault(); if (!this.paused) this.steeringKeys.add(key); return;
            }
            if (event.key.toLowerCase() === 'p') { event.preventDefault(); if (!event.repeat) this.pause(); return; }
            if (event.target !== this.canvas || event.code !== 'Space' && event.code !== 'Enter') return;
            event.preventDefault();
            if (!event.repeat) this.act();
        });
        window.addEventListener('keyup', event => this.steeringKeys.delete(event.key.toLowerCase()));
        window.addEventListener('blur', () => { this.steeringKeys.clear(); if (!this.paused) this.pause(); });
        document.querySelectorAll('[data-steer]').forEach(button => {
            const key = Number(button.dataset.steer) < 0 ? 'a' : 'd';
            button.addEventListener('pointerdown', event => {
                event.preventDefault(); if (this.state !== 'accuracy' || this.paused) return;
                button.setPointerCapture(event.pointerId); this.steeringKeys.add(key);
            });
            for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => this.steeringKeys.delete(key));
            button.addEventListener('click', event => { if (event.detail === 0 && this.state === 'accuracy' && !this.paused) { this.setAim(this.aim + Number(button.dataset.steer) * 0.04); this.draw(); } });
        });
        document.querySelectorAll('[data-protect]').forEach(button => button.addEventListener('click', () => {
            if (this.state !== 'ready') return;
            this.protectionLane = Number(button.dataset.protect); this.updateDisplay(); this.draw();
        }));
        this.aimInput.addEventListener('input', () => {
            this.setAim(Number(this.aimInput.value) / 100); this.updateDisplay(); this.draw();
        });
        document.querySelectorAll('[data-hash]').forEach(button => { button.disabled = true; button.title = 'Hash is assigned by the kicking situation'; });
        document.getElementById('kick-compensate').addEventListener('click', () => {
            if (this.state !== 'ready') return;
            this.aimInput.value = String(Math.round(-(this.liveWind * (this.loft === 'high' ? 1.5 : 1) + this.physics.hashBias(this.distance, this.hash)) * 100));
            this.aimInput.dispatchEvent(new Event('input'));
        });
        this.canvas.closest('.field-panel').prepend(this.status);
        this.status.classList.add('kick-live-status');
        document.querySelectorAll('[data-loft]').forEach(button => button.addEventListener('click', () => {
            if (this.state !== 'ready') return;
            this.loft = button.dataset.loft;
            document.querySelectorAll('[data-loft]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
            this.updateDisplay();
            this.draw();
        }));
        document.getElementById('restart-kicks').addEventListener('click', () => this.reset());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && ['running', 'accuracy'].includes(this.state)) {
                cancelAnimationFrame(this.frame);
                this.paused = false;
                this.state = 'ready';
                this.position = 0;
                this.elapsed = 0;
                this.power = null;
                this.updateDisplay();
                this.status.textContent = 'Snap paused while away. Set up and snap again; no attempt lost.';
                this.updateCoach(); this.draw();
            }
        });
        this.reset();
    }

    reset() {
        cancelAnimationFrame(this.frame);
        this.paused = false;
        this.hash = 0;
        document.querySelectorAll('[data-hash]').forEach(item => item.setAttribute('aria-pressed', String(Number(item.dataset.hash) === 0)));
        this.situations = this.physics.situations();
        this.points = 0;
        this.attempts = 0;
        this.history = [];
        this.aim = 0;
        this.aimInput.value = '0';
        document.getElementById('kick-aim-value').textContent = 'Center';
        this.loft = 'balanced';
        document.querySelectorAll('[data-loft]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.loft === this.loft)));
        this.lastResult = null;
        this.shot = null;
        this.prepare();
        this.status.textContent = `Line up with ${window.playerMotion.identity('kicker').name}. Set your aim and trajectory, then snap.`;
    }

    get situation() { return this.situations?.[Math.min(this.attempts, 4)]; }
    get liveWind() { return this.physics.windAt(this.situation, this.wind, this.elapsed); }
    get liveOffset() { return this.aim + this.physics.hashBias(this.distance, this.hash) + this.liveWind * (this.loft === 'high' ? 1.5 : 1); }
    setAim(aim) {
        this.aim = Math.max(-1, Math.min(1, aim));
        this.aimInput.value = String(Math.round(this.aim * 100));
        document.getElementById('kick-aim-value').textContent = Math.abs(this.aim) < 0.005 ? 'Center' : `${Math.abs(Math.round(this.aim * 100))}% ${this.aim < 0 ? 'left' : 'right'}`;
    }

    get minimumPower() { return Math.max(0, Math.min(1, (Math.hypot(this.distance, this.hash * 18.5 / 6) / (this.physics.trajectories[this.loft].range * (1 - (this.situation?.headwind || 0))) - 18) / 52 + 0.002)); }
    get zoneWidth() { return this.state === 'running' ? Math.min(0.2, 1 - this.minimumPower) : Math.max(0.11, 0.2 - this.attempts * 0.018); }
    get distance() { return this.physics.distanceFor(Math.min(this.attempts, 4)); }
    get protection() { return this.physics.protectionFor(Math.min(this.attempts, 4)) + this.physics.protectionBonus(this.situation, this.protectionLane); }

    // A fixed camera and uprights make every extra yard visible. Keep the
    // kicker, ball, protection, and pass rush in the same translated formation.
    get formation() {
        const goalX = 920;
        const ballX = goalX - this.distance * 12;
        return {goalX, ballX, ballY: 400 + this.hash * 48, kickerX: ballX - 80, lineX: ballX + 140};
    }

    prepare() {
        this.state = 'ready';
        this.steeringKeys.clear(); this.protectionLane = 0;
        this.hash = this.situations[Math.min(this.attempts, 4)].hash;
        this.aim = 0; this.aimInput.value = '0';
        document.getElementById('kick-aim-value').textContent = 'Center';
        document.querySelectorAll('[data-hash]').forEach(item => item.setAttribute('aria-pressed', String(Number(item.dataset.hash) === this.hash)));
        this.position = 0;
        this.power = null;
        this.elapsed = 0;
        this.shotProgress = 0; this.strikeProgress = 0; this.flightElapsed = 0;
        this.wind = (Math.random() * 2 - 1) * (0.1 + this.attempts * 0.025);
        this.baseZoneCenter = 0.5;
        this.zoneCenter = 0.5;
        this.updateDisplay();
        this.draw();
    }

    // Compatibility for saved demos/tests: accuracy now comes from steering, not a second meter.
    get accuracyCenter() { return 0.5; }

    pause() {
        if (!['running', 'accuracy', 'flight'].includes(this.state)) return;
        this.steeringKeys.clear();
        if (!this.paused) {
            this.paused = true; this.pausedAt = performance.now(); cancelAnimationFrame(this.frame);
            this.pauseMessage = this.status.textContent; this.status.textContent = 'Paused. Resume to continue this kick.';
        } else {
            const delay = performance.now() - this.pausedAt;
            this.startedAt += delay; this.stageStartedAt += delay;
            if (this.flightStartedAt) this.flightStartedAt += delay;
            this.paused = false; this.status.textContent = this.pauseMessage;
            this.tick(performance.now());
        }
        this.updateDisplay(); this.draw();
    }

    updateDisplay() {
        this.canvas.closest('.field-panel').dataset.kickState = this.state;
        document.getElementById('kick-score').textContent = this.points;
        document.getElementById('kick-best').textContent = this.best;
        document.getElementById('kick-attempt').textContent = `KICK ${Math.min(this.attempts + 1, 5)} / 5`;
        document.getElementById('kick-distance').textContent = `${this.distance} YARDS`;
        document.getElementById('kick-spot').textContent = `${['Left hash', 'Center hash', 'Right hash'][this.hash + 1]} · Assigned starting spot`;
        document.querySelector('.kick-rival-swatch').style.background = this.rival.primary;
        document.querySelector('.kick-team-swatch').style.background = teamArcade.team.primary;
        document.querySelector('.kick-team-key').textContent = `Your team · ${teamArcade.team.short}`;
        document.querySelector('.kick-rival-key').textContent = `Opponents · ${this.rival.short}`;
        document.getElementById('kick-wind').textContent = `Wind: ${Math.round(Math.abs(this.liveWind) * 100)} MPH ${this.liveWind >= 0 ? 'right' : 'left'} · Aim ${this.liveWind >= 0 ? 'left' : 'right'} to compensate`;
        document.getElementById('kick-rush').textContent = `${this.rival.short} rush: ${Math.max(0, this.protection - this.elapsed - 0.82).toFixed(1)}s`;
        document.getElementById('kick-power').textContent = this.power === null ? 'Power: —' : `Power: ${Math.round(this.power * 100)}%`;
        document.getElementById('kick-stage').textContent = {ready: '1 · SET AIM & ARC', running: '2 · LOCK POWER', accuracy: '3 · STEER & RELEASE', flight: 'BALL IN FLIGHT', complete: 'ROUND COMPLETE'}[this.state];
        this.setup.disabled = this.state !== 'ready';
        document.querySelector('.kick-steer').hidden = this.state !== 'accuracy';
        document.querySelectorAll('[data-steer]').forEach(button => { button.disabled = this.paused || this.state !== 'accuracy'; });
        document.querySelectorAll('[data-protect]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.protect) === this.protectionLane)));
        const rush = ['Left edge (far side)', 'Middle', 'Right edge (near side)'][this.situation.rush + 1];
        const maximum = this.physics.rangeFor(1, this.loft, this.situation.headwind);
        const nearLimit = maximum - Math.hypot(this.distance, this.hash * 18.5 / 6) < 2;
        const air = `${this.situation.headwind > 0 ? 'Headwind: build extra power.' : this.situation.headwind < 0 ? 'Tailwind: extra carry.' : 'Normal carry.'}${nearLimit ? ' Near range limit: try Balanced or Drive.' : ''}`;
        document.getElementById('kick-air').textContent = air;
        document.getElementById('kick-situation').textContent = `${rush} rush · ${this.protectionLane === this.situation.rush ? 'Covered (+0.75s).' : 'Choose the matching lane.'}`;
        this.button.disabled = this.paused || ['flight', 'complete'].includes(this.state);
        this.pauseButton.disabled = !['running', 'accuracy', 'flight'].includes(this.state);
        this.pauseButton.textContent = this.paused ? 'Resume · P' : 'Pause · P';
        this.updateCoach();
        this.button.textContent = {ready: this.attempts ? 'Next snap' : 'Snap ball', running: 'Lock power', accuracy: 'Kick!', flight: 'Ball in the air…', complete: 'Round complete'}[this.state];
        document.getElementById('kick-zone').style.width = `${this.zoneWidth * 100}%`;
        document.getElementById('kick-zone').style.left = `${this.zoneCenter * 100}%`;
        this.marker.style.left = `${this.position * 100}%`;
        const history = document.getElementById('kick-history');
        history.replaceChildren(...Array.from({length: 5}, (_, i) => {
            const item = document.createElement('li');
            const shot = this.history[i];
            item.textContent = `${this.physics.distanceFor(i)} ${shot ? (shot.outcome === 'good' ? '✓' : '×') : '·'}`;
            item.dataset.result = shot?.outcome || 'pending';
            item.setAttribute('aria-label', `${this.physics.distanceFor(i)} yards: ${shot?.outcome || 'pending'}`);
            item.title = item.getAttribute('aria-label');
            return item;
        }));
    }

    act() {
        if (this.paused) return;
        if (this.state === 'ready') {
            cancelAnimationFrame(this.frame);
            this.state = 'running';
            this.lastResult = null;
            this.shot = null;
            this.shotProgress = 0;
            this.startedAt = performance.now();
            this.stageStartedAt = this.startedAt;
            this.crossedMidfield = false;
            this.zoneCenter = this.minimumPower + this.zoneWidth / 2;
            this.status.textContent = 'Snap! Lock enough power, then steer the aiming dot between the posts. Watch the rush.';
            this.updateDisplay();
            this.tick(this.startedAt);
            if (matchMedia('(max-width: 900px)').matches) this.canvas.scrollIntoView({block: 'start', behavior: 'instant'});
        } else if (this.state === 'running') {
            this.power = this.position;
            this.state = 'accuracy';
            this.position = 0.5; this.steeringKeys.clear();
            this.stageStartedAt = performance.now();
            this.zoneCenter = this.accuracyCenter;
            this.status.textContent = 'Power locked. Hold Left/Right or A/D to steer the aiming dot into the opening. Release before the rush arrives!';
            this.updateDisplay();
        } else if (this.state === 'accuracy') {
            this.launch();
        }
    }

    launch(timeout = false) {
        this.elapsed = (performance.now() - this.startedAt) / 1000;
        this.shot = this.physics.resolve({distance: this.distance, power: this.power ?? 0, hash: this.hash, aim: this.aim, accuracy: 0, wind: this.liveWind, headwind: this.situation.headwind, loft: this.loft, release: timeout ? this.protection : this.elapsed + 0.82, protection: this.protection});
        this.lastResult = this.shot.outcome === 'good';
        this.steeringKeys.clear();
        this.targetX = 300 + this.shot.offset * 390;
        this.state = 'flight';
        this.flightElapsed = 0;
        this.flightStartedAt = performance.now();
        this.status.textContent = this.shot.outcome === 'blocked' ? 'The defense gets a hand on it!' : 'The kick is up…';
        this.updateDisplay();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            cancelAnimationFrame(this.frame);
            this.shotProgress = 1;
            this.finishKick();
        }
    }

    tick(now) {
        if (this.paused) return;
        const dt = Math.min(0.05, Math.max(0, (now - (this.lastTick || now)) / 1000)); this.lastTick = now;
        if (['running', 'accuracy'].includes(this.state)) {
            this.elapsed = (now - this.startedAt) / 1000;
            if (this.elapsed + 0.82 >= this.protection) this.launch(true);
            else {
                if (this.state === 'running') {
                    const period = 1100;
                    const phase = (now - this.stageStartedAt) / period % 2;
                    const sweep = phase <= 1 ? phase : 2 - phase;
                    this.position = this.rule.variant === 'accelerate' ? sweep * sweep : this.rule.variant === 'ice' ? Math.pow(sweep, 0.55) : sweep;
                } else {
                    const direction = Number(this.steeringKeys.has('d') || this.steeringKeys.has('arrowright')) - Number(this.steeringKeys.has('a') || this.steeringKeys.has('arrowleft'));
                    if (direction) this.setAim(this.aim + direction * dt * 0.6);
                    this.position = 0.5;
                }
                this.marker.style.left = `${this.position * 100}%`;
                document.getElementById('kick-zone').style.left = `${this.zoneCenter * 100}%`;
                document.getElementById('kick-rush').textContent = `${this.rival.short} rush: ${Math.max(0, this.protection - this.elapsed - 0.82).toFixed(1)}s`;
                this.updateCoach(); this.draw();
            }
        } else if (this.state === 'flight') {
            this.flightElapsed = Math.max(0, (now - this.flightStartedAt) / 1000);
            this.strikeProgress = Math.min(1, this.flightElapsed / 1.1);
            // Give the plant, backswing and follow-through room to read. Contact is 820ms.
            this.shotProgress = Math.max(0, Math.min(1, (this.flightElapsed - 0.82) / 2.1));
            this.draw();
            if (this.flightElapsed >= 3.6) { this.finishKick(); return; }
        } else return;
        if (['running', 'accuracy', 'flight'].includes(this.state)) this.frame = requestAnimationFrame(time => this.tick(time));
    }

    finishKick() {
        if (this.state !== 'flight') return;
        if (this.lastResult) this.points += 3;
        this.history.push({...this.shot, distance: this.distance, hash: this.hash});
        if (this.points > this.best) {
            this.best = this.points;
            try { window.teamArcade.storage.setItem('fieldGoalBest', String(this.best)); } catch { /* Session best is still available. */ }
        }
        this.attempts++;
        const result = {good: 'It is good! +3 points.', blocked: 'Blocked! Try a higher arc or release sooner.', short: 'Short! Use more power or a lower arc.', left: 'Wide left. Adjust aim right or improve accuracy.', right: 'Wide right. Adjust aim left or improve accuracy.'}[this.shot.outcome];
        if (this.attempts === 5) { this.state = 'complete'; this.updateDisplay(); this.draw(); }
        else this.prepare();
        this.status.textContent = this.state === 'complete' ? `${result} Round complete: ${this.points} of 15 points. Use New round to play again.` : `${result} Next: ${this.distance} yards.`;
        document.dispatchEvent(new Event('arcade:progress'));
    }

    updateCoach() {
        const power = this.state === 'running' ? this.position : this.power;
        const range = Math.round(this.physics.rangeFor(power ?? 0, this.loft, this.situation.headwind));
        const inside = Math.abs(this.liveOffset) <= this.physics.openingFor(this.distance);
        document.getElementById('kick-flight-read').textContent = inside ? 'DOT IN GREEN' : `STEER ${this.liveOffset > 0 ? 'LEFT' : 'RIGHT'}`;
        this.coach.textContent = this.paused ? 'Paused · Your meter and rush are frozen' : this.state === 'running' ? `${Math.round(this.position * 100)}% power · ${range} yd range · ${range >= this.distance ? 'ENOUGH DISTANCE — lock power' : 'SHORT — build more power'}` : this.state === 'accuracy' ? `${range} yd range · Wind ${Math.round(Math.abs(this.liveWind) * 100)} ${this.liveWind < 0 ? 'left' : 'right'} · ${Math.max(0, this.protection - this.elapsed - 0.82).toFixed(1)}s to release` : this.state === 'flight' ? 'Watch the flight — each good kick earns 3 points' : this.state === 'complete' ? `${this.points} / 15 points · Start a new round to try again` : 'Snap when ready. Then lock power in the green zone.';
    }

    get animationTime() {
        return this.elapsed + (this.state === 'flight' ? this.flightElapsed || 0 : 0);
    }

    defenseActors() {
        const {ballX, ballY, lineX} = this.formation;
        const active = ['running', 'accuracy', 'flight'].includes(this.state);
        const time = active ? this.animationTime : 0;
        const surge = Math.min(1, time / this.protection);
        const engage = Math.min(1, time / 0.3);
        const flight = this.state === 'flight';
        const blocked = this.shot?.outcome === 'blocked';
        // A block reaches its apex at the actual ball/hand collision, then lands.
        const jumpProgress = flight ? Math.min(1, Math.max(0, blocked ? this.shotProgress : (this.flightElapsed - 0.67) / 0.7)) : 0;
        const actors = [];
        // Three fixed protection lanes, each with its own opposing defender.
        // The announced rush identifies the defender that breaks through, not a
        // fourth body floating between the center and a guard.
        const drive = active ? Math.max(0, time - 0.3) * 2.5 : 0;
        const contact = lineX + 12 - drive;
        const selectedLane = this.situation.rush;
        const otherLanes = [-1, 0, 1].filter(lane => lane !== selectedLane);
        for (const lane of [-1, 0, 1]) {
            const y = ballY + lane * 88;
            const middle = lane === 0;
            actors.push({role: middle ? 'snapper' : 'lineman', variant: lane === 1 ? 1 : 0,
                x: contact - 32, y,
                action: middle ? 'snapBlock' : active ? 'block' : 'protect',
                progress: middle ? Math.min(1, time / 0.75) : engage});
            const breaking = lane === selectedLane;
            const variant = breaking ? 1 : otherLanes.indexOf(lane) === 0 ? 0 : 2;
            const advance = breaking && active ? surge * 12 : 0;
            actors.push({role: 'rusher', teamId: this.rival.id, variant,
                x: contact + 32 - advance, y, flip: true,
                action: breaking && flight && jumpProgress > 0 && jumpProgress < 1 ? 'jump' : active ? 'block' : 'protect',
                progress: breaking && flight && jumpProgress > 0 && jumpProgress < 1 ? jumpProgress : engage});
        }
        // The holder faces back toward the approaching kicker from the other
        // side of the spot. His torso and planted knee stay out of the swing.
        const setHand = footballPlayers.hand('holder', -38, -106, 76, 106, {action: 'holder', progress: 1, flip: true});
        actors.push({role: 'holder', x: ballX - setHand.x, y: ballY, flip: true,
            action: 'holder', progress: Math.min(1, time / 0.42)});
        return actors;
    }

    drawDefense() {
        const ctx = this.ctx, {ballX} = this.formation;
        this.defenseActors().sort((a, b) => a.y - b.y).forEach(p => {
            ctx.fillStyle = '#001c2255'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, 25, 7, 0, 0, Math.PI * 2); ctx.fill();
            footballPlayers.draw(ctx, p.role, p.x - 38, p.y - 106, 76, 106, {
                teamId: p.teamId, variant: p.variant || 0, flip: p.flip, action: p.action,
                progress: p.progress, time: this.animationTime, stride: p.stride
            });
        });

    }

    kickerPose() {
        const {ballX, ballY} = this.formation;
        const t = this.state === 'flight' ? this.flightElapsed || 0 : 0;
        const contact = footballPlayers.foot('kicker', -38, -116, 76, 116, {action: 'kick', progress: 0.5});
        const plantX = ballX - contact.x;
        const approach = Math.min(1, t / 0.36);
        return {
            x: ballX - 120 + (plantX - ballX + 120) * approach,
            y: ballY + (-7 - contact.y) * approach,
            action: t > 0 && t < 0.36 ? 'run' : t >= 0.36 ? 'kick' : 'idle',
            progress: Math.min(1, Math.max(0, (t - 0.36) / 0.92)),
            stride: (plantX - ballX + 120) * approach / (36 / 0.6 * 116 / 110)
        };
    }

    // Keep a wide setup view, then dissolve into a view along the field at contact.
    // Both views use the same resolved offset; the post opening matches the physics exactly.
    flightGeometry(width, height, progress = this.shotProgress) {
        const opening = this.physics.openingFor(this.distance);
        const half = width * 0.135;
        const offset = this.shot?.offset || 0;
        const t = Math.max(0, Math.min(1, progress));
        const startX = width * (0.5 + this.hash * 0.075);
        const endX = width / 2 + offset / opening * half;
        const crossbar = height * 0.42;
        const short = this.shot?.outcome === 'short';
        const endY = short ? height * 0.69 : crossbar - height * 0.085;
        const arc = height * {drive: 0.12, balanced: 0.24, high: 0.34}[this.loft];
        return {half, crossbar, x: startX + (endX - startX) * t,
            y: height * 0.9 + (endY - height * 0.9) * t - arc * Math.sin(Math.PI * t),
            groundY: height * 0.9 + ((short ? height * 0.79 : height * 0.56) - height * 0.9) * t};
    }

    drawFlightEndzone(c, fieldPoint) {
        // Render the same paint used by the setup camera, then project it onto the turf.
        // Refresh the small source canvas so asynchronously loaded logos stay current.
        if (!this.flightPaint) {
            this.flightPaint = document.createElement('canvas');
            this.flightPaint.width = 880; this.flightPaint.height = 240;
        }
        const source = this.flightPaint, paint = source.getContext('2d');
        paint.clearRect(0, 0, source.width, source.height);
        paint.save(); paint.translate(source.width, 0); paint.rotate(Math.PI / 2);
        footballField.endzone(paint, 0, 0, source.height, source.width, teamArcade.team);
        paint.restore();
        for (let row = 0; row < source.height; row += 2) {
            const far = fieldPoint(-1, row / source.height * 0.13);
            const right = fieldPoint(1, row / source.height * 0.13);
            const near = fieldPoint(-1, (row + 2) / source.height * 0.13);
            c.drawImage(source, 0, row, source.width, 2, far.x, far.y, right.x - far.x, near.y - far.y + 0.5);
        }
        c.strokeStyle = '#f2f4e8'; c.lineWidth = 2;
        c.beginPath();
        for (const [i, p] of [fieldPoint(-1, 0), fieldPoint(1, 0), fieldPoint(1, 0.13), fieldPoint(-1, 0.13)].entries()) {
            if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
        }
        c.closePath(); c.stroke();
    }

    drawFlight(width, height) {
        const c = this.ctx, t = this.shotProgress;
        const {half, crossbar, x, y, groundY} = this.flightGeometry(width, height);
        const center = width / 2, horizon = height * 0.29;
        const sky = c.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#081d32'); sky.addColorStop(0.5, '#36556b'); sky.addColorStop(1, '#aac2c2');
        c.fillStyle = sky; c.fillRect(0, 0, width, height);
        // Curved stands, aisle breaks and deterministic crowd specks remain stable in flight.
        c.fillStyle = '#132e3d'; c.beginPath(); c.moveTo(0, height * 0.16);
        c.quadraticCurveTo(center, height * 0.34, width, height * 0.16);
        c.lineTo(width, height * 0.48); c.lineTo(0, height * 0.48); c.fill();
        for (let row = 0; row < 7; row++) {
            c.fillStyle = row % 2 ? '#c6d5cd55' : '#88b9b35c';
            for (let col = 0; col < 70; col++) {
                if (col % 15 === 0) continue;
                c.fillRect(col * width / 70, horizon + row * height * 0.018, width * 0.004, height * 0.005);
            }
        }
        const fieldPoint = (across, depth) => ({x: center + across * width * (0.27 + depth * 0.38), y: height * (0.49 + depth * 0.55)});
        const patch = (near, far, color) => {
            const points = [fieldPoint(-1, far), fieldPoint(1, far), fieldPoint(1, near), fieldPoint(-1, near)];
            c.fillStyle = color; c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill();
        };
        c.fillStyle = '#334d47'; c.fillRect(0, height * 0.46, width, height);
        patch(1.1, 0, '#246746');
        const depthForYard = yard => 0.13 + yard / 70 * 0.97;
        for (let yard = 0; yard < 65; yard += 5) {
            patch(depthForYard(yard + 5), depthForYard(yard), yard % 10 ? '#2d7951' : '#276e4a');
            const a = fieldPoint(-1, depthForYard(yard)), b = fieldPoint(1, depthForYard(yard));
            c.strokeStyle = '#f1f5e2ba'; c.lineWidth = yard === 0 ? 3 : 1.8;
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
        // One-yard hashes and sideline ticks follow the same ground plane as
        // the five-yard stripes. Their width grows toward the camera.
        c.strokeStyle = '#f1f5e2d9'; c.lineWidth = 1.6;
        for (let yard = 1; yard < 60; yard++) {
            if (yard % 5 === 0) continue;
            const depth = depthForYard(yard);
            for (const across of [-0.115, 0.115, -0.965, 0.965]) {
                const a = fieldPoint(across - 0.014, depth), b = fieldPoint(across + 0.014, depth);
                c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
            }
        }
        // Fine mowing grain follows the field plane rather than shimmering with time.
        c.fillStyle = '#b6d5a312';
        for (let i = 0; i < 420; i++) {
            const depth = ((i * 73) % 419) / 419;
            const p = fieldPoint(((i * 37) % 211) / 105.5 - 1, depth);
            c.fillRect(p.x, p.y, width * (0.0008 + depth * 0.0013), 1);
        }
        // Large ten-yard numerals are painted onto the turf, with a matching
        // perspective shear rather than small upright labels floating over it.
        for (let yard = 10; yard <= 50; yard += 10) {
            const depth = depthForYard(yard);
            for (const across of [-0.73, 0.73]) {
                const p = fieldPoint(across, depth);
                c.save(); c.translate(p.x, p.y);
                c.transform(1, 0, across * 0.55, 0.76, 0, 0);
                const numeralSize = Math.min(width * (0.055 + depth * 0.025), height * (0.065 + depth * 0.02));
                c.font = `900 ${numeralSize}px Arial Black, Arial`;
                c.textAlign = 'center'; c.textBaseline = 'middle';
                c.fillStyle = '#f4f5e8'; c.fillText(String(yard), 0, 0);
                c.restore();
                if (yard < 50) {
                    const arrow = fieldPoint(across + (across < 0 ? 0.15 : -0.15), depth);
                    const size = width * (0.007 + depth * 0.003);
                    c.fillStyle = '#f4f5e8'; c.beginPath();
                    c.moveTo(arrow.x, arrow.y - size); c.lineTo(arrow.x - size, arrow.y + size * 0.65);
                    c.lineTo(arrow.x + size, arrow.y + size * 0.65); c.closePath(); c.fill();
                }
            }
        }
        this.drawFlightEndzone(c, fieldPoint);
        for (const side of [-1, 1]) {
            const a = fieldPoint(side, 0), b = fieldPoint(side, 1.1);
            c.strokeStyle = '#eff4e4'; c.lineWidth = 3;
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
        // Ground shadow separates depth from height, especially for a short attempt.
        c.fillStyle = '#06282266'; c.beginPath(); c.ellipse(x, groundY, width * (0.018 - t * 0.01), height * 0.006, 0, 0, Math.PI * 2); c.fill();
        const post = () => {
            c.beginPath(); c.moveTo(center - half, height * 0.12); c.lineTo(center - half, crossbar);
            c.lineTo(center + half, crossbar); c.lineTo(center + half, height * 0.12);
            c.moveTo(center, crossbar); c.lineTo(center, height * 0.57); c.stroke();
        };
        c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#70521b'; c.lineWidth = width * 0.012; post();
        c.strokeStyle = '#ffdb63'; c.lineWidth = width * 0.008; post();
        c.strokeStyle = '#fff1aa'; c.lineWidth = width * 0.002; post();
        // Wind ribbons flutter independently at the tips while the camera stays fixed.
        for (const side of [-1, 1]) {
            const tipX = center + side * half, tipY = height * 0.12;
            const wind = (this.shot?.offset || 0) - this.aim - this.physics.hashBias(this.distance, this.hash);
            const direction = wind < 0 ? -1 : 1;
            const wave = Math.sin(this.flightElapsed * 9 + side) * height * 0.004;
            c.fillStyle = '#f9be49'; c.beginPath(); c.moveTo(tipX, tipY);
            c.quadraticCurveTo(tipX + direction * width * 0.015, tipY + wave, tipX + direction * width * 0.028, tipY + height * 0.008 + wave);
            c.lineTo(tipX + direction * width * 0.016, tipY + height * 0.012); c.closePath(); c.fill();
        }
        // A fading ribbon shows curvature without obscuring the ball or post edges.
        c.save(); c.beginPath(); c.rect(0, 0, width, height); c.clip();
        for (let i = 12; i > 0; i--) {
            const past = Math.max(0, t - i * 0.009);
            const a = this.flightGeometry(width, height, past), b = this.flightGeometry(width, height, Math.min(t, past + 0.009));
            c.strokeStyle = `rgba(255,238,184,${(1 - i / 13) * 0.55})`; c.lineWidth = width * 0.004;
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
        footballArt.draw(c, x, y, footballArt.kickFlightWidth * width / 1064, -0.4 + t * 9);
        c.restore();
        c.textAlign = 'center'; c.fillStyle = '#f1f5ef'; c.font = `700 ${width * 0.027}px Arial`;
        c.fillText(`${this.distance} YARDS · ${t < 1 ? 'BALL IN FLIGHT' : {good: 'GOOD! +3', left: 'WIDE LEFT', right: 'WIDE RIGHT', short: 'SHORT'}[this.shot.outcome]}`, center, height * 0.07);
        // Offscreen misses keep a visible ball marker at the appropriate edge.
        if (x < width * 0.03 || x > width * 0.97) {
            const edge = Math.max(width * 0.035, Math.min(width * 0.965, x));
            c.fillStyle = '#ffdf91'; c.beginPath(); c.arc(edge, y, width * 0.014, 0, Math.PI * 2); c.fill();
        }
    }

    draw() {
        const c = this.ctx;
        const mobile = matchMedia('(max-width: 600px)').matches;
        const width = mobile ? 720 : 1064, height = mobile ? 720 : 552;
        c.save();
        c.scale(1064 / width, 552 / height);
        c.fillStyle = '#102b35'; c.fillRect(0, 0, width, height);
        c.save();
        const scale = width / 1064;
        c.translate(0, (height - 552 * scale) / 2); c.scale(scale, scale);
        this.drawSide(); c.restore();
        if (this.state === 'flight' && this.shot?.outcome !== 'blocked' && this.flightElapsed >= 0.82) {
            const blend = Math.min(1, (this.flightElapsed - 0.82) / 0.24);
            c.globalAlpha = blend * blend * (3 - 2 * blend);
            this.drawFlight(width, height); c.globalAlpha = 1;
        }
        if (this.paused) {
            c.fillStyle = '#071e30cc'; c.fillRect(0, 0, width, height); c.fillStyle = '#fff';
            c.textAlign = 'center'; c.font = '900 36px Arial'; c.fillText('PAUSED', width / 2, height / 2);
        }
        c.restore();
    }

    drawSide() {
        const ctx = this.ctx;
        const {ballX: kickX, ballY: kickY, goalX, lineX} = this.formation;
        const sky = ctx.createLinearGradient(0, 0, 0, 300);
        sky.addColorStop(0, window.teamArcade.tint('#062735'));
        sky.addColorStop(1, window.teamArcade.team.primary);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 1064, 552);
        ctx.fillStyle = '#ffffff55';
        for (let row = 0; row < 5; row++) {
            for (let x = 12 + row % 2 * 10; x < 1064; x += 20) ctx.fillRect(x, 100 + row * 17, 8, 6);
        }
        ctx.fillStyle = '#26735c';
        ctx.fillRect(0, 235, 1064, 317);
        for (let yard = 10; yard <= 80; yard += 5) {
            const x = goalX - yard * 12;
            ctx.fillStyle = yard % 10 === 0 ? '#ffffff08' : '#00000008';
            ctx.fillRect(x, 235, 60, 317);
            ctx.strokeStyle = '#e2efdf80'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x, 235); ctx.lineTo(x, 552); ctx.stroke();
            for (const y of [352, 448]) { ctx.beginPath(); ctx.moveTo(x + 25, y); ctx.lineTo(x + 35, y); ctx.stroke(); }
        }
        footballField.endzone(ctx, goalX - 120, 235, 120, 317, teamArcade.team);
        ctx.fillStyle = '#576862'; ctx.fillRect(goalX + 2, 235, 142, 317);
        for (const yy of [240, 547]) for (const xx of [goalX - 120, goalX]) footballField.pylon(ctx, xx, yy);
        window.teamArt.atmosphere(ctx, 1064, 190, this.position * 100);
        ctx.strokeStyle = '#ffda65'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(865, 75); ctx.lineTo(865, 235); ctx.lineTo(975, 265); ctx.lineTo(975, 105);
        ctx.moveTo(920, 250); ctx.lineTo(920, 365); ctx.stroke();
        if (this.state === 'ready') {
            ctx.strokeStyle = '#ffe699'; ctx.setLineDash([7, 8]); ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(kickX, kickY); ctx.quadraticCurveTo((kickX + goalX) / 2, this.loft === 'high' ? -25 : this.loft === 'drive' ? 210 : 90, goalX, 190 + this.liveOffset * 180); ctx.stroke();
            ctx.setLineDash([]);
        }
        if (['ready', 'running', 'accuracy'].includes(this.state)) {
            // One horizontal aiming guide gives Left/Right their literal screen direction.
            const x = 820, y = 62, span = 130;
            const opening = Math.min(span, this.physics.openingFor(this.distance) * span);
            const inside = Math.abs(this.liveOffset) <= this.physics.openingFor(this.distance);
            ctx.fillStyle = '#09252df2'; ctx.beginPath(); ctx.roundRect(640, 14, 380, 100, 10); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '700 17px Arial';
            ctx.fillText(this.state === 'accuracy' ? 'STEER, THEN KICK' : 'AIMING GUIDE', 830, 39);
            ctx.strokeStyle = '#77969a'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(x - span, y); ctx.lineTo(x + span, y); ctx.stroke();
            ctx.fillStyle = '#b9f1cd'; ctx.fillRect(x - opening, y - 8, opening * 2, 16);
            const markerX = x + Math.max(-1, Math.min(1, this.liveOffset)) * span;
            ctx.fillStyle = '#fff'; ctx.strokeStyle = '#10252c'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(markerX, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = '15px Arial';
            ctx.fillText(inside ? 'Dot in green = on target' : `Steer ${this.liveOffset > 0 ? 'LEFT' : 'RIGHT'} to reach green`, 830, 98);
        }
        this.drawDefense();
        const kicker = this.kickerPose();
        ctx.fillStyle = '#001c2255'; ctx.beginPath(); ctx.ellipse(kicker.x, kicker.y + 3, 25, 7, 0, 0, Math.PI * 2); ctx.fill();
        footballPlayers.draw(ctx, 'kicker', kicker.x - 38, kicker.y - 116, 76, 116, {
            action: kicker.action, time: this.animationTime, progress: kicker.progress, stride: kicker.stride
        });
        const progress = this.shotProgress;
        const blocked = this.shot?.outcome === 'blocked';
        const short = this.shot?.outcome === 'short';
        const endX = blocked ? kickX + 105 : short ? kickX + (goalX - kickX) * 0.73 : goalX;
        let ballX = kickX + (endX - kickX) * progress;
        const offset = this.shot?.offset || 0;
        const endY = blocked ? 450 : short ? 410 : 190 + offset * 180;
        let ballY = kickY - 7 + (endY - kickY + 7) * progress - (this.loft === 'high' ? 250 : this.loft === 'drive' ? 90 : 180) * Math.sin(Math.PI * progress);
        if (blocked) {
            // The ball meets the free rusher's raised hand, then drops after contact.
            const rusher = this.defenseActors().find(p => p.role === 'rusher' && p.variant === 1);
            // Sample the apex from the same rig used to draw this defender.
            const hand = footballPlayers.hand('rusher', rusher.x - 38, rusher.y - 106, 76, 106,
                {teamId: this.rival.id, variant: 1, action: 'jump', progress: 0.5, flip: true});
            const handX = hand.x, handY = hand.y;
            if (progress <= 0.5) {
                const t = progress * 2;
                ballX = kickX + (handX-kickX)*t;
                ballY = kickY-7+(handY-kickY+7)*t-25*Math.sin(Math.PI*t);
            } else {
                const t = (progress-0.5)*2;
                ballX = handX+(kickX+105-handX)*t; ballY=handY+(kickY+50-handY)*t*t;
            }
        }
        const snap = Math.min(1, this.animationTime / 0.3);
        const holder = this.defenseActors().find(p => p.role === 'holder');
        const holderHand = footballPlayers.hand('holder', holder.x - 38, holder.y - 106, 76, 106,
            {action: 'holder', progress: holder.progress, flip: holder.flip});
        const snapper = this.defenseActors().find(p => p.role === 'snapper');
        const snapHand = footballPlayers.hand('snapper', snapper.x - 38, snapper.y - 106, 76, 106,
            {action: 'snapBlock', progress: 0});
        const snapX = snapHand.x + (holderHand.x - snapHand.x) * snap;
        const snapY = snapHand.y + (holderHand.y + 10 - snapHand.y) * snap - Math.sin(snap * Math.PI) * 12;
        const released = this.state === 'flight' && progress > 0;
        footballArt.draw(ctx, released ? ballX : snapX, released ? ballY : snapY, footballArt.gameplayWidth, released ? -0.6 + progress * 5 : Math.PI / 2);
        if (this.state === 'ready') {
            ctx.textAlign = 'center'; ctx.font = '700 16px Arial';
            for (const [label, x, y] of [['KICKER', kicker.x, kicker.y], ['HOLDER', holder.x, holder.y]]) {
                ctx.fillStyle = '#09252de8'; ctx.beginPath(); ctx.roundRect(x - 43, y + 15, 86, 27, 5); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.fillText(label, x, y + 34);
            }
            ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '700 20px Arial';
            ctx.fillText('KICK TOWARD THE POSTS', 24, 42);
        }
        if (this.state === 'ready' && this.history.length || this.state === 'complete') {
            const outcome = this.history.at(-1)?.outcome;
            ctx.fillStyle = '#09252de8'; ctx.beginPath(); ctx.roundRect(340, 65, 360, 66, 10); ctx.fill();
            ctx.textAlign = 'center'; ctx.fillStyle = outcome === 'good' ? '#b9f1cd' : '#ffccad'; ctx.font = '900 28px Arial';
            ctx.fillText({good: 'GOOD! +3', short: 'SHORT', blocked: 'BLOCKED', left: 'WIDE LEFT', right: 'WIDE RIGHT'}[outcome] || '', 520, 108);
        }
    }
}

document.kickGame = new FieldGoalGame();
