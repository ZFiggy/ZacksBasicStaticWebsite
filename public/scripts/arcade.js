class FanArcade {
    constructor() {
        this.games = Object.fromEntries(window.teamArcade.games.map(game => [game.href, game.title]));
        this.badges = [
            { id: 'touchdown', title: 'On the board', detail: 'Score your first seven-click touchdown.', key: 'clickCount', goal: 7, mark: 'TD', href: 'counter.html' },
            { id: 'field', title: 'Breakaway', detail: `Score a Touchdown Rush touchdown for the ${window.teamArcade.team.nickname}.`, key: 'touchdownRushBest', goal: 1, mark: window.teamArcade.team.short, href: 'game.html' },
            { id: 'kicker', title: 'Split the uprights', detail: 'Make three field goals in one round.', key: 'fieldGoalBest', goal: 9, mark: '3×', href: 'kick.html' },
            { id: 'jalen', title: 'Crowd detective', detail: `Find ${window.NFL_PHOTO_SCENES?.[window.teamArcade.team.id]?.playerName || 'Jalen Hurts'} in all five scenes.`, key: 'jalenCleared', goal: 5, mark: '01', href: 'jalen.html' },
            { id: 'barkley', title: 'Cleared for takeoff', detail: `Clear five gaps in ${window.teamArcade.team.games.bird}.`, key: 'barkleyBest', goal: 5, mark: window.teamArcade.team.short, href: 'barkley.html' }
        ];
        for (const [id, game] of Object.entries(window.playbookGames || {})) {
            if (!window.teamArcade.games.some(item => item.id === id)) continue;
            this.badges.push({ id: `playbook-${id}`, title: game.badge, detail: id === 'pocket' ? 'Score a touchdown in Passing Drive.' : `Reach ${game.goal} ${game.unit} in ${game.title}.`, key: id === 'pocket' ? 'passingPointsBest' : `playbook-${id}-best`, goal: id === 'pocket' ? 6 : game.goal, mark: game.mark, href: `playbook.html?game=${id}` });
        }
        this.page = location.pathname.split('/').pop();
        if (this.page === 'playbook.html') {
            const requested = new URLSearchParams(location.search).get('game');
            this.page += `?game=${Object.hasOwn(window.playbookGames || {}, requested) ? requested : 'pocket'}`;
        }
        if (Object.hasOwn(this.games, this.page)) this.write('arcadeLastGame', this.page);
        this.earned = new Set(this.badges.filter(badge => this.number(badge.key) >= badge.goal).map(badge => badge.id));
        this.render();
        document.addEventListener('arcade:progress', () => this.update());
        document.addEventListener('arcade:nickname', () => this.render());
        window.addEventListener('storage', () => this.render());
    }

    read(key) {
        try { return window.teamArcade.storage.getItem(key); } catch { return null; }
    }

    write(key, value) {
        try { window.teamArcade.storage.setItem(key, value); } catch { /* The arcade remains usable without storage. */ }
    }

    number(key) {
        const value = Number(this.read(key));
        return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    }

    render() {
        const root = document.getElementById('fan-locker');
        if (!root) return;
        const nickname = this.read('fanNickname');
        document.getElementById('locker-greeting').textContent = nickname ? `Your locker, ${nickname}.` : 'Your corner of the stadium.';
        const values = {
            'locker-clicks': this.number('clickCount').toLocaleString(),
            'locker-fields': this.number('touchdownRushBest').toLocaleString(),
            'locker-bird': this.number('barkleyBest').toLocaleString(),
            'locker-kicks': `${Math.min(15, this.number('fieldGoalBest'))} / 15`,
            'locker-photos': `${Math.min(5, this.number('jalenCleared')) * 20} / 100`,
            'locker-passing': `${this.number('passingPointsBest')} / 18`
        };
        for (const [id, value] of Object.entries(values)) document.getElementById(id).textContent = value;
        const recent = this.read('arcadeLastGame');
        const continueLink = document.getElementById('continue-game');
        const hasRecentGame = Object.hasOwn(this.games, recent);
        continueLink.hidden = !hasRecentGame;
        const heroLink = document.getElementById('hero-continue');
        heroLink.href = window.teamArcade.link('games.html');
        heroLink.textContent = 'Explore the games';
        if (hasRecentGame) {
            continueLink.href = window.teamArcade.link(recent);
            continueLink.textContent = `Continue ${this.games[recent]}`;
            heroLink.href = window.teamArcade.link(recent);
            heroLink.textContent = `Continue ${this.games[recent]}`;
        }
        const grid = document.getElementById('fan-badges');
        grid.replaceChildren();
        let unlocked = 0;
        for (const badge of this.badges) {
            const progress = Math.min(badge.goal, this.number(badge.key));
            const earned = progress >= badge.goal;
            if (earned) unlocked++;
            const card = document.createElement('li');
            card.className = `fan-badge${earned ? ' is-earned' : ''}`;
            const mark = document.createElement('span');
            mark.className = 'badge-mark'; mark.textContent = badge.mark; mark.setAttribute('aria-hidden', 'true');
            const copy = document.createElement('div');
            const title = document.createElement('h3'); title.textContent = badge.title;
            const detail = document.createElement('p'); detail.textContent = badge.detail;
            const status = document.createElement('span'); status.className = 'badge-status';
            status.textContent = earned ? 'Earned' : `${progress} / ${badge.goal}`;
            copy.append(title, detail, status); card.append(mark, copy); grid.append(card);
        }
        document.getElementById('badge-count').textContent = `${unlocked} / ${this.badges.length} earned`;
        // Suggest the closest unfinished badge; ties follow the playbook order.
        const next = this.badges.filter(badge => this.number(badge.key) < badge.goal)
            .sort((first, second) => this.number(second.key) / second.goal - this.number(first.key) / first.goal)[0];
        document.getElementById('challenge-title').textContent = next ? next.title : 'The whole playbook. Every badge.';
        document.getElementById('challenge-detail').textContent = next ? `${next.detail} Progress: ${this.number(next.key)} / ${next.goal}.` : 'You earned every badge. Take the field and chase a new personal best.';
        const challengeLink = document.getElementById('challenge-link');
        challengeLink.href = window.teamArcade.link(next ? next.href : 'games.html');
        challengeLink.firstChild.textContent = next ? 'Chase this badge ' : 'Back to the arcade ';
        document.getElementById('locker-challenge').hidden = false;
    }

    update() {
        for (const badge of this.badges) {
            if (this.number(badge.key) < badge.goal || this.earned.has(badge.id)) continue;
            this.earned.add(badge.id);
            let notice = document.getElementById('arcade-notice');
            if (!notice) {
                notice = document.createElement('div'); notice.id = 'arcade-notice';
                notice.className = 'arcade-notice'; notice.setAttribute('role', 'status'); document.body.append(notice);
            }
            notice.textContent = `Badge earned: ${badge.title}`;
            notice.hidden = false;
            clearTimeout(this.noticeTimer);
            this.noticeTimer = setTimeout(() => { notice.hidden = true; }, 4500);
        }
        this.render();
    }


}

window.fanArcade = new FanArcade();
