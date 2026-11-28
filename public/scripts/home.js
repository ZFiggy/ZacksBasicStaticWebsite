(() => {
    const api = window.teamArcade;
    const root = document.getElementById('home-game-trio');
    const cards = new Map();
    const descriptions = {
        game:'Collect the football, use your blockers, and beat the chasing defense. Clear ten levels for full arcade points.',
        pocket:'Call your routes, pass or scramble, and finish three drives. Each touchdown scores six game points.',
        kick:'Set your aim, read the wind, and beat the rush. Five kicks, three points per make.'
    };
    for (const game of api.scoringGames) {
        const link = document.createElement('a');
        link.className = `home-mini-game mode-${game.id}`;
        link.href = api.link(game.href);
        const art = document.createElement('div');
        art.className = 'mini-team-art';
        if (game.id === 'scoreboard') {
            art.classList.add('home-scoreboard-art');
            const label = document.createElement('span'); label.textContent = `${api.team.short} FAN TOUCHDOWNS`;
            const count = document.createElement('strong'); count.dataset.homeTouchdowns = '';
            art.append(label, count);
        } else api.paintGameArt(art, game.id);
        const mark = document.createElement('span'); mark.className = 'mini-game-mark'; mark.textContent = game.mark;
        const copy = document.createElement('div'); copy.className = 'home-game-copy';
        const title = document.createElement('h3'); title.textContent = game.title;
        const detail = document.createElement('p'); detail.textContent = descriptions[game.id] || game.description;
        const score = document.createElement('strong'); score.className = 'home-game-points';
        const progress = document.createElement('progress'); progress.max = game.maxPoints; progress.setAttribute('aria-label', `${game.title} arcade points`);
        const record = document.createElement('p'); record.className = 'home-game-record';
        const goal = document.createElement('p'); goal.className = 'home-game-goal'; goal.textContent = `${game.maxPoints} arcade points at ${game.goalLabel}.`;
        copy.append(title, detail, score, progress, record, goal);
        link.append(art, mark, copy); root.append(link);
        cards.set(game.id, {score, progress, record});
    }
    function render() {
        const values = api.points();
        const completed = api.scoringGames.filter(game => values.scores[game.id] === game.maxPoints).length;
        document.getElementById('home-points-progress').value = values.points;
        document.getElementById('home-points-detail').textContent = `${Math.round(values.points / api.maxPoints * 100)}% earned · ${completed} / 6 targets reached · ${api.maxPoints - values.points} points to go`;
        document.querySelectorAll('[data-arcade-points]').forEach(item => { item.textContent = values.points; });
        for (const game of api.scoringGames) {
            const card = cards.get(game.id);
            const raw = game.id === 'scoreboard' ? values.clicks : values.records[game.id];
            card.score.textContent = `${values.scores[game.id]} / ${game.maxPoints} arcade points`;
            card.progress.value = values.scores[game.id];
            card.record.textContent = game.id === 'search' ? `Best: ${Math.min(5, raw) * 20} / 100 search points · ${Math.min(5, raw)} / 5 scenes`
                : game.id === 'scoreboard' ? `${Math.floor(raw / 7).toLocaleString()} touchdowns · ${raw.toLocaleString()} clicks`
                : `Best: ${raw.toLocaleString()} ${raw === 1 ? game.unit.replace(/s$/, '') : game.unit}`;
        }
        root.querySelector('[data-home-touchdowns]').textContent = Math.floor(values.clicks / 7).toLocaleString();
    }
    render();
    document.addEventListener('arcade:progress', render);
    window.addEventListener('storage', render);
    window.addEventListener('pageshow', render);
})();
