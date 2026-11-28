// Complete illustrated poses. Action atlases provide anatomically drawn frames;
// the original card art and each supporting player's identity stay independent.
(() => {
    const api = window.teamArcade;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const ids = Object.keys(window.NFL_PERSONALITIES);
    const files = new Map();
    const stills = new Map();
    const supporting = ['receiver', 'receiver2', 'lineman', 'corner'];
    function roleFor(role, variant = 0) {
        if (role === 'receiver') return variant % 3 === 0 ? 'runner' : variant % 3 === 1 ? 'receiver' : 'receiver2';
        if (role === 'holder') return 'quarterback';
        if (role === 'rusher') return 'defender';
        if (role === 'safety') return 'corner';
        return role;
    }
    function identity(role, teamId = api.team.id, variant = 0) {
        const resolved = roleFor(role, variant);
        return window.playerRoster?.[teamId]?.[resolved] || window.NFL_PERSONALITIES[teamId]?.[resolved] || {name: role, number: ''};
    }
    function descriptor(role, teamId = api.team.id, variant = 0, action = 'idle', progress = 0, time = 0) {
        const resolved = roleFor(role, variant), index = ids.indexOf(teamId);
        if (['run', 'rush'].includes(action) && resolved === 'runner') return {
            src: `assets/characters/run-cycle-${Math.floor(index / 4)}.png`, cols: 4, rows: 4,
            index: index % 4 * 4 + (reduced.matches ? 0 : Math.floor(time * 8 + variant) % 4), groupSize: 4
        };
        if ((action === 'throw' && resolved === 'quarterback') || (action === 'kick' && resolved === 'kicker')) return {
            src: `assets/characters/actions-${Math.floor(index / 4)}.png`, cols: 6, rows: 4,
            index: index % 4 * 6 + (resolved === 'kicker' ? 3 : 0) + Math.min(2, Math.floor((reduced.matches ? 1 : Math.max(0, progress)) * 3)), groupSize: 3
        };
        if (supporting.includes(resolved)) return {src: `assets/characters/roster-${Math.floor(index / 4)}.png`, cols: 4, rows: 4, index: index % 4 * 4 + supporting.indexOf(resolved), trimAlpha: true, character: true};
        if (resolved === 'quarterback' || resolved === 'kicker') return {
            src: `assets/characters/motion-core-${Math.floor(index / 8)}.png`, cols: 4, rows: 4,
            index: Math.floor(index % 8 / 2) * 4 + index % 2 * 2 + (resolved === 'kicker' ? 1 : 0), trimAlpha: true, character: true
        };
        return window.teamCharacters.descriptor(resolved, teamId);
    }
    function fileFor(src) {
        if (!files.has(src)) {
            const entry = {groups: new Map()}; files.set(src, entry);
            entry.promise = api.loadGameImage(src).then(image => {
                entry.image = image;
                document.myGame?.redraw(); document.kickGame?.draw();
                return image;
            });
            // Rendering can continue with the standing pose while assets load.
            entry.promise.catch(error => { entry.error = error.message; });
        }
        return files.get(src);
    }
    function groupBounds(entry, d) {
        const start = Math.floor(d.index / d.groupSize) * d.groupSize;
        const key = `${d.cols}:${start}`;
        if (entry.groups.has(key)) return entry.groups.get(key);
        const sprites = api.characterSpritesFor(entry.image, d.cols, d.rows);
        const cw = entry.image.naturalWidth / d.cols, ch = entry.image.naturalHeight / d.rows;
        let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
        for (let frame = start; frame < start + d.groupSize; frame++) {
            const sprite = sprites[frame];
            if (!sprite) continue;
            const rx = sprite.sourceBounds.left - frame % d.cols * cw;
            const ry = sprite.sourceBounds.top - Math.floor(frame / d.cols) * ch;
            left = Math.min(left, rx); right = Math.max(right, rx + sprite.width);
            top = Math.min(top, ry); bottom = Math.max(bottom, ry + sprite.height);
        }
        const bounds = {left, right, top, bottom, cw, ch, sprites}; entry.groups.set(key, bounds); return bounds;
    }
    function stillFor(d, image) {
        const key = `${d.src}:${d.index}`;
        if (!stills.has(key)) {
            const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 200;
            api.drawGameCover(canvas.getContext('2d'), image, d, 0, 0, 160, 200, 'contain');
            stills.set(key, canvas);
        }
        return stills.get(key);
    }
    function draw(ctx, role, x, y, width, height, options = {}) {
        const {teamId = api.team.id, action = 'idle', time = 0, variant = 0, flip = false, progress = 0.5} = options;
        const d = descriptor(role, teamId, variant, action, progress, time), entry = fileFor(d.src);
        if (!entry.image) {
            const fallback = descriptor(role, teamId, variant);
            const ready = fileFor(fallback.src);
            if (ready.image) return draw(ctx, role, x, y, width, height, {teamId, variant, flip, action: 'idle'});
            return window.teamCharacters.draw(ctx, ['quarterback', 'kicker', 'runner', 'defender'].includes(role) ? role : 'defender', x, y, width, height, flip, teamId);
        }
        ctx.save(); ctx.translate(x + width / 2, y + height);
        if (flip) ctx.scale(-1, 1);
        if (action === 'tackle') ctx.rotate(Math.min(1, progress) * 1.15);
        if (d.groupSize) {
            // Use ONE union crop and scale for an entire action, never auto-fit
            // each frame separately: planted feet and head scale stay stable.
            const b = groupBounds(entry, d), sprite = b.sprites[d.index];
            if (sprite) {
                const scale = height / (b.bottom - b.top);
                const rx = sprite.sourceBounds.left - d.index % d.cols * b.cw;
                const ry = sprite.sourceBounds.top - Math.floor(d.index / d.cols) * b.ch;
                ctx.drawImage(sprite, (rx - b.cw / 2) * scale, (ry - b.bottom) * scale, sprite.width * scale, sprite.height * scale);
            }
        } else {
            const source = stillFor(d, entry.image);
            const moving = ['run', 'rush'].includes(action) && !reduced.matches;
            const phase = time * 13 + variant * 1.7;
            if (action === 'block') ctx.rotate(flip ? -0.07 : 0.07);
            if (role === 'holder') { ctx.translate(0, 2); ctx.scale(1, 0.72); }
            if (moving) ctx.translate(0, -Math.abs(Math.sin(phase)) * height * 0.025);
            // Supporting players retain their actual complete body textures.
            // Small footwork shifts keep joints connected instead of cutting limbs.
            for (let row = 0; row < 20; row++) {
                const weight = Math.max(0, (row - 12) / 7);
                const shift = moving ? Math.sin(phase) * weight * width * 0.035 : 0;
                ctx.drawImage(source, 0, row * 10, 160, 10, -width / 2 + shift, -height + row / 20 * height, width, height / 20 + 0.15);
            }
        }
        ctx.restore(); return true;
    }
    function preload(teamId = api.team.id) {
        const index = ids.indexOf(teamId);
        return Promise.all([
            `assets/characters/roster-${Math.floor(index / 4)}.png`,
            `assets/characters/motion-core-${Math.floor(index / 8)}.png`,
            `assets/characters/actions-${Math.floor(index / 4)}.png`,
            `assets/characters/run-cycle-${Math.floor(index / 4)}.png`
        ].map(src => fileFor(src).promise)).then(images => {
            images.forEach((image, i) => api.characterSpritesFor(image, i === 2 ? 6 : 4, 4));
            return images;
        });
    }
    window.playerMotion = {draw, identity, descriptor, preload, roles: ['receiver', 'lineman', 'holder', 'safety', 'corner', 'rusher', 'runner', 'quarterback', 'kicker']};
})();
