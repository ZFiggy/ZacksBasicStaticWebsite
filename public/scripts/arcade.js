class FanArcade {
    constructor() {
        this.games = {
            'game.html': 'Eagles Field Run',
            'kick.html': 'Field Goal Challenge',
            'jalen.html': 'Where’s Jalen?',
            'barkley.html': 'Barkley Bird'
        };
        this.badges = [
            { id: 'touchdown', title: 'On the board', detail: 'Score your first seven-click touchdown.', key: 'clickCount', goal: 7, mark: 'TD' },
            { id: 'field', title: 'Clean sweep', detail: 'Collect both footballs in Field Run.', key: 'fieldRunWins', goal: 1, mark: 'PHI' },
            { id: 'kicker', title: 'Split the uprights', detail: 'Make three field goals in one round.', key: 'fieldGoalBest', goal: 9, mark: '3×' },
            { id: 'jalen', title: 'Eagle eye', detail: 'Find Jalen in all five photos.', key: 'jalenCleared', goal: 5, mark: '01' },
            { id: 'barkley', title: 'Cleared for takeoff', detail: 'Clear five gaps in Barkley Bird.', key: 'barkleyBest', goal: 5, mark: '26' }
        ];
        this.page = location.pathname.split('/').pop();
        if (this.games[this.page]) this.write('arcadeLastGame', this.page);
        this.earned = new Set(this.badges.filter(badge => this.number(badge.key) >= badge.goal).map(badge => badge.id));
        this.render();
        document.addEventListener('arcade:progress', () => this.update());
        document.addEventListener('arcade:nickname', () => this.render());
        window.addEventListener('storage', () => this.render());
        this.setupExpand();
    }

    read(key) {
        try { return localStorage.getItem(key); } catch { return null; }
    }

    write(key, value) {
        try { localStorage.setItem(key, value); } catch { /* The arcade remains usable without storage. */ }
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
            'locker-bird': this.number('barkleyBest').toLocaleString(),
            'locker-kicks': `${Math.min(15, this.number('fieldGoalBest'))} / 15`,
            'locker-photos': `${Math.min(5, this.number('jalenCleared'))} / 5`
        };
        for (const [id, value] of Object.entries(values)) document.getElementById(id).textContent = value;
        const recent = this.read('arcadeLastGame');
        const continueLink = document.getElementById('continue-game');
        continueLink.hidden = !this.games[recent];
        if (this.games[recent]) {
            continueLink.href = recent;
            continueLink.textContent = `Continue ${this.games[recent]}`;
            const heroLink = document.getElementById('hero-continue');
            heroLink.href = recent;
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
        document.getElementById('badge-count').textContent = `${unlocked} / 5 earned`;
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

    setupExpand() {
        if (!document.fullscreenEnabled) return;
        document.querySelectorAll('[data-expand-game]').forEach(button => {
            button.hidden = false;
            const panel = button.closest('.field-panel');
            button.addEventListener('click', async () => {
                try {
                    if (document.fullscreenElement) await document.exitFullscreen();
                    else {
                        await panel.requestFullscreen();
                        panel.querySelector('canvas')?.focus({ preventScroll: true });
                    }
                } catch {
                    button.textContent = 'Expanded view unavailable';
                }
            });
            document.addEventListener('fullscreenchange', () => {
                button.textContent = document.fullscreenElement === panel ? 'Exit expanded view' : 'Expand game';
            });
        });
    }
}

window.fanArcade = new FanArcade();
