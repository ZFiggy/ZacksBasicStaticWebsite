// Keep the playable surface and its controls inside the current viewport.
(() => {
    const page = location.pathname.split('/').pop();
    const mode = document.playbook?.id || 'pocket';
    const tabs = document.querySelector('.game-tabs');
    const activeTab = tabs?.querySelector('[aria-current="page"]');
    if (activeTab) tabs.scrollLeft = Math.max(0, activeTab.offsetLeft - tabs.offsetLeft - (tabs.clientWidth - activeTab.clientWidth) / 2);
    const help = {
        'game.html': 'Move with arrows / WASD or hold the direction buttons. Collect the football, then reach the right end zone.',
        'kick.html': 'Each situation assigns the hash mark. Set aim into the wind, protect the announced rush lane, and choose an arc. Snap, lock power in the green zone, then use Left/Right or A/D to move the aiming dot into green and kick before the rush arrives. High arcs clear defenders but lose distance. Use the button, tap the field, or press Space on the field. Five kicks, 3 points each.',
        'barkley.html': 'Tap the field or Flap; Space / Up also works. Clear the gaps. Pause with P or Pause.',
        pocket: 'Pass to OPEN with buttons / keys 1–3. Ten completions win; three mistakes end the drive.',
        shove: 'Push / Space in the highlighted window. Gain 36 inches in 3 downs. Rest restores energy but costs a down.',
        recall: 'Watch the demonstration, then answer with buttons / keys 1–4. Follow the displayed team audible. Clear 8 rounds; replay once per round.',
        punt: 'Set power and loft. Score at 80–99 yards; 100+ is zero. Watch wind and roll; preview shows landing only.',
        blitz: 'Use arrows / WASD or buttons. Reach TD; avoid rushers and blockers. Each move advances the rush.',
        signal: 'Fill 3 slots. EXACT = right slot; SHIFT = wrong slot. Follow your team’s repeat rule. Decode the order in 6 attempts.'
    };
    const gameId = page === 'game.html' ? 'game' : page === 'kick.html' ? 'kick' : page === 'playbook.html' ? mode : null;
    const rule = window.teamArcade.ruleFor(gameId);
    if (rule && !document.body.classList.contains('rush-page') && !document.passingGame) {
        const banner = document.createElement('details');
        banner.className = 'team-rule-banner';
        const summary = document.createElement('summary');
        summary.textContent = `${rule.theme} · Team rules`;
        const detail = document.createElement('p');
        detail.textContent = rule.description;
        banner.append(summary, detail);
        document.querySelector('.field-panel')?.prepend(banner);
    }
    const instructions = document.querySelector('.game-instructions');
    if (instructions && !document.body.classList.contains('rush-page') && !document.passingGame) {
        const paragraph = document.createElement('p');
        paragraph.textContent = rule ? `${rule.description} ${help[page] || help[mode]}` : help[page] || help[mode];
        instructions.replaceChildren(paragraph);
    }
    const footer = document.querySelector('.site-footer');
    if (footer) {
        const leaders = document.createElement('a');
        leaders.href = window.teamArcade.link(`leaders.html?game=${page === 'barkley.html' ? 'bird' : 'overall'}`);
        leaders.textContent = 'Leaderboards';
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
    const search = document.querySelector('.search-game');
    if (search) {
        document.getElementById('search-help').textContent = 'Tap the player’s face. Zoom for details. Keyboard: arrows move, Shift refines, Enter selects.';
        const story = document.createElement('section');
        story.className = 'search-story';
        story.setAttribute('aria-label', 'Search target and progress');
        const board = document.createElement('section');
        board.className = 'search-board';
        board.setAttribute('aria-label', 'Crowd photo and search tools');
        for (const selector of ['.search-heading', '.photo-progress', '#search-status', '.search-bottom']) {
            story.append(search.querySelector(selector));
        }
        for (const selector of ['.search-toolbar', '#search-retry', '.search-viewport', '.photo-disclosure']) {
            board.append(search.querySelector(selector));
        }
        search.append(story, board);
        const observer = new ResizeObserver(() => document.jalenGame?.applyZoom?.());
        observer.observe(document.getElementById('search-viewport'));
        window.addEventListener('pagehide', () => observer.disconnect(), {once: true});
    }
})();
