class GamesLobby {
    constructor() {
        this.arcade = window.fanArcade;
        this.filters = document.querySelectorAll('[data-game-filter]');
        this.cards = document.querySelectorAll('[data-game-category]');
        this.filters.forEach(button => {
            button.addEventListener('click', () => this.filter(button.dataset.gameFilter));
        });
        this.updateRecords();
        window.addEventListener('storage', () => this.updateRecords());
    }

    filter(category) {
        let count = 0;
        this.filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.gameFilter === category)));
        this.cards.forEach(card => {
            card.hidden = category !== 'all' && card.dataset.gameCategory !== category;
            if (!card.hidden) count++;
        });
        document.getElementById('library-count').textContent = `${count} ${count === 1 ? 'game' : 'games'} ready to play`;
    }

    updateRecords() {
        const nickname = this.arcade.read('fanNickname');
        document.getElementById('lobby-fan').textContent = nickname || 'The Philly faithful';
        const best = this.arcade.number('barkleyBest');
        document.getElementById('featured-bird-best').textContent = best.toLocaleString();
        document.getElementById('library-bird-best').textContent = `${best.toLocaleString()} ${best === 1 ? 'gap' : 'gaps'}`;
        document.getElementById('library-kick-best').textContent = `${Math.min(15, this.arcade.number('fieldGoalBest'))} / 15 pts`;
        const wins = this.arcade.number('fieldRunWins');
        document.getElementById('library-field-wins').textContent = `${wins.toLocaleString()} ${wins === 1 ? 'clear' : 'clears'}`;
        let photo = 'Photo 1 / 5';
        try {
            const progress = JSON.parse(this.arcade.read('jalenProgress'));
            if (progress?.version === 3 && Number.isInteger(progress.level) && progress.level >= 0 && progress.level < 5 && typeof progress.found === 'boolean') {
                photo = progress.level === 4 && progress.found ? 'All 5 found' : `Photo ${progress.level + 1} / 5`;
            }
        } catch {
            // A missing or invalid record is a new search.
        }
        document.getElementById('library-jalen-progress').textContent = photo;
        const recent = this.arcade.read('arcadeLastGame');
        const resume = document.getElementById('lobby-resume');
        resume.hidden = !Object.hasOwn(this.arcade.games, recent);
        if (!resume.hidden) {
            document.getElementById('lobby-recent-title').textContent = this.arcade.games[recent];
            const link = document.getElementById('lobby-recent-link');
            link.href = recent;
            link.textContent = `Continue ${this.arcade.games[recent]}`;
        }
    }
}

document.gamesLobby = new GamesLobby();
