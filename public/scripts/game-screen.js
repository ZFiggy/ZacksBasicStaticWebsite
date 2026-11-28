// Keep the playable surface and its controls inside the current viewport.
(() => {
    const page = location.pathname.split('/').pop();
    const mode = document.playbook?.id || 'pocket';
    const tabs = document.querySelector('.game-tabs');
    const activeTab = tabs?.querySelector('[aria-current="page"]');
    if (activeTab) tabs.scrollLeft = Math.max(0, activeTab.offsetLeft - tabs.offsetLeft - (tabs.clientWidth - activeTab.clientWidth) / 2);
    const gameId = page === 'game.html' ? 'game' : page === 'kick.html' ? 'kick' : page === 'playbook.html' ? mode : page === 'barkley.html' ? 'bird' : null;
    const rule = window.teamArcade.ruleFor(gameId);
    const guides = {
        game: {
            controls: [['Arrows / WASD', 'Run; hold a key or direction button.'], ['Space / Wait', 'Wait one turn.'], ['P', 'Pause or resume.'], ['Drag / Full field', 'Scout the field on phones.']],
            rules: ['Collect the football, then reach the right end zone before steps run out.', 'Chasers tackle only on your exact tile. Burst turns let them move twice; standing next to one is safe.', 'Rival blockers block movement. Your blockers protect their own tile and four neighbors; diagonals are unprotected.', 'The marked next moves include both moves on a burst turn. SAFE applies to this turn only.', 'A tackle or running out of steps gives the rival possession and a return to the left end zone.'],
            scoring: ['Each step spends 100 bonus points.', 'Shortest route: 3 stars. Up to 2 extra steps: 2 stars.', 'Each coach hint costs 250 points and caps the award at 1 star.']
        },
        pocket: {
            controls: [['Space / Snap', 'Start the play or advance after a result.'], ['Arrows / WASD', 'Move the quarterback; control the receiver after a catch.'], ['1 / 2 / 3', 'Throw to a receiver, or tap their button.'], ['B', 'Toggle Bullet / Lob before throwing.'], ['Q', 'Tuck and run; passing is then unavailable.'], ['T', 'Throw away; uses a down.'], ['Shift', 'Sprint; 1.8 seconds of energy per down.'], ['X', 'Slide safely; ball is spotted where the slide begins.'], ['P', 'Pause or resume.']],
            rules: ['Choose a route before snapping. Bullet passes travel fast; lobs clear underneath defenders but give safeties more time.', 'Stay behind the blue line of scrimmage while passing. Gold marks the first-down line.', 'Four downs to gain 10 yards. Repeated targets attract extra coverage.', 'Sprint energy refills on the next down. Defenders can catch a jogging ball carrier.'],
            scoring: ['Three drives, each starting at your 25.', 'A touchdown scores 6 points. Up to 18 points per game.', 'Your best game score is saved for this team.']
        },
        kick: {
            controls: [['Aim / Left / Right', 'Set your aim into the wind.'], ['Rush lane + arc', 'Choose protection and ball flight before snapping.'], ['Space / Tap / Kick', 'Snap, lock power, then kick.'], ['Arrows / A / D', 'Move the aiming dot into green before release.']],
            rules: ['The situation assigns the hash mark. Protect the announced rush lane.', 'Lock power in the green zone, then release with the aiming dot in green before the rush arrives.', 'High arcs clear defenders but lose distance. Wind changes the flight.'],
            scoring: ['Five kicks per game.', 'Each successful field goal scores 3 points; 15 is a perfect game.']
        },
        bird: {
            controls: [['Space / Up / Tap', 'Flap; use the field or Flap button.'], ['P / Pause', 'Pause or resume.'], ['Restart', 'Begin a new flight.']],
            rules: ['Fly through the gaps and stay off the turf.', 'Speed rises and gaps narrow as you score.', 'Switching tabs pauses your flight.'],
            scoring: ['Each cleared gap scores 1 point.', 'Your best flight is saved for this team.', 'Publish a nickname to join the flight leaderboard.']
        }
    };
    const guide = guides[gameId];
    const instructions = document.querySelector('.game-instructions');
    if (instructions && guide) {
        const details = instructions.matches('details') ? instructions : document.createElement('details');
        details.replaceChildren();
        const summary = document.createElement('summary'); summary.textContent = 'Controls & scoring';
        const grid = document.createElement('div'); grid.className = 'game-help-grid';
        for (const [heading, entries] of [['Controls', guide.controls], ['Rules', guide.rules], ['Scoring', guide.scoring]]) {
            const section = document.createElement('section');
            const title = document.createElement('h3'); title.textContent = heading; section.append(title);
            if (heading === 'Controls') {
                const list = document.createElement('dl');
                for (const [key, action] of entries) {
                    const dt = document.createElement('dt'), dd = document.createElement('dd');
                    dt.textContent = key; dd.textContent = action; list.append(dt, dd);
                }
                section.append(list);
            } else {
                const list = document.createElement('ul');
                for (const text of entries) { const li = document.createElement('li'); li.textContent = text; list.append(li); }
                if (heading === 'Rules' && rule && gameId !== 'pocket' && gameId !== 'game') {
                    const li = document.createElement('li'); li.textContent = rule.description; list.append(li);
                }
                section.append(list);
            }
            grid.append(section);
        }
        details.append(summary, grid);
        if (details !== instructions) instructions.replaceChildren(details);
    }
    const footer = document.querySelector('.site-footer');
    if (footer) {
        const leaders = document.createElement('a');
        leaders.href = window.teamArcade.link(`leaders.html`);
        leaders.textContent = 'Team click standings';
        footer.append(leaders);
    }
    const canvas = document.querySelector('.field-panel > canvas');
    const logicalWidth = canvas?.width;
    const logicalHeight = canvas?.height;
    if (canvas && !document.body.classList.contains('rush-page')) {
        const surface = document.createElement('div');
        surface.className = 'game-surface';
        canvas.before(surface);
        surface.append(canvas);
        const fieldGuide = document.querySelector('.kick-field-guide');
        if (fieldGuide) surface.append(fieldGuide);
        const fit = () => {
            const width = Math.max(1, Math.min(surface.clientWidth, surface.clientHeight * logicalWidth / logicalHeight));
            canvas.style.width = `${width}px`;
            canvas.style.height = `${width * logicalHeight / logicalWidth}px`;
        };
        const observer = new ResizeObserver(fit);
        observer.observe(surface);
        window.addEventListener('pagehide', () => observer.disconnect(), {once: true});
        fit();
    }
    const gameCanvas = canvas || document.getElementById('gameCanvas') || document.passingGame?.canvas;
    // Each refined football game places its live status next to its field.
    // Keep game coordinates stable while drawing at the display's actual pixel
    // density. Preserve the original Eagles flight rendering and artwork.
    if (gameCanvas && !(page === 'barkley.html' && window.teamArcade.team.id === 'eagles')) {
        const width = logicalWidth || gameCanvas.width;
        const height = logicalHeight || gameCanvas.height;
        const sharpen = () => {
            const box = gameCanvas.getBoundingClientRect();
            if (!box.width || !box.height) return;
            const ratio = window.devicePixelRatio || 1;
            const pixelWidth = Math.max(1, Math.round(box.width * ratio));
            const pixelHeight = Math.max(1, Math.round(box.height * ratio));
            if (gameCanvas.width === pixelWidth && gameCanvas.height === pixelHeight) return;
            gameCanvas.width = pixelWidth;
            gameCanvas.height = pixelHeight;
            gameCanvas.getContext('2d').setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
            const engine = document.myGame || document.kickGame || document.barkleyGame || document.passingGame;
            if (engine?.redraw) engine.redraw();
            else engine?.draw();
        };
        const observer = new ResizeObserver(sharpen);
        observer.observe(gameCanvas);
        window.addEventListener('resize', sharpen);
        window.addEventListener('pagehide', () => {
            observer.disconnect();
            window.removeEventListener('resize', sharpen);
        }, {once: true});
        sharpen();
    }
    const stage = document.getElementById('playbook-stage');
    if (stage && !document.passingGame) {
        stage.closest('.field-panel').dataset.mode = mode;
        document.getElementById('playbook-mode').textContent = {pocket:'POCKET READ',shove:'GOAL LINE',recall:'ROUTE RECALL',punt:'PIN PUNT',blitz:'BLITZ ESCAPE',signal:'SIGNAL CIPHER'}[mode] || 'POCKET READ';
        let frame;
        const fit = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                let content = stage.querySelector(':scope > .playbook-content');
                if (!content) {
                    content = document.createElement('div');
                    content.className = 'playbook-content';
                    content.append(...stage.childNodes);
                    stage.append(content);
                }
                const padding = parseFloat(getComputedStyle(stage).paddingLeft);
                const width = stage.clientWidth - padding * 2;
                const height = stage.clientHeight - padding * 2;
                content.style.width = `${Math.max(1, width)}px`;
                const scale = Math.min(1, Math.max(1, height) / Math.max(1, content.scrollHeight));
                content.style.transform = `scale(${scale})`;
                content.style.left = `${padding + width * (1 - scale) / 2}px`;
                content.style.top = `${padding}px`;
            });
        };
        const resize = new ResizeObserver(fit);
        const changes = new MutationObserver(fit);
        resize.observe(stage);
        changes.observe(stage, {childList: true, subtree: true, characterData: true});
        window.addEventListener('pagehide', () => { resize.disconnect(); changes.disconnect(); cancelAnimationFrame(frame); }, {once: true});
        fit();
    }
    const flight = document.querySelector('.bird-page .game-layout');
    if (flight) {
        const panel = flight.querySelector('.field-panel');
        panel.querySelector('.field-heading').remove();
        flight.querySelector('.game-intro .eyebrow').remove();
        flight.querySelector('.game-intro > p:last-child').remove();
        panel.querySelector('.bird-controls').before(document.getElementById('bird-status'));

    }
    const search = document.querySelector('.search-game');
    if (search) {
        document.getElementById('search-help').textContent = 'Tap the player. Zoom to inspect. Keyboard: arrows move, Shift refines, Enter selects.';
        const story = document.createElement('section');
        story.className = 'search-story';
        story.setAttribute('aria-label', 'Search target and progress');
        const board = document.createElement('section');
        board.className = 'search-board';
        board.setAttribute('aria-label', 'Crowd photo and search tools');
        const heading = search.querySelector('.search-heading');
        heading.querySelector('.eyebrow').remove();
        heading.querySelector('p:not(.eyebrow)').remove();
        for (const selector of ['.search-heading', '.photo-progress', '.search-bottom']) story.append(search.querySelector(selector));
        for (const selector of ['.search-toolbar', '#search-retry', '.search-viewport', '#search-status', '.photo-disclosure']) board.append(search.querySelector(selector));
        const credits = document.createElement('details');
        credits.className = 'photo-credits';
        const creditsSummary = document.createElement('summary');
        creditsSummary.textContent = 'Photo credits · AI-edited player';
        const disclosure = board.querySelector('.photo-disclosure');
        disclosure.before(credits);
        credits.append(creditsSummary, disclosure);
        const bottom = story.querySelector('.search-bottom');
        const details = document.createElement('details');
        details.className = 'search-controls-help';
        const summary = document.createElement('summary');
        summary.textContent = 'Controls & scoring';
        const list = document.createElement('ul');
        list.className = 'search-help-list';
        for (const text of ['Tap the named player to select them.', 'Zoom to inspect the crowd; drag to pan.', 'Keyboard: arrows move the cursor; Shift refines; Enter selects.', 'Follow the same player through five photos.', 'Each cleared photo earns 20 search points; finish all five for 100.']) {
            const item = document.createElement('li'); item.textContent = text; list.append(item);
        }
        const help = bottom.querySelector('#search-help'); help.replaceChildren(list);
        details.append(summary, help);
        bottom.prepend(details);
        search.append(story, board);
        const observer = new ResizeObserver(() => document.jalenGame?.applyZoom?.());
        observer.observe(document.getElementById('search-viewport'));
        window.addEventListener('pagehide', () => observer.disconnect(), {once: true});
    }
})();
