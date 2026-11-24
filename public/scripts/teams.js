(() => {
    const teams = window.NFL_TEAMS;
    const pages = ['index.html', 'games.html', 'game.html', 'kick.html', 'barkley.html', 'jalen.html', 'playbook.html', 'leaders.html', 'counter.html', 'choose.html'];
    const page = location.pathname.split('/').pop() || 'index.html';
    const params = new URLSearchParams(location.search);
    let selected;
    try { selected = localStorage.getItem('nflTeam'); } catch { /* URL selection works without storage. */ }
    const team = teams.find(item => item.id === params.get('team')) || teams.find(item => item.id === selected);
    const safeNext = value => {
        try {
            const url = new URL(value || 'index.html', location.href);
            const file = url.pathname.split('/').pop() || 'index.html';
            if (url.origin !== location.origin || !pages.includes(file) || file === 'choose.html') return 'index.html';
            const query = new URLSearchParams();
            for (const key of ['game', 'photos', 'emulator']) if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key));
            return file + (query.size ? `?${query}` : '');
        } catch { return 'index.html'; }
    };
    if (!team && page !== 'choose.html') {
        const next = safeNext(location.href);
        location.replace(`choose.html?next=${encodeURIComponent(next)}`);
    }
    const current = team || teams.find(item => item.id === 'eagles');
    if (team) try { localStorage.setItem('nflTeam', team.id); } catch { /* Team stays in internal links. */ }
    const keyFor = key => key === 'fanNickname' || key === 'pageViewsCount' ? key : `nfl:${current.id}:${key}`;
    // Only Philadelphia inherits the original Eagles records; other clubs start fresh.
    if (current.id === 'eagles') {
        try {
            if (!localStorage.getItem('nfl:eagles:migrated')) {
                const keys = ['clickCount', 'barkleyBest', 'fieldGoalBest', 'fieldRunWins', 'jalenCleared', 'jalenProgress', 'arcadeLastGame', ...['pocket','shove','recall','punt','blitz','signal'].map(id => `playbook-${id}-best`)];
                for (const key of keys) {
                    const value = localStorage.getItem(key);
                    if (value !== null && localStorage.getItem(keyFor(key)) === null) localStorage.setItem(keyFor(key), value);
                }
                localStorage.setItem('nfl:eagles:migrated', '1');
            }
        } catch { /* Migration is optional when storage is blocked. */ }
    }
    const memory = new Map();
    const storage = {
        getItem(key) {
            const scoped = keyFor(key);
            try { return localStorage.getItem(scoped) ?? memory.get(scoped) ?? null; } catch { return memory.get(scoped) ?? null; }
        },
        setItem(key, value) {
            const scoped = keyFor(key);
            memory.set(scoped, String(value));
            try { localStorage.setItem(scoped, String(value)); } catch { /* Keep this session playable. */ }
        },
        removeItem(key) {
            memory.delete(keyFor(key));
            try { localStorage.removeItem(keyFor(key)); } catch { /* Nothing persisted. */ }
        }
    };
    const games = [
        {id:'game', href:'game.html', key:'fieldRunWins', target:5, unit:'clears', category:'action', description:'Collect every football in your team’s home end zone.', mark:'RUN'},
        {id:'bird', href:'barkley.html', key:'barkleyBest', target:20, unit:'gaps', category:'action', description:`Send your ${current.nickname} cartoon hero through a stadium obstacle course.`, mark:'FLY'},
        {id:'search', href:'jalen.html', key:'jalenCleared', target:5, unit:'scenes', category:'search', description:`Find your captain in five illustrated ${current.nickname} crowds. Zoom, inspect, and follow clues.`, mark:'FIND'},
        {id:'kick', href:'kick.html', key:'fieldGoalBest', target:15, unit:'points', category:'timing', description:'Read the crosswind and split your home uprights in five kicks.', mark:'KICK'},
        ...['pocket','shove','recall','punt','blitz','signal'].map((id, i) => ({id, href:`playbook.html?game=${id}`, key:`playbook-${id}-best`, target:[10,5,8,500,3,1][i], unit:['completions','touchdowns','rounds','points','fields','calls'][i], category:['action','timing','strategy','timing','strategy','strategy'][i], mark:['QB','PUSH','X O','PIN','BLITZ','CALL'][i]}))
    ];
    for (const game of games) game.title = current.games[game.id];
    const link = href => {
        const url = new URL(href, location.href);
        url.searchParams.set('team', current.id);
        if (['localhost','127.0.0.1'].includes(location.hostname) && params.get('emulator') === '1') url.searchParams.set('emulator','1');
        return url.pathname.split('/').pop() + url.search + url.hash;
    };
    const artGroups = {
        'NFC-East': ['eagles','cowboys','giants','commanders'], 'NFC-North': ['bears','lions','packers','vikings'],
        'NFC-South': ['falcons','panthers','saints','buccaneers'], 'NFC-West': ['cardinals','rams','49ers','seahawks'],
        'AFC-East': ['bills','dolphins','patriots','jets'], 'AFC-North': ['ravens','bengals','browns','steelers'],
        'AFC-South': ['texans','colts','jaguars','titans'], 'AFC-West': ['broncos','chiefs','raiders','chargers']
    };
    function artFor(item) {
        const division = `${item.conference}-${item.division}`;
        const row = ['North','West'].includes(item.division) ? 1 : 0;
        const col = artGroups[division].indexOf(item.id);
        const group = item.conference.toLowerCase() + (['East','North'].includes(item.division) ? '-east-north' : '-south-west');
        return {src:`assets/teams/${group}.png`, col, row};
    }
    const mascotImages = new Map();
    function paintArt(element, item = current) {
        const art = artFor(item);
        element.style.backgroundImage = 'none';
        element.classList.add('has-team-art');
        const canvas = document.createElement('canvas');
        canvas.className = 'team-art-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        element.prepend(canvas);
        if (!mascotImages.has(art.src)) {
            const image = new Image();
            image.src = art.src;
            mascotImages.set(art.src, image);
        }
        const image = mascotImages.get(art.src);
        const render = () => {
            const {width, height} = element.getBoundingClientRect();
            if (!width || !height || !image.naturalWidth) return;
            const ratio = Math.min(devicePixelRatio || 1, 2);
            canvas.width = Math.round(width * ratio);
            canvas.height = Math.round(height * ratio);
            const ctx = canvas.getContext('2d');
            const sw = image.naturalWidth / 4;
            const sh = image.naturalHeight / 2;
            const scale = Math.min(canvas.width / sw, canvas.height / sh);
            ctx.drawImage(image, art.col * sw, art.row * sh, sw, sh,
                (canvas.width - sw * scale) / 2, (canvas.height - sh * scale) / 2, sw * scale, sh * scale);
        };
        image.addEventListener('load', render, {once: true});
        const observer = new ResizeObserver(render);
        observer.observe(element);
        window.addEventListener('pagehide', () => observer.disconnect(), {once: true});
        render();
        element.setAttribute('role', 'img');
        element.setAttribute('aria-label', `Original ${item.nickname} fan cartoon: ${item.mascot}`);
    }
    function points(teamId = current.id) {
        const scores = {};
        for (const game of games) {
            let raw;
            try { raw = Number(teamId === current.id ? storage.getItem(game.key) : localStorage.getItem(`nfl:${teamId}:${game.key}`)); } catch { raw = 0; }
            scores[game.id] = Number.isSafeInteger(raw) && raw >= 0 ? Math.min(100, Math.floor(raw * 100 / game.target)) : 0;
        }
        return {scores, points:Object.values(scores).reduce((sum, value) => sum + value, 0)};
    }
    const root = document.documentElement;
    root.dataset.team = current.id;
    root.dataset.effect = current.effects;
    root.style.setProperty('--team-primary', current.primary);
    root.style.setProperty('--team-secondary', current.secondary);
    root.style.setProperty('--team-on-primary', current.ink);
    root.style.setProperty('--green', current.primary);
    root.style.setProperty('--team-art', `url('${artFor(current).src}')`);
    const tints = new Map();
    function tint(hex) {
        if (current.id === 'eagles') return hex;
        if (tints.has(hex)) return tints.get(hex);
        const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
        const light = (Math.max(...rgb) + Math.min(...rgb)) / 510;
        const base = [1, 3, 5].map(offset => parseInt(current.primary.slice(offset, offset + 2), 16));
        const weight = light > 0.3 ? (1 - light) : Math.min(1, light / 0.24);
        const end = light > 0.3 ? 255 : 8;
        const value = '#' + base.map(channel => Math.round(channel * weight + end * (1 - weight)).toString(16).padStart(2, '0')).join('') + hex.slice(7);
        tints.set(hex, value);
        return value;
    }
    window.teamArcade = {tint, team:current, teams, storage, keyFor, games, link, safeNext, artFor, paintArt, points};
})();
