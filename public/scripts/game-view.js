// Fullscreen includes the game's HUD and controls, with a page-sized fallback
// for browsers that do not expose the Fullscreen API (including some phones).
(() => {
    const main = document.getElementById('main-content');
    if (!main || !document.body.classList.contains('game-page')) return;
    document.querySelectorAll('[data-expand-game]').forEach(button => button.remove());
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-view-button';
    button.dataset.gameFullscreen = '';
    button.textContent = 'Full screen';
    button.setAttribute('aria-pressed', 'false');
    if (document.body.matches('.passing-page, .rush-page, .kick-page')) {
        const utility = document.createElement('div'); utility.className = 'game-utility-bar';
        main.querySelector('.field-panel').after(utility);
        const help = main.querySelector('.game-instructions');
        if (help) utility.append(help);
        utility.append(button);
    } else (main.querySelector('.search-bottom, .game-story') || main).append(button);
    const bar = document.createElement('div');
    bar.className = 'fullscreen-bar';
    bar.hidden = true;
    const title = document.createElement('strong');
    const page = location.pathname.split('/').pop();
    title.textContent = window.teamArcade.games.find(game => game.href.split('?')[0] === page)?.title || 'Game';
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'game-view-button';
    exit.textContent = 'Exit full screen';
    bar.append(title, exit);
    document.body.append(bar);
    let fallback = false;
    let previousFocus;
    let previousScroll = 0;
    const show = active => {
        document.body.classList.toggle('game-fullscreen', active);
        button.setAttribute('aria-pressed', String(active));
        bar.hidden = !active;
        requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
            document.myGame?.focusRunner();
            document.kickGame?.draw();
            if (!active) {
                previousFocus?.focus({preventScroll: true});
                window.scrollTo(0, previousScroll);
            }
        });
    };
    button.addEventListener('click', async () => {
        previousFocus = document.activeElement;
        previousScroll = window.scrollY;
        show(true);
        try {
            if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) fallback = true;
            else await document.documentElement.requestFullscreen();
        } catch { fallback = true; }
        (main.querySelector('canvas') || exit).focus({preventScroll: true});
    });
    exit.addEventListener('click', async () => {
        fallback = false;
        if (document.fullscreenElement) await document.exitFullscreen();
        show(false);
    });
    document.addEventListener('fullscreenchange', () => show(!!document.fullscreenElement || fallback));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && fallback) { fallback = false; show(false); }
    });

    // Size the card to the visible picture, rather than painting empty wings
    // around a narrow flight field or a landscape photograph.
    const bird = document.body.classList.contains('bird-page');
    const search = document.body.classList.contains('search-page');
    const rankings = bird ? document.querySelector('.rankings-panel') : null;
    if (rankings) main.append(rankings);
    if (!bird && !search) return;
    const panel = main.querySelector('.field-panel, .search-board');
    const surface = main.querySelector('.game-surface, .search-viewport');
    const canvas = main.querySelector('#birdCanvas, #searchCanvas');
    let frame;
    const fit = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            const wide = matchMedia('(min-width: 1001px), (max-height: 600px) and (orientation: landscape)').matches;
            if (!wide) { panel.style.removeProperty('width'); return; }
            const style = getComputedStyle(panel);
            const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2;
            const story = main.querySelector('.game-story, .search-story');
            const gap = parseFloat(getComputedStyle(main).columnGap);
            const boardWidth = bird && matchMedia('(min-width: 1200px)').matches && !document.body.classList.contains('game-fullscreen') ? rankings.getBoundingClientRect().width + gap : 0;
            const availableWidth = main.clientWidth - story.getBoundingClientRect().width - gap - boardWidth;
            const ratio = bird ? 480 / 680 : canvas.width / canvas.height;
            const minimum = Math.min(availableWidth, bird ? 230 : 360);
            const width = Math.max(minimum, Math.min(availableWidth, surface.clientHeight * ratio + padding));
            panel.style.width = `${Math.max(padding + 1, width)}px`;
        });
    };
    const observer = new ResizeObserver(fit);
    for (const element of [main, surface, canvas]) observer.observe(element);
    window.addEventListener('pagehide', () => { observer.disconnect(); cancelAnimationFrame(frame); }, {once: true});
    fit();
})();
