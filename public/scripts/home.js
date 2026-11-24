(() => {
    const api = window.teamArcade;
    const root = document.getElementById('home-game-trio');
    for (const id of ['bird', 'shove', 'search']) {
        const game = api.games.find(item => item.id === id);
        const link = document.createElement('a');
        link.className = `home-mini-game mode-${id}`;
        link.href = api.link(game.href);
        const art = document.createElement('div'); art.className = 'mini-team-art'; api.paintGameArt(art, id);
        const mark = document.createElement('span'); mark.className = 'mini-game-mark'; mark.textContent = game.mark;
        const title = document.createElement('h3'); title.textContent = game.title;
        const detail = document.createElement('p'); detail.textContent = game.description || window.playbookGames[id].description;
        link.append(art,mark,title,detail); root.append(link);
    }
})();
