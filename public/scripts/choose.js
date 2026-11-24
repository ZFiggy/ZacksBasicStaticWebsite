(() => {
    const {teams, safeNext} = window.teamArcade;
    const grid = document.getElementById('team-grid');
    const search = document.getElementById('team-search');
    const count = document.getElementById('team-count');
    let conference = 'all';
    function render() {
        const term = search.value.toLowerCase().trim();
        const matches = teams.filter(team => (conference === 'all' || team.conference === conference) && `${team.name} ${team.city} ${team.division}`.toLowerCase().includes(term));
        grid.replaceChildren();
        count.textContent = `${matches.length} ${matches.length === 1 ? 'team' : 'teams'}`;
        for (const team of matches) {
            const card = document.createElement('a');
            const next = safeNext(new URLSearchParams(location.search).get('next'));
            const url = new URL(next, location.href);
            url.searchParams.set('team', team.id);
            card.href = url.pathname.split('/').pop() + url.search;
            card.className = 'team-choice';
            card.style.setProperty('--card-primary', team.primary);
            card.style.setProperty('--card-secondary', team.secondary);
            const art = document.createElement('div');
            art.className = 'team-choice-art';
            if (team.id === 'eagles') {
                const photo = document.createElement('img');
                photo.className = 'team-photo'; photo.src = 'assets/hurts.jpg';
                photo.alt = 'Philadelphia Eagles quarterback Jalen Hurts'; photo.loading = 'lazy';
                art.append(photo);
            } else window.teamArcade.paintTeamPhoto(art, 'hero', team);
            const copy = document.createElement('div');
            copy.className = 'team-choice-copy';
            const division = document.createElement('span'); division.textContent = `${team.conference} ${team.division} · ${team.short}`;
            const name = document.createElement('h2'); name.textContent = team.name;
            const motto = document.createElement('p'); motto.textContent = team.motto;
            copy.append(division, name, motto);
            card.append(art, copy);
            card.addEventListener('click', () => { try { localStorage.setItem('nflTeam', team.id); } catch { /* URL retains the choice. */ } });
            grid.append(card);
        }
        document.getElementById('team-no-results').hidden = matches.length > 0;
    }
    search.addEventListener('input', render);
    document.querySelectorAll('[data-conference]').forEach(button => button.addEventListener('click', () => {
        conference = button.dataset.conference;
        document.querySelectorAll('[data-conference]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        render();
    }));
    render();
})();
