(() => {
    const {teams, teamDestination} = window.teamArcade;
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
            card.href = teamDestination(team.id);
            card.dataset.team = team.id;
            card.className = 'team-choice';
            card.style.setProperty('--card-primary', team.primary);
            card.style.setProperty('--card-secondary', team.secondary);
            const art = document.createElement('div');
            art.className = 'team-choice-art';
            window.teamArcade.paintTeamPhoto(art, 'hero', team);
            const copy = document.createElement('div');
            copy.className = 'team-choice-copy';
            const division = document.createElement('span'); division.textContent = `${team.conference} ${team.division} · ${team.short}`;
            const name = document.createElement('h2'); name.textContent = team.name;
            copy.append(division, name);
            card.append(art, copy);
            const updateDestination = () => { card.href = teamDestination(team.id); };
            card.addEventListener('click', () => {
                updateDestination();
                try { localStorage.setItem('nflTeam', team.id); } catch { /* URL retains the choice. */ }
            });
            card.addEventListener('auxclick', updateDestination);
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
    window.addEventListener('pageshow', event => { if (event.persisted) render(); });
    const refreshDestinations = () => grid.querySelectorAll('.team-choice').forEach(card => { card.href = teamDestination(card.dataset.team); });
    window.addEventListener('focus', refreshDestinations);
    window.addEventListener('storage', refreshDestinations);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDestinations(); });
    render();
})();
