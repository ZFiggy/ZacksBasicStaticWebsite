class Playbook {
    constructor() {
        const requested = new URLSearchParams(location.search).get('game');
        this.id = Object.hasOwn(window.playbookGames, requested) ? requested : 'pocket';
        this.config = window.playbookGames[this.id];
        this.profile = window.teamArcade.personality;
        this.rule = window.teamArcade.ruleFor(this.id);
        this.stage = document.getElementById('playbook-stage');
        this.controls = document.getElementById('playbook-controls');
        this.status = document.getElementById('playbook-status');
        this.start = document.getElementById('playbook-start');
        this.timers = new Set();
        this.generation = 0;
        this.score = 0;
        this.active = false;
        document.title = `${this.config.title} · ${window.teamArcade.team.name} · Sunday Arcade`;
        document.getElementById('game-title').textContent = this.config.title.toUpperCase();
        document.getElementById('game-tagline').textContent = this.config.tagline;
        document.getElementById('playbook-rules').textContent = this.config.rules;
        document.getElementById('playbook-mode').textContent = this.config.title.toUpperCase();
        document.getElementById('score-label').textContent = this.config.unit.toUpperCase();
        window.teamArcade.renderGameTabs();
        this.start.addEventListener('click', () => this.reset());
        this.stage.innerHTML = `<div class="playbook-splash"><span>${this.config.mark}</span><h2>${this.config.tagline}</h2><p>${this.config.description}</p><p>Choose Start game to take the field.</p></div>`;
        const splash = this.stage.querySelector('.playbook-splash > span');
        splash.replaceChildren();
        window.teamCharacters.paint(splash, this.id === 'punt' ? 'kicker' : this.id === 'shove' ? 'runner' : 'quarterback');
        window.teamCharacters.world(this.stage, this.id);
        this.status.textContent = 'Your next play starts here.';
        this.showScore();
        this.stage.closest('.playbook-panel').addEventListener('keydown', event => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || !this.active) return;
            if (event.target.matches('input, select, textarea')) return;
            // Native buttons already translate Enter/Space into a single click.
            if (event.target.closest('button') && (event.code === 'Space' || event.key === 'Enter')) return;
            const index = Number(event.key) - 1;
            if (this.id === 'pocket' && index >= 0 && index < 3) { event.preventDefault(); this.pass(index); }
            if (this.id === 'recall' && index >= 0 && index < 4) { event.preventDefault(); this.recallInput(index); }
            if (this.id === 'shove' && event.code === 'Space') { event.preventDefault(); this.push(); }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.active && ['pocket', 'shove', 'recall', 'punt'].includes(this.id)) {
                this.cancel();
                this.active = false;
                this.controls.replaceChildren();
                this.status.textContent = 'Play stopped while this tab was hidden. Your best is saved; start a fresh game when ready.';
            }
        });
        window.addEventListener('pagehide', () => this.cancel());
    }

    later(callback, delay) {
        const generation = this.generation;
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            if (generation === this.generation) callback();
        }, delay);
        this.timers.add(timer);
    }

    cancel() {
        this.generation++;
        this.timers.forEach(clearTimeout);
        this.timers.clear();
        cancelAnimationFrame(this.frame);
    }

    button(label, handler, parent = this.controls) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', handler);
        parent.append(button);
        return button;
    }

    showScore() {
        document.getElementById('playbook-score').textContent = this.score;
        document.getElementById('playbook-best').textContent = `Personal best: ${window.fanArcade.number(`playbook-${this.id}-best`)} ${this.config.unit}`;
    }

    save() {
        const key = `playbook-${this.id}-best`;
        if (this.score > window.fanArcade.number(key)) window.fanArcade.write(key, this.score);
        this.showScore();
        document.dispatchEvent(new Event('arcade:progress'));
    }

    finish(message) {
        this.active = false;
        this.cancel();
        this.controls.querySelectorAll('button, input').forEach(control => { control.disabled = true; });
        this.save();
        this.status.textContent = `${message} Final: ${this.score} ${this.config.unit}. Play again to chase your best.`;
        this.start.textContent = 'Play again';
    }

    reset() {
        this.cancel();
        this.score = 0;
        this.fieldLocked = false;
        this.active = true;
        this.controls.replaceChildren();
        this.stage.replaceChildren();
        this.start.textContent = 'Restart game';
        this.showScore();
        this[this.id]();
        this.stage.focus({ preventScroll: true });
        this.stage.dataset.team = window.teamArcade.team.id;
        this.personalizeStage();
        window.teamCharacters.world(this.stage, this.id);
    }

    personalizeStage() {
        const names = {
            pocket: `${this.profile.quarterback.name} reads the rush from ${this.profile.defender.name}.`,
            shove: `${this.profile.runner.name} follows the line. One yard, together.`,
            recall: `${this.profile.quarterback.name} calls it. ${this.profile.runner.name} runs it.`,
            punt: `${window.teamArcade.team.city} special teams: hang time, wind, and a soft bounce.`,
            blitz: `${this.profile.quarterback.name} versus ${this.profile.defender.name}. Your move.`,
            signal: this.profile.gameHooks.signal
        };
        const note = document.createElement('p');
        note.className = 'on-field-story';
        note.textContent = names[this.id];
        this.stage.prepend(note);
        if (this.id === 'pocket') {
            const qb = this.stage.querySelector('.pocket-qb');
            const number = document.createElement('b'); number.textContent = this.profile.quarterback.number;
            const name = document.createElement('span'); name.textContent = this.profile.quarterback.name;
            qb.replaceChildren(number, name);
            window.teamCharacters.paint(qb, 'quarterback');
        }
        if (this.id === 'shove') {
            const pile = this.stage.querySelector('#shove-pile'); pile.replaceChildren();
            for (const number of [63, this.profile.quarterback.number, 65]) {
                const jersey = document.createElement('span'); jersey.className = 'line-jersey'; jersey.textContent = ''; pile.append(jersey);
                window.teamCharacters.paint(jersey, number === this.profile.quarterback.number ? 'quarterback' : 'defender');
            }
            this.stage.querySelector('.endzone-label').textContent = `${window.teamArcade.team.short} · ${this.profile.runner.name.toUpperCase()} · THE LAST YARD`;
        }
        if (this.id === 'recall') {
            const routes = ['M8 40L28 23L56 7', 'M8 40V13H58', 'M56 40V24L16 6', 'M32 42V5'];
            this.pads.forEach((pad, i) => {
                const label = document.createElement('span'); label.textContent = pad.textContent;
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 68 48'); svg.setAttribute('class', 'route-diagram'); svg.setAttribute('aria-hidden', 'true');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', routes[i]); svg.append(path);
                pad.replaceChildren(svg, label);
                window.teamCharacters.paint(pad, 'runner');
            });
        }
        if (this.id === 'punt') window.teamCharacters.paint(this.stage.querySelector('.punt-flight'), 'kicker');
        if (this.id === 'signal') {
            const caller = document.createElement('div');
            caller.className = 'signal-caller';
            window.teamCharacters.paint(caller, 'quarterback');
            this.stage.querySelector('.signal-slots').before(caller);
        }
    }

    pocket() {
        this.lives = 3;
        this.snapNumber = 0;
        this.stage.innerHTML = '<div class="pocket-field"><div class="endzone-label">READ · RELEASE · COMPLETE</div><div class="receiver-lanes"></div><div class="pocket-qb">QB</div><div class="snap-clock"><span></span></div></div>';
        this.lanes = [];
        for (let i = 0; i < 3; i++) {
            const lane = document.createElement('div');
            lane.className = 'receiver-lane';
            this.stage.querySelector('.receiver-lanes').append(lane);
            this.lanes.push(lane);
            this.button(`Pass ${i + 1}`, () => this.pass(i));
        }
        this.newSnap();
    }

    newSnap() {
        if (!this.active) return;
        this.stage.querySelector('.pocket-field').classList.remove('is-complete');
        this.snapNumber++;
        this.openLane = Math.floor(Math.random() * 3);
        this.snapLocked = false;
        this.pumped = false;
        this.drawnLane = -1;
        this.snapDuration = Math.max(1800, 4600 - this.score * 220);
        this.snapTime = performance.now();
        this.rotationTime = this.snapTime;
        this.calledLane = (this.snapNumber - 1) % 3;
        this.status.textContent = `Snap ${this.snapNumber} · ${this.lives} hearts. ${this.rule.variant === 'pump' ? 'Fake to COVERED, then throw OPEN.' : this.rule.variant === 'deep' ? 'Wait until half the clock is spent, then throw OPEN.' : `Throw only to called receiver ${this.calledLane + 1}, when OPEN.`} Keys 1–3.`;
        const tick = now => {
            if (!this.active || this.snapLocked) return;
            if (now - this.snapTime >= this.snapDuration) { this.resolvePass(false, 'Sacked! The pocket collapsed.'); return; }
            if (now - this.rotationTime >= (this.rule.variant === 'rhythm' ? Math.max(500, this.snapDuration / 3.5) : Math.max(600, 1150 - this.score * 40))) {
                this.openLane = (this.openLane + (this.rule.variant === 'rhythm' ? 1 : 1 + Math.floor(Math.random() * 2))) % 3;
                this.rotationTime = now;
            }
            if (this.drawnLane !== this.openLane) this.lanes.forEach((lane, i) => {
                lane.classList.toggle('is-open', i === this.openLane);
                lane.innerHTML = `<span class="receiver-jersey">${i + 1}</span><strong>${i === this.openLane ? 'OPEN' : 'COVERED'}</strong><span>${i === this.openLane ? 'Break toward the sideline' : 'Safety in the lane'}</span>`;
            });
            if (this.drawnLane !== this.openLane) this.lanes.forEach(lane => {
                const jersey = lane.querySelector('.receiver-jersey');
                jersey.replaceChildren();
                window.teamCharacters.paint(jersey, 'runner');
            });
            this.drawnLane = this.openLane;
            this.stage.querySelector('.snap-clock span').style.width = `${100 * (1 - (now - this.snapTime) / this.snapDuration)}%`;
            this.frame = requestAnimationFrame(tick);
        };
        tick(this.snapTime);
    }

    pass(index) {
        if (!this.active || this.snapLocked) return;
        if (this.rule.variant === 'pump' && !this.pumped && index !== this.openLane) {
            this.pumped = true;
            this.status.textContent = 'The safety bites! Now find OPEN.';
            return;
        }
        const eligible = this.rule.variant === 'pump' ? this.pumped : this.rule.variant === 'deep' ? performance.now() - this.snapTime >= this.snapDuration / 2 : index === this.calledLane;
        if (!eligible) { this.resolvePass(false, 'The team read was not ready. Follow the snap call.'); return; }
        this.resolvePass(index === this.openLane, index === this.openLane ? `${this.profile.quarterback.name} completes it. Move the chains!` : `${this.profile.defender.name} jumps the route. Picked off!`);
    }

    resolvePass(success, message) {
        this.snapLocked = true;
        this.stage.querySelector('.pocket-field').classList.toggle('is-complete', success);
        cancelAnimationFrame(this.frame);
        if (success) this.score++; else this.lives--;
        this.save();
        if (this.lives === 0 || this.score === 10) { this.finish(this.score === 10 ? 'Ten completions. Drive mastered!' : 'The defense wins this drive.'); return; }
        this.status.textContent = message;
        this.later(() => this.newSnap(), 850);
    }

    shove() {
        this.down = 1;
        this.energy = 100;
        this.inches = 0;
        this.stage.innerHTML = '<div class="shove-field"><div class="endzone-label">BROTHERLY SHOVE · GOAL LINE</div><div class="pile-track"><div id="shove-pile">LINE</div><span>TD</span></div><p id="shove-info"></p><div class="push-meter"><span class="push-window"></span><span class="push-marker"></span></div><p>Hit the mint window. Rest trades a down for energy.</p></div>';
        this.stage.querySelector('#shove-pile').textContent = window.teamArcade.team.short;
        this.button('Snap / Push', () => this.push());
        this.button('Rest one down', () => {
            if (!this.active || this.pushLocked) return;
            this.down++;
            this.energy = Math.min(100, this.energy + 45);
            if (this.down > 3) this.finish('Out of downs.'); else this.shoveDisplay('Fresh legs. Make the next push count.');
        });
        this.meterStart = performance.now();
        this.pushLocked = false;
        this.shoveDisplay('First and goal. Hit the window to move the pile.');
        const tick = now => {
            if (!this.active) return;
            this.meter = (Math.sin((now - this.meterStart) / Math.max(180, 420 - this.score * 30)) + 1) / 2;
            if (this.rule.variant === 'patient') {
                this.windowCenter = 0.5 + Math.sin((now - this.meterStart) / 1100) * 0.22;
                this.stage.querySelector('.push-window').style.left = `${(this.windowCenter - this.windowSize) * 100}%`;
            }
            this.stage.querySelector('.push-marker').style.left = `${this.meter * 100}%`;
            this.frame = requestAnimationFrame(tick);
        };
        tick(this.meterStart);
    }

    shoveDisplay(message) {
        this.windowCenter = this.rule.variant === 'alternate' ? (this.down % 2 ? 0.3 : 0.7) : this.windowCenter || 0.5;
        this.windowSize = Math.max(0.07, this.energy / 600 - this.score * 0.012);
        this.stage.querySelector('.push-window').style.left = `${(this.windowCenter - this.windowSize) * 100}%`;
        this.stage.querySelector('.push-window').style.width = `${this.windowSize * 200}%`;
        const progress = Math.min(1, this.inches / 36);
        this.stage.querySelector('#shove-pile').style.left = `${progress * 100}%`;
        this.stage.querySelector('#shove-pile').style.transform = `translateX(-${progress * 100}%)`;
        this.stage.querySelector('#shove-info').textContent = `Down ${this.down} / 3 · Energy ${this.energy}% · ${this.inches} / 36 inches`;
        this.status.textContent = message;
    }

    push() {
        if (!this.active || this.pushLocked) return;
        this.pushLocked = true;
        const pile = this.stage.querySelector('.shove-field');
        pile.classList.remove('is-pushing');
        void pile.offsetWidth;
        pile.classList.add('is-pushing');
        const accurate = Math.abs(this.meter - this.windowCenter) <= this.windowSize;
        const gain = accurate ? Math.round(14 + this.energy * 0.08) + (this.rule.variant === 'power' ? 5 : 0) : 2;
        this.inches += gain;
        this.energy = Math.max(0, this.energy - (this.rule.variant === 'power' ? 40 : 30));
        if (this.inches >= 36) {
            this.score++;
            this.save();
            this.inches = 0;
            this.energy = 100;
            this.down = 1;
            this.shoveDisplay('TOUCHDOWN! New goal-line series. The snap gets faster.');
        } else {
            this.down++;
            this.shoveDisplay(accurate ? `Together! ${gain} inches gained.` : 'Mistimed snap. Only two inches.');
            if (this.down > 3) { this.finish('Stopped short of the goal line.'); return; }
        }
        this.later(() => { this.pushLocked = false; }, 650);
    }

    recall() {
        this.sequence = [];
        this.stage.innerHTML = '<div class="endzone-label">ROUTE RECALL · WATCH THE CALL</div><p class="route-call" id="route-call"></p><div class="route-pads"></div>';
        this.pads = ['Slant ↗', 'Out ↱', 'Post ↖', 'Go ↑'].map((label, i) => this.button(`${i + 1} · ${label}`, () => this.recallInput(i), this.stage.querySelector('.route-pads')));
        this.replay = this.button('Replay demonstration', () => {
            if (!this.accepting || this.replayed) return;
            this.replayed = true;
            this.demonstrate();
        });
        this.nextSequence();
    }

    nextSequence() {
        this.sequence.push(Math.floor(Math.random() * 4));
        this.reverse = this.rule.variant === 'reverse' && this.sequence.length % 3 === 0;
        this.replayed = false;
        this.demonstrate();
    }

    demonstrate() {
        this.accepting = false;
        this.replay.disabled = true;
        this.pads.forEach(pad => { pad.disabled = true; pad.classList.remove('is-lit'); });
        this.expected = this.reverse ? [...this.sequence].reverse() : [...this.sequence];
        const audible = this.sequence.length % 2 === 0;
        if (audible && this.rule.variant === 'mirror') this.expected = this.expected.map(value => 3 - value);
        if (audible && this.rule.variant === 'rotate') this.expected.push(this.expected.shift());
        if (audible && this.rule.variant === 'pairs') {
            for (let i = 0; i + 1 < this.expected.length; i += 2) [this.expected[i], this.expected[i + 1]] = [this.expected[i + 1], this.expected[i]];
        }
        this.inputIndex = 0;
        this.stage.querySelector('#route-call').textContent = this.reverse ? 'AUDIBLE: enter in REVERSE' : audible && this.rule.variant !== 'reverse' ? `AUDIBLE: ${this.rule.description}` : 'Enter in the SAME order';
        this.status.textContent = `Round ${this.sequence.length} / 8. Watch ${this.sequence.length} routes.`;
        this.sequence.forEach((value, i) => {
            this.later(() => {
                this.pads[value].classList.add('is-lit');
                this.status.textContent = `Watch route ${i + 1}: ${this.pads[value].textContent}.`;
            }, 600 + i * 900);
            this.later(() => this.pads[value].classList.remove('is-lit'), 1200 + i * 900);
        });
        this.later(() => {
            this.accepting = true;
            this.pads.forEach(pad => { pad.disabled = false; });
            this.replay.disabled = this.replayed;
            this.status.textContent = `Your turn. ${this.stage.querySelector('#route-call').textContent}`;
        }, 600 + this.sequence.length * 900);
    }

    recallInput(index) {
        if (!this.active || !this.accepting) return;
        if (index !== this.expected[this.inputIndex]) { this.finish('Wrong route. The play broke down.'); return; }
        this.inputIndex++;
        this.status.textContent = `${this.inputIndex} / ${this.expected.length} routes entered.`;
        if (this.inputIndex === this.expected.length) {
            this.accepting = false;
            this.score++;
            this.save();
            if (this.score === 8) { this.finish('Full playbook mastered, audibles and all!'); return; }
            this.status.textContent = 'Complete! Adding a route.';
            this.replay.disabled = true;
            this.pads.forEach(pad => { pad.disabled = true; });
            this.later(() => this.nextSequence(), 1000);
        }
    }

    punt() {
        this.kicks = 0;
        this.stage.innerHTML = '<div class="punt-field"><div class="endzone-label">COFFIN CORNER · KEEP IT IN PLAY</div><div class="punt-flight"><img id="punt-ball" src="assets/football.svg" alt="Football"><span id="landing-mark">LAND</span><span class="punt-endzone">100 · TD</span></div><div class="punt-yardmarks"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div><p id="punt-report">Set your punt.</p></div>';
        this.controls.innerHTML = '<label>Power <output id="power-value">65</output><input id="punt-power" type="range" min="35" max="100" value="65"></label><label>Loft <output id="loft-value">45°</output><input id="punt-loft" type="range" min="20" max="75" value="45"></label>';
        this.puntButton = this.button('Punt', () => this.kickPunt());
        this.controls.querySelectorAll('input').forEach(input => input.addEventListener('input', () => this.puntPreview()));
        this.newWind();
    }

    newWind() {
        this.wind = Math.floor(Math.random() * 17) - 8;
        this.flying = false;
        this.controls.querySelectorAll('button, input').forEach(control => { control.disabled = false; });
        this.stage.querySelector('#punt-ball').style.cssText = 'left: 0%; bottom: 12%;';
        this.puntPreview();
    }

    puntValues() {
        const power = Number(this.controls.querySelector('#punt-power').value);
        const loft = Number(this.controls.querySelector('#punt-loft').value);
        const radians = loft * Math.PI / 180;
        const air = this.rule.variant === 'altitude' ? 1.18 : 1;
        const drift = this.rule.variant === 'gust' ? (90 - loft) / 35 : 1;
        const landing = power * 1.25 * Math.sin(2 * radians) * air + this.wind * drift;
        const surface = {soft: 0.3, firm: 2, frozen: 3}[this.rule.variant] || 1;
        const roll = (80 - loft) * 0.3 * surface;
        return { power, loft, landing, final: landing + roll };
    }

    puntPreview() {
        const { power, loft, landing } = this.puntValues();
        this.controls.querySelector('#power-value').textContent = power;
        this.controls.querySelector('#loft-value').textContent = `${loft}°`;
        this.stage.querySelector('#landing-mark').style.left = `${Math.max(0, Math.min(96, landing / 1.2))}%`;
        this.status.textContent = `Punt ${this.kicks + 1}/5 · Wind ${this.wind > 0 ? '+' : ''}${this.wind} yd. Landing ${landing.toFixed(1)} yd + roll.`;
    }

    kickPunt() {
        if (!this.active || this.flying) return;
        this.flying = true;
        this.controls.querySelectorAll('button, input').forEach(control => { control.disabled = true; });
        const { landing, final, loft } = this.puntValues();
        const points = final >= 100 || final < 80 ? 0 : Math.max(0, Math.round(100 - Math.abs(98 - final) * 5));
        const start = performance.now();
        const ball = this.stage.querySelector('#punt-ball');
        const tick = now => {
            const t = Math.min(1, (now - start) / 1800);
            const flight = Math.min(1, t / 0.75);
            const x = t < 0.75 ? landing * flight : landing + (final - landing) * ((t - 0.75) / 0.25);
            ball.style.left = `${Math.min(96, Math.max(0, x / 1.2))}%`;
            ball.style.bottom = `${12 + Math.sin(flight * Math.PI) * loft * 0.8}%`;
            if (t < 1) this.frame = requestAnimationFrame(tick);
            else {
                this.kicks++;
                this.score += points;
                this.save();
                const report = `${final.toFixed(1)} yards after the bounce. ${final >= 100 ? 'Touchback!' : final < 80 ? 'Too short.' : 'Pinned deep!'} +${points} points.`;
                this.stage.querySelector('#punt-report').textContent = report;
                if (this.kicks === 5) this.finish('Five punts in the books.');
                else {
                    this.status.textContent = report;
                    this.later(() => this.newWind(), 1400);
                }
            }
        };
        this.frame = requestAnimationFrame(tick);
    }

    signal() {
        this.plays = ['Run', 'Slant', 'Screen', 'Post', 'Go'];
        if (this.rule.variant === 'six') this.plays.push('Option');
        this.code = [];
        while (this.code.length < 3) {
            const play = Math.floor(Math.random() * this.plays.length);
            if (this.rule.variant === 'repeat' || !this.code.includes(play)) this.code.push(play);
        }
        this.guess = [];
        this.attempts = 0;
        this.stage.innerHTML = '<div class="endzone-label">SIDELINE CIPHER · THREE PLAYS</div><div class="signal-slots" aria-label="Current call"></div><ol class="signal-history" aria-label="Previous calls and clues"></ol>';
        this.plays.forEach((play, i) => this.button(play, () => {
            if (!this.active || (this.rule.variant !== 'repeat' && this.guess.includes(i)) || this.guess.length === 3) return;
            this.guess.push(i);
            this.drawCall();
        }));
        this.button('Undo', () => { this.guess.pop(); this.drawCall(); });
        this.send = this.button('Send call', () => this.sendCall());
        this.drawCall();
        this.status.textContent = this.rule.description;
    }

    drawCall() {
        this.stage.querySelector('.signal-slots').textContent = [0, 1, 2].map(i => this.guess[i] === undefined ? '?' : this.plays[this.guess[i]]).join(' / ');
        this.controls.querySelectorAll('button').forEach((button, i) => {
            if (i < this.plays.length) button.disabled = (this.rule.variant !== 'repeat' && this.guess.includes(i)) || this.guess.length === 3;
        });
        this.send.disabled = this.guess.length !== 3;
    }

    sendCall() {
        if (!this.active || this.guess.length !== 3) return;
        const exact = this.guess.filter((play, i) => this.code[i] === play).length;
        const matches = this.plays.reduce((total, _, play) => total + Math.min(this.code.filter(value => value === play).length, this.guess.filter(value => value === play).length), 0);
        const shift = matches - exact;
        this.attempts++;
        const row = document.createElement('li');
        row.textContent = `${this.guess.map(i => this.plays[i]).join(' / ')} — ${exact} EXACT · ${shift} SHIFT`;
        this.stage.querySelector('.signal-history').append(row);
        if (exact === 3) { this.score = 1; this.finish(`Call cracked in ${this.attempts} attempts!`); return; }
        if (this.attempts === 6) { this.finish(`The call was ${this.code.map(i => this.plays[i]).join(' / ')}.`); return; }
        this.status.textContent = `${exact} exact, ${shift} shifted. ${6 - this.attempts} attempts left.`;
        this.guess = [];
        this.drawCall();
    }
}

const playbookMode = new URLSearchParams(location.search).get('game');
document.playbook = (!Object.hasOwn(window.playbookGames, playbookMode) || playbookMode === 'pocket')
    ? (document.passingGame = new PassingGame())
    : new Playbook();
