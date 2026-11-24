(() => {
    const api = window.teamArcade;
    const team = api.team;
    const personality = api.personality;
    const page = location.pathname.split('/').pop() || 'index.html';
    document.body.classList.add('nfl-page');
    const game = api.games.find(item => item.href.split('?')[0] === page && item.id !== 'pocket');
    const set = (selector, value) => document.querySelectorAll(selector).forEach(item => { item.textContent = value; });
    document.querySelectorAll('.wordmark').forEach(mark => {
        mark.replaceChildren();
        const icon = document.createElement('span'); icon.className = 'brand-icon'; icon.textContent = team.short;
        const label = document.createElement('span'); label.textContent = 'SUNDAY';
        const sub = document.createElement('span'); sub.className = 'brand-light'; sub.textContent = ` / ${team.nickname.toUpperCase()}`;
        mark.append(icon, label, sub);
        mark.href = api.link('index.html');
        mark.setAttribute('aria-label', `${team.name} arcade home`);
    });
    document.querySelectorAll('.header-actions').forEach(actions => {
        const nav = actions.querySelector('nav');
        if (nav) {
            const leaders = document.createElement('a'); leaders.href = 'leaders.html'; leaders.textContent = 'Leaders';
            if (page === 'leaders.html') leaders.setAttribute('aria-current', 'page');
            nav.append(leaders);
        }
        const change = document.createElement('a');
        change.className = 'switch-team';
        change.href = `choose.html?next=${encodeURIComponent(api.safeNext(location.href))}`;
        change.textContent = `${team.short} · Switch team`;
        change.setAttribute('aria-label', `Current team: ${team.name}. Switch team`);
        actions.append(change);
    });
    document.querySelectorAll('.site-footer > p:first-child').forEach(item => { item.textContent = `Sunday Arcade / ${team.name} · An unofficial fan project`; });
    document.querySelectorAll('.game-tabs a').forEach(link => {
        const entry = api.games.find(item => item.href === link.getAttribute('href'));
        if (entry) link.textContent = entry.title;
    });
    document.querySelectorAll('[data-team-art]').forEach(element => {
        if (element.classList.contains('team-hero-art') && api.media) api.paintTeamPhoto(element, 'hero');
        else api.paintArt(element);
    });
    if (api.media) set('.team-art-note', `${team.city} on camera. Your colors. Your home crowd.`);
    if (window.NFL_PHOTO_SCENES?.[team.id]?.authentic) {
        set('.locker-stats a[href^="jalen.html"] > span', 'Photo scenes cleared');
        set('.locker-stats a[href^="jalen.html"] > small', 'Five photos. Five targets.');
    }
    set('[data-team-name]', team.name);
    set('[data-team-city]', team.city);
    set('[data-team-nickname]', team.nickname);
    set('[data-team-motto]', team.motto);
    set('[data-team-setting]', api.media ? `${team.city} football. Real team moments, home colors, and ten ways to play.` : team.setting);
    set('[data-team-division]', `${team.conference} ${team.division}`);
    set('[data-team-short]', team.short);
    const feature = document.querySelector('.lobby-team-art');
    if (feature) api.paintGameArt(feature, 'bird');
    if (api.media) set('.team-lobby-feature .eyebrow', 'Your team. In the game.');
    // Replace the old editorial shell before game scripts start updating their own status text.
    const replacements = [
        ['Philadelphia Eagles', team.name], ['PHILADELPHIA EAGLES', team.name.toUpperCase()],
        ['PHILADELPHIA', team.city.toUpperCase()], ['Philadelphia', team.city], ['The Philly faithful', `${team.nickname} faithful`],
        ['Eagles Field Run', team.games.game], ['Field Goal Challenge', team.games.kick], ['Barkley Bird', team.games.bird], ['Where’s Jalen?', team.games.search],
        ['Fly Eagles Fly!', team.motto], ['FLY EAGLES FLY', team.motto.toUpperCase()], ['GO BIRDS', `GO ${team.nickname.toUpperCase()}`], ['Go Birds', `Go ${team.nickname}`],
        ['green zone', 'highlighted zone'], ['GREEN ZONE', 'HIGHLIGHTED ZONE'], ['midnight green', 'your team colors'], ['Midnight green', 'Home colors'], ['EAGLES', team.nickname.toUpperCase()], ['Eagles', team.nickname], ['PHI', team.short], ['Philly', team.city]
    ];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walk.nextNode()) if (!walk.currentNode.parentElement.closest('script,style,[data-team-name],[data-team-setting],[data-team-motto],.wordmark')) nodes.push(walk.currentNode);
    for (const node of nodes) {
        let value = node.textContent;
        for (const [from, to] of replacements) value = value.replaceAll(from, to);
        node.textContent = value;
    }
    if (game) document.title = `${game.title} · ${team.name} · Sunday Arcade`;
    else document.title = `${team.name} · Sunday Arcade`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', team.primary);
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${team.name} fan arcade. ${team.motto} Ten team-inspired games, saved records, and fan standings.`);
    if (page === 'game.html') {
        set('#game-title', team.games.game.toUpperCase());
        set('.game-intro > p:last-child', personality?.gameHooks.game || `Bring every football home for the ${team.nickname}.`);
        set('.field-heading span:first-child', team.city.toUpperCase());
        document.getElementById('gameCanvas').setAttribute('aria-label', `${team.name} field. Move your team jersey to collect two footballs.`);
    }
    if (page === 'kick.html') {
        set('.game-intro h1', team.games.kick.toUpperCase());
        set('.meter-caption', 'STOP THE MARKER IN THE HIGHLIGHTED ZONE');
        set('.game-intro > p:last-child', personality?.gameHooks.kick || `Five kicks. Your home crowd.`);
        set('.field-heading span:first-child', team.city.toUpperCase());
    }
    if (page === 'barkley.html') {
        set('.game-intro h1', team.games.bird.toUpperCase());
        set('.game-intro .eyebrow', personality ? `${personality.runner.name} · #${personality.runner.number} · ${personality.runner.era}` : `${team.short} · Stadium flight`);
        set('.bird-panel .field-heading span:first-child', personality ? `${personality.runner.name.toUpperCase()} · #${personality.runner.number}` : `${team.short} · HOME HERO`);
        document.getElementById('birdCanvas').setAttribute('aria-label', `${team.name} cartoon flight game`);
        set('.game-intro > p:last-child', personality?.gameHooks.bird || `Take the sky for the ${team.nickname}.`);
        set('.game-instructions p:first-of-type', 'Tap Flap or press Space / Up to fly. Dodge the stadium obstacles; each gap scores one point. Pause with P.');
        document.querySelectorAll('.bird-player-art, .bird-photo-credit').forEach(item => { item.hidden = true; });
        const photo = document.querySelector('.bird-character img');
        if (photo) photo.hidden = true;
    }
    if (page === 'counter.html') {
        const counterTitle = document.getElementById('counter-title');
        const lastLine = document.createElement('span'); lastLine.textContent = 'GO.';
        counterTitle.replaceChildren('GO.', document.createElement('br'), `${team.nickname.toUpperCase()}.`, document.createElement('br'), lastLine);
        set('.counter-story .eyebrow', `${team.name} · Fan zone`);
        set('.fan-stamp p', team.motto);
        set('.backdrop-word', team.city.toUpperCase());
        set('#panel-title', `${team.nickname.toUpperCase()} SCOREBOARD`);
        set('.mini-endzone', team.nickname.toUpperCase());
        set('.scoreboard-header span:first-child', `${team.nickname.toUpperCase()} HOME FIELD`);
        set('.play-caption', `${personality.quarterback.name.toUpperCase()} TO ${personality.runner.name.toUpperCase()} · ${team.short}`);
        set('.roster-strip', `${team.name} · ${team.short} home field`);
        set('.throw-quarterback text', personality.quarterback.number);
        set('.touchdown-receiver text', personality.runner.number);
        const backdrop = document.querySelector('.eagles-backdrop');
        if (backdrop && team.id !== 'eagles') {
            backdrop.replaceChildren();
            const art = document.createElement('div'); art.className = 'counter-team-art';
            api.paintTeamPhoto(art, 'scoreboard');
            art.querySelector('.team-photo-credit')?.remove();
            const shade = document.createElement('div'); shade.className = 'green-overlay';
            backdrop.append(art, shade);
        }
        document.querySelectorAll('.photo-credit, .site-footer a[target="_blank"]').forEach(item => { item.hidden = true; });
        if (api.media?.scoreboard) {
            const source = document.createElement('a');
            source.href = api.media.scoreboard.sourcePage;
            source.target = '_blank'; source.rel = 'noopener noreferrer';
            source.textContent = `Photography: ${api.media.scoreboard.credit}`;
            document.querySelector('.site-footer')?.append(source);
        }
        document.querySelectorAll('.touchdown-stage svg [fill="#004c54"],.touchdown-stage svg [fill="#00646b"]').forEach(item => item.setAttribute('fill', team.primary));
        document.querySelectorAll('.touchdown-stage svg [stroke="#004c54"]').forEach(item => item.setAttribute('stroke', team.primary));
    }
    const mode = page === 'playbook.html' ? (Object.hasOwn(team.games,new URLSearchParams(location.search).get('game')) ? new URLSearchParams(location.search).get('game') : 'pocket') : { 'game.html':'game', 'kick.html':'kick', 'barkley.html':'bird' }[page];
    if (mode && api.games.some(game => game.id === mode)) {
        const panel = document.querySelector('.field-panel');
        const role = ['game','bird'].includes(mode) ? 'runner' : ['kick','punt'].includes(mode) ? 'kicker' : 'quarterback';
        const player = personality?.[role];
        const heading = panel.querySelector('.field-heading span:first-child');
        if (heading && player) heading.textContent = `${player.name} · #${player.number}`;
        panel.dataset.mode = mode;
    }
    document.querySelectorAll('.leaderboard-section').forEach(section => {
        // Preserve the old score sources, while directing all team-aware rankings to the new board.
        const box = document.createElement('div'); box.className = 'team-leaderboard-link';
        const heading = document.createElement('h2'); heading.textContent = 'Your name. Your colors. Your rank.';
        const text = document.createElement('p'); text.textContent = 'See individual fans with their chosen teams, compare game scores, and follow the overall team standings.';
        const link = document.createElement('a'); link.className = 'button'; link.href = `leaders.html?game=${page === 'barkley.html' ? 'bird' : 'overall'}`; link.textContent = 'Open fan & team leaderboards';
        box.append(heading,text,link); section.replaceChildren(box);
    });
    function teamLinks(root = document) {
        root.querySelectorAll('a[href]').forEach(link => {
            const raw = link.getAttribute('href');
            if (!raw || raw.startsWith('#') || raw.startsWith('choose.html') || /^(https?:|mailto:)/.test(raw)) return;
            if (/^(index|games|game|kick|barkley|jalen|playbook|leaders|counter)\.html/.test(raw)) link.href = api.link(raw);
        });
    }
    teamLinks();
    const observer = new MutationObserver(() => teamLinks());
    observer.observe(document.body, {childList:true, subtree:true});
    let previous = api.points().points;
    document.addEventListener('arcade:progress', () => {
        const current = api.points().points;
        if (current > previous) celebrate();
        previous = current;
        document.querySelectorAll('[data-arcade-points]').forEach(item => { item.textContent = current; });
    });
    document.querySelectorAll('[data-arcade-points]').forEach(item => { item.textContent = previous; });
    function celebrate() {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let burst = document.querySelector('.team-burst');
        if (burst) burst.remove();
        burst = document.createElement('div'); burst.className = 'team-burst'; burst.dataset.effect = team.effects; burst.setAttribute('aria-hidden','true');
        const shapes = {feathers:'❧', stars:'★', bolts:'ϟ', snow:'❄', fire:'◆', waves:'≈', confetti:'■'};
        for (let i = 0; i < 16; i++) {
            const particle = document.createElement('span'); particle.textContent = shapes[team.effects] || '◆';
            particle.style.setProperty('--particle-x', `${6 + i * 5.8}%`); particle.style.setProperty('--particle-rotation', `${i * 47}deg`); particle.style.animationDelay = `${i % 4 * 0.08}s`;
            burst.append(particle);
        }
        document.body.append(burst);
        setTimeout(() => burst.remove(), 2400);
    }
    if (api.storage.getItem('leagueJoined') === '1' && page !== 'leaders.html') {
        const sync = document.createElement('p');
        sync.id = 'team-sync-status';
        sync.className = 'board-status';
        sync.setAttribute('role','status');
        sync.textContent = 'Your team record syncs after scoring. Local progress stays saved.';
        document.querySelector('.site-footer')?.prepend(sync);
    }
    window.teamArcade.celebrate = celebrate;
})();
