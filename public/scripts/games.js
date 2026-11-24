class GamesLobby {
    constructor() {
        this.arcade = window.fanArcade;
        this.api = window.teamArcade;
        const grid = document.querySelector('.game-library-grid');
        for (const game of this.api.games) {
            const card = document.createElement('article');
            card.className = `library-game mode-${game.id}`;
            card.dataset.gameCategory = game.category;
            const art = document.createElement('a'); art.className = 'library-art team-library-art'; art.href = this.api.link(game.href); art.tabIndex = -1; art.setAttribute('aria-hidden','true');
            const image = document.createElement('div'); image.className = 'library-mascot'; this.api.paintGameArt(image, game.id);
            const mark = document.createElement('b'); mark.className = 'library-mode-mark'; mark.textContent = game.mark;
            art.append(image, mark);
            const copy = document.createElement('div'); copy.className = 'library-game-copy';
            const category = document.createElement('p'); category.className = 'eyebrow'; category.textContent = `${game.category} · ${this.api.team.short} playbook`;
            const title = document.createElement('h3'); title.textContent = game.title;
            const description = document.createElement('p'); description.textContent = game.description || window.playbookGames[game.id].description;
            const record = document.createElement('div'); record.className = 'library-record';
            const label = document.createElement('span'); label.textContent = 'Personal best';
            const value = document.createElement('strong'); value.dataset.record = game.id;
            record.append(label,value);
            const play = document.createElement('a'); play.className = 'library-play'; play.href = this.api.link(game.href); play.textContent = `Play ${game.title}`;
            copy.append(category,title,description,record,play); card.append(art,copy); grid.append(card);
        }
        this.filters = document.querySelectorAll('[data-game-filter]');
        this.cards = document.querySelectorAll('[data-game-category]');
        this.filters.forEach(button => button.addEventListener('click', () => this.filter(button.dataset.gameFilter)));
        this.updateRecords();
        window.addEventListener('storage', () => this.updateRecords());
        document.getElementById('featured-game-link').textContent = `Play ${this.api.team.games.bird}`;
    }
    filter(category) {
        let count = 0;
        this.filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.gameFilter === category)));
        this.cards.forEach(card => { card.hidden = category !== 'all' && card.dataset.gameCategory !== category; if (!card.hidden) count++; });
        document.getElementById('library-count').textContent = `${count} ${count === 1 ? 'game' : 'games'} ready to play`;
    }
    updateRecords() {
        document.getElementById('lobby-fan').textContent = this.arcade.read('fanNickname') || `${this.api.team.nickname} faithful`;
        document.getElementById('featured-bird-best').textContent = this.arcade.number('barkleyBest');
        for (const game of this.api.games) document.querySelector(`[data-record="${game.id}"]`).textContent = `${this.arcade.number(game.key)} ${game.unit}`;
        const recent = this.arcade.read('arcadeLastGame');
        const resume = document.getElementById('lobby-resume');
        resume.hidden = !Object.hasOwn(this.arcade.games, recent);
        if (!resume.hidden) {
            document.getElementById('lobby-recent-title').textContent = this.arcade.games[recent];
            const link = document.getElementById('lobby-recent-link'); link.href = this.api.link(recent); link.textContent = `Continue ${this.arcade.games[recent]}`;
        }
    }
}
document.gamesLobby = new GamesLobby();
