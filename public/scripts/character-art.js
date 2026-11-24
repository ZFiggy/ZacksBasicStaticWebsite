// Four original, separately illustrated player roles for every team.
(() => {
    const api = window.teamArcade;
    const ids = ['eagles', 'cowboys', 'giants', 'commanders', 'bears', 'lions', 'packers', 'vikings', 'falcons', 'panthers', 'saints', 'buccaneers', 'cardinals', 'rams', '49ers', 'seahawks', 'bills', 'dolphins', 'patriots', 'jets', 'ravens', 'bengals', 'browns', 'steelers', 'texans', 'colts', 'jaguars', 'titans', 'broncos', 'chiefs', 'raiders', 'chargers'];
    const roles = ['runner', 'quarterback', 'kicker', 'defender'];
    const teamIndex = ids.indexOf(api.team.id);
    const images = new Map();
    function descriptor(role) {
        return {src: `assets/characters/cast-${Math.floor(teamIndex / 4)}.png`, cols: 4, rows: 4, index: teamIndex % 4 * 4 + roles.indexOf(role), trimAlpha: true};
    }
    function load(role) {
        const cover = descriptor(role);
        if (!images.has(cover.src)) {
            const promise = api.loadGameImage(cover.src);
            images.set(cover.src, {promise});
            promise.then(image => {
                images.get(cover.src).image = image;
                document.myGame?.redraw();
                document.kickGame?.draw();
            }).catch(() => {});
        }
        return images.get(cover.src);
    }
    function draw(ctx, role, x, y, width, height, flip = false) {
        const {image} = load(role);
        if (!image) return false;
        ctx.save();
        if (flip) { ctx.translate(x + width, y); ctx.scale(-1, 1); x = 0; y = 0; }
        api.drawGameCover(ctx, image, descriptor(role), x, y, width, height, 'contain');
        ctx.restore();
        return true;
    }
    function paint(element, role, label = api.personality[role].name) {
        const canvas = document.createElement('canvas');
        canvas.className = 'player-character';
        canvas.width = 320;
        canvas.height = 360;
        canvas.dataset.role = role;
        canvas.dataset.character = label;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', label);
        element.append(canvas);
        load(role).promise.then(() => {
            if (!canvas.isConnected) return;
            draw(canvas.getContext('2d'), role, 0, 0, 320, 360);
            canvas.dataset.ready = 'true';
        }).catch(() => { canvas.dataset.ready = 'error'; });
        return canvas;
    }
    const order = api.team.id === 'eagles' ? ['game', 'kick', 'pocket', 'shove', 'recall', 'punt', 'blitz', 'signal'] : ['game', 'bird', 'search', 'kick', 'pocket', 'shove', 'recall', 'punt', 'blitz', 'signal'];
    function world(element, id) {
        const cols = api.team.id === 'eagles' ? 4 : 5;
        const index = order.indexOf(id);
        if (index < 0) return;
        element.classList.add('character-world');
        element.style.setProperty('--world-image', `url("assets/game-covers/${api.team.id}.png")`);
        element.style.setProperty('--world-size', `${cols * 100}% 200%`);
        element.style.setProperty('--world-position', `${index % cols / (cols - 1) * 100}% ${index >= cols ? 100 : 0}%`);
    }
    window.teamCharacters = {draw, paint, world, descriptor};
})();
