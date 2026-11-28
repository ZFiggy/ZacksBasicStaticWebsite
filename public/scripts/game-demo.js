// Tutorial choices belong to the browser, independently of the selected team.
(() => {
    const isKick = document.body.classList.contains('kick-page');
    const isPassing = !!document.passingGame;
    if (!isKick && !isPassing && !document.body.classList.contains('rush-page')) return;
    const id = isPassing ? 'passing-drive' : isKick ? 'field-goal' : 'touchdown-rush';
    const name = isPassing ? 'Passing Drive' : isKick ? 'Field Goal' : 'Touchdown Rush';
    const key = `sundayArcade.demo.${id}`;
    let seen = false;
    try { seen = localStorage.getItem(key) === 'answered'; } catch { /* Use the current visit when storage is unavailable. */ }
    const steps = isPassing ? [
        ['Call a route. Snap the ball.', 'Each down changes route depths, spacing, direction, and the defensive look. Choose Slants for quick diagonal breaks, Flood for three depths on one side, or Cross for routes through traffic. The dotted lines preview your routes. Blue marks the line of scrimmage; gold marks the first down. Click Snap or focus the field and press Space to start.'],
        ['Work the pocket. Beat the rush.', 'Hold arrows / WASD or the direction buttons to move the quarterback. Your two blockers can slow two rushers for 2.4 seconds; an overload can send a third rusher unblocked. After that, rushers close in. Release before they reach you or the eight-second pocket clock expires. The quarterback stays behind the blue line until you choose Tuck & run (Q). After tucking, passing is closed. T throws the ball away to avoid a sack; Shift / Sprint gives about 1.8 seconds of burst for the entire play; it refills only on the next down. Defenders catch a jogging runner. P pauses.'],
        ['Lead your receiver.', 'Press 1, 2 or 3, click a receiver button, or tap a receiver on the field. The pass leads the receiver along the route. SPACE on a receiver button means separation; TIGHT means a defender is close. Read the entire passing lane: an underneath defender can still intercept an otherwise open target.'],
        ['Choose your pass. Run after the catch.', 'Use Pass: Bullet / Lob to switch. Bullet is faster but can be intercepted along its path. Lob clears underneath coverage but gives the safety time to close near the catch. After a completion, movement controls switch to the receiver. Dodge defenders and run toward the right end zone, or go out of bounds to end the play.'],
        ['Move the chains. Finish three drives.', 'Each drive starts at your own 25. Gain 10 yards within four downs to earn a new first down. A touchdown scores 6 points. Sacks lose yards; incompletions spend a down; interceptions, safeties or failed fourth downs end the drive. Continue with Next down or Next drive. After three drives, finish the game. Your team’s best and progress between plays are saved.']
    ] : isKick ? [
        ['Read the rush, wind and arc.', 'Before snapping, read the announced rush and choose Protect left, middle or right to buy extra time. Move Aim against the wind and hash angle. Drive travels farther but is easier to block. High arc clears defenders but loses distance and drifts more. Headwinds reduce range; tailwinds add carry.'],
        ['Snap, then lock power.', 'Click Snap ball, tap the field, or focus the field and press Space / Enter. The marker moves. Read the assigned hash mark in the setup panel; Aim for wind & hash suggests the compensation. Use the same snap control again inside the green power zone to lock power. Longer kicks need more power. The live range readout tells you when you have enough.'],
        ['Steer the aiming dot.', 'After locking power, hold Left/Right or A/D, or the touch Aim buttons. Move the white dot into the green zone in the aiming guide above the posts, then press Kick or Space. There is no second timing bar. The aiming dot responds to shifting crosswinds, so you can read when to release.'],
        ['Beat the rush.', 'The rush timer starts at the snap and continues while you aim. Release before it reaches zero; the timer already allows for the kicking windup. Pause / P freezes the meter and rush. A late release or a low trajectory can be blocked; weak power falls short; poor aim goes wide.'],
        ['Five kicks. Make them count.', 'Kick from 25, 33, 40, 47 and 55 yards. Each make earns 3 points; a miss earns 0. Maximum: 15. Later kicks add crosswinds, headwinds, different rush lanes and a smaller opening between the posts. New round starts over; your team’s best is saved. Leaving the tab before release cancels that snap without losing an attempt.']
    ] : [
        ['Find the ball. Run right.', 'Press Start level, then hold arrows / WASD or the direction buttons. Collect the glowing football before entering the right end zone. Space / Wait spends a turn without moving. P or Pause stops play. On phones, drag to scout or choose Full field.'],
        ['You move. Then they chase.', 'Chasers move toward your new position after each step. On burst turns they move twice. Sharing their exact tile causes a tackle, including running into them. Standing next to a chaser is safe. The next-move labels include both burst moves; SAFE means this turn only.'],
        ['Use your blockers.', 'Stationary rival blockers stop your movement; they do not tackle or steal. A blocked move costs no step. Your blockers shield their tile plus four neighbors, forming the outlined green cross. Chasers cannot enter those tiles. Diagonals are not shielded.'],
        ['Watch your step budget.', 'Every move or Wait uses one step and spends 100 bonus points. Score before steps run out. A tackle or an expired budget changes possession: the rival recovers the ball and returns it to the left end zone. Retry field keeps the same layout; Skip return ends the return animation.'],
        ['Earn stars. Keep advancing.', 'Match the shortest route (par) for 3 stars; up to 2 extra steps earns 2 stars; otherwise 1. A touchdown earns 600 points plus 100 per unused step. Each Coach hint costs 250 points and caps stars at 1. Next level advances after a touchdown. Progress and bests are saved for each team.']
    ];
    const dialog = document.createElement('dialog');
    dialog.className = 'game-demo';
    dialog.setAttribute('aria-labelledby', 'demo-title');
    dialog.innerHTML = `<p class="demo-kicker"></p><h2 id="demo-title"></h2><canvas width="640" height="250" role="img" hidden></canvas><p class="demo-copy"></p><p class="demo-team" hidden></p><div class="demo-actions"></div>`;
    document.body.append(dialog);
    const heading = dialog.querySelector('h2');
    const copy = dialog.querySelector('.demo-copy');
    const kicker = dialog.querySelector('.demo-kicker');
    const actions = dialog.querySelector('.demo-actions');
    const canvas = dialog.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    let step = 0, frame, timer, paused = false, previousFocus, suspendedKick;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function button(label, action, primary = false) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = label;
        if (primary) b.dataset.primary = '';
        b.addEventListener('click', action); actions.append(b);
        return b;
    }
    function answer() {
        seen = true;
        try { localStorage.setItem(key, 'answered'); } catch { /* The tutorial remains usable. */ }
    }
    function close() { answer(); dialog.close(); }
    dialog.addEventListener('close', () => {
        cancelAnimationFrame(frame); clearTimeout(timer);
        if (suspendedKick) {
            const g = document.kickGame;
            const delay = performance.now() - suspendedKick;
            g.startedAt += delay; g.stageStartedAt += delay;
            if (g.flightStartedAt) g.flightStartedAt += delay;
            suspendedKick = null;
            g.tick(performance.now());
        }
        previousFocus?.focus({preventScroll: true});
    });
    dialog.addEventListener('cancel', () => { answer(); });
    function showPrompt(replay = false) {
        previousFocus = document.activeElement;
        document.myGame?.pause(true);
        document.passingGame?.pause(true);
        if (isKick && ['running', 'accuracy', 'flight'].includes(document.kickGame.state)) {
            cancelAnimationFrame(document.kickGame.frame);
            suspendedKick = performance.now(); document.kickGame.steeringKeys.clear();
        }
        dialog.showModal();
        heading.textContent = `Want a quick ${name} demo?`;
        kicker.textContent = 'WELCOME TO THE FIELD';
        copy.textContent = 'Watch a simple animated walkthrough of the controls, rules and scoring. No scores or attempts are used.';
        canvas.hidden = true; dialog.querySelector('.demo-team').hidden = true;
        actions.replaceChildren();
        button('Show demo', () => { answer(); step = 0; paused = reduced; showStep(); }, true);
        button(replay ? 'Close' : 'Skip demo', close);
    }
    function schedule() {
        clearTimeout(timer);
        if (!paused && step < steps.length - 1) timer = setTimeout(() => { step++; showStep(); }, 11000);
    }
    function showStep() {
        cancelAnimationFrame(frame); clearTimeout(timer);
        kicker.textContent = `${name.toUpperCase()} DEMO · ${step + 1} OF ${steps.length}`;
        heading.textContent = steps[step][0]; copy.textContent = steps[step][1];
        canvas.hidden = false;
        canvas.setAttribute('aria-label', steps[step][0]);
        const team = dialog.querySelector('.demo-team');
        team.hidden = true;
        team.textContent = isKick ? window.teamArcade.ruleFor('kick').description : '';
        actions.replaceChildren();
        button('Back', () => { step--; showStep(); }).disabled = step === 0;
        if (step < steps.length - 1) {
            button(paused ? 'Play animation' : 'Pause demo', () => { paused = !paused; showStep(); });
            button('Next', () => { step++; showStep(); }, true);
        }
        button(step === steps.length - 1 ? 'Let’s play' : 'Skip demo', close, step === steps.length - 1);
        actions.querySelector('[data-primary]').focus({preventScroll: true});
        draw(performance.now()); schedule();
    }
    function draw(now) {
        const t = paused || reduced ? 0.55 : (now % 5000) / 5000;
        ctx.fillStyle = '#173e34'; ctx.fillRect(0, 0, 640, 250);
        ctx.strokeStyle = '#ffffff33'; ctx.lineWidth = 1;
        for (let x = 20; x < 640; x += 40) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, 220); ctx.stroke(); }
        function label(text, x, y, color = '#fff') { ctx.fillStyle = color; ctx.font = 'bold 17px Arial'; ctx.textAlign = 'center'; ctx.fillText(text, x, y); }
        function dot(x, y, color, text) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.fill(); label(text, x, y + 6, '#10272e'); }
        if (isPassing) {
            ctx.strokeStyle = '#69d6ff'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(160, 40); ctx.lineTo(160, 220); ctx.stroke();
            ctx.strokeStyle = '#ffdb64'; ctx.beginPath(); ctx.moveTo(370, 40); ctx.lineTo(370, 220); ctx.stroke();
            ctx.fillStyle = '#b9f1cd33'; ctx.fillRect(585, 40, 40, 180); label('TD', 605, 140);
            label(['CALL: SLANTS / FLOOD / CROSS', 'MOVE QB · RELEASE BEFORE THE RUSH', '1 / 2 / 3 · LEAD THE ROUTE', 'CATCH → YOU CONTROL THE RECEIVER', '4 DOWNS · 10 YARDS · 6 POINTS'][step], 320, 26);
            if (step === 0 || step === 2) {
                const origins = [65, 130, 195];
                origins.forEach((y, i) => {
                    ctx.strokeStyle = ['#b3f7d1', '#ffdf91', '#bfcfff'][i]; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
                    ctx.beginPath(); ctx.moveTo(160, y); ctx.lineTo(235, y); ctx.lineTo(480, y + (i === 0 ? 50 : -40)); ctx.stroke(); ctx.setLineDash([]);
                    dot(160 + t * 280, y + (i === 0 ? 1 : -1) * Math.max(0, t - 0.25) * 55, '#b9f1cd', String(i + 1));
                });
                dot(360, 90, '#ffb5a4', 'CB'); dot(510, 175, '#ffb5a4', 'S');
                dot(105, 145, '#b9f1cd', 'QB');
                if (step === 2) footballArt.draw(ctx, 120 + t * 320, 145 - Math.sin(t * Math.PI) * 35, 26, -0.2);
            } else if (step === 1) {
                dot(110, 120 + Math.sin(t * Math.PI * 2) * 35, '#b9f1cd', 'QB');
                dot(165, 75, '#b9f1cd', 'OL'); dot(165, 185, '#b9f1cd', 'OL');
                dot(230 - t * 110, 65 + t * 45, '#ffb5a4', 'R'); dot(230 - t * 110, 195 - t * 45, '#ffb5a4', 'R');
                label('POCKET: ' + (8 - t * 8).toFixed(1) + 's', 420, 125, '#ffdb64');
            } else if (step === 3) {
                if (t < 0.45) {
                    dot(110, 170, '#b9f1cd', 'QB'); dot(370, 130, '#b9f1cd', '3');
                    const f = t / 0.45;
                    footballArt.draw(ctx, 130 + f * 240, 170 - f * 40 - Math.sin(f * Math.PI) * 65, 26, -0.2);
                    dot(300, 185, '#ffb5a4', 'CB');
                } else {
                    const f = (t - 0.45) / 0.55;
                    dot(370 + f * 215, 130 - f * 25, '#b9f1cd', '3');
                    footballArt.draw(ctx, 380 + f * 215, 112 - f * 25, 24, -0.2);
                    dot(310 + f * 205, 165 - f * 30, '#ffb5a4', 'CB');
                }
            } else {
                dot(160 + t * 440, 155, '#b9f1cd', '3');
                label(t > 0.55 ? 'FIRST DOWN!' : '1ST & 10', 300, 85, '#ffdb64');
                label(t > 0.95 ? 'TOUCHDOWN +6' : 'DRIVE 1 / 3', 440, 210);
            }
        } else if (isKick) {
            ctx.strokeStyle = '#ffe699'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(535, 45); ctx.lineTo(535, 125); ctx.lineTo(595, 125); ctx.lineTo(595, 45); ctx.moveTo(565, 125); ctx.lineTo(565, 205); ctx.stroke();
            dot(70, 185, '#b9f1cd', 'K');
            const flight = step >= 3;
            const f = flight ? t : 0;
            dot(100 + f * 465, 185 - f * 90 - Math.sin(f * Math.PI) * 85, '#c69b68', '');
            if (step === 0) { label('WIND RIGHT →', 300, 55); label('Aim left · choose your arc', 300, 95); }
            if (step === 1) {
                ctx.fillStyle = '#09252b'; ctx.fillRect(155, 80, 310, 30);
                ctx.fillStyle = '#b9f1cd'; ctx.fillRect(285, 80, 50, 30);
                ctx.fillStyle = '#ffe699'; ctx.fillRect(155 + t * 310, 74, 5, 42);
                label('SNAP → LOCK POWER', 310, 55);
            }
            if (step === 2) {
                const aimX = 565 + Math.sin(t * Math.PI * 2) * 55 * (1 - t);
                ctx.strokeStyle = Math.abs(aimX - 565) < 24 ? '#b9f1cd' : '#ffad83'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(aimX, 85, 12, 0, Math.PI * 2); ctx.stroke();
                label('HOLD LEFT / RIGHT · STEER · RELEASE', 280, 35);
            }
            if (step === 3) { dot(360 - t * 230, 190, '#ffb5a4', '!'); label('Release before the rush', 310, 35); }
            if (step === 4) label('25 → 33 → 40 → 47 → 55 YARDS · 3 POINTS EACH', 320, 30);
        } else {
            ctx.fillStyle = '#b9f1cd33'; ctx.fillRect(570, 40, 50, 180); label('TD', 595, 140);
            const x = step === 0 || step === 4 ? 70 + t * 510 : 250;
            if (step === 2) {
                ctx.fillStyle = '#b9f1cd44';
                for (const [dx, dy] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]) ctx.fillRect(290 + dx * 40, 90 + dy * 40, 38, 38);
                label('+', 310, 116, '#b9f1cd'); label('GREEN CROSS = SHIELD', 320, 30);
                ctx.fillStyle = '#ffb5a4'; ctx.fillRect(435, 95, 30, 30); label('Rival blocker', 455, 160);
            }
            if (step === 1 || step === 3) {
                dot(440 - t * 150, 140, '#ffb5a4', '!');
                label(step === 1 ? 'YOUR MOVE → CHASE → BURST: 2 MOVES' : 'STEPS LEFT: ' + Math.ceil(10 - t * 10), 320, 30);
            }
            dot(x, 175, '#b9f1cd', 'U');
            dot(200, 175, '#c69b68', '');
            if (step === 0) label('COLLECT THE BALL → RIGHT END ZONE', 320, 30);
            if (step === 4) label('★★★ PAR · ★★ PAR + 2 · HINTS: 1★ CAP', 320, 30);
        }
        if (!paused && !reduced && dialog.open) frame = requestAnimationFrame(draw);
    }
    // Capture the first gameplay input before the engines spend an attempt/turn.
    function intercept(event) {
        if (seen || dialog.open || !event.isTrusted) return;
        if (!event.target.closest('.field-panel, .game-dashboard')) return;
        if (event.type === 'keydown' && ![' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'p', '1', '2', '3'].includes(event.key)) return;
        if (event.type === 'pointerdown' && event.button !== 0) return;
        event.preventDefault(); event.stopImmediatePropagation(); showPrompt();
    }
    for (const type of ['pointerdown', 'click', 'keydown']) document.addEventListener(type, intercept, true);
    const replay = document.createElement('button');
    replay.type = 'button'; replay.className = 'demo-replay'; replay.textContent = 'How to play · Demo';
    replay.addEventListener('click', () => showPrompt(true));
    (document.querySelector('.kick-secondary') || document.querySelector('.rush-toolbar') || document.querySelector('.field-panel')).append(replay);
    window.addEventListener('pagehide', () => { clearTimeout(timer); cancelAnimationFrame(frame); }, {once: true});
})();
