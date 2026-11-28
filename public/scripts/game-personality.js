(() => {
    const api = window.teamArcade;
    const profiles = window.NFL_PERSONALITIES || {};
    const order = ['game', 'bird', 'search', 'kick', 'pocket', 'shove', 'recall', 'punt', 'blitz', 'signal'];
    const focusY = {game:0.18,bird:0.3,search:0.5,kick:0.4,pocket:0.6,shove:0.5,recall:0.45,punt:0.2,blitz:0.2,signal:0.5};
    const eaglesOrder = ['game', 'kick', 'pocket', 'shove', 'recall', 'punt', 'blitz', 'signal'];
    const images = new Map();
    const alphaBounds = new WeakMap();
    const characterSprites = new WeakMap();
    const observers = [];

    function imageFor(src) {
        if (!images.has(src)) {
            images.set(src, new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error(`Could not load artwork: ${src}`));
                image.src = src;
            }));
        }
        return images.get(src);
    }

    const media = window.NFL_TEAM_MEDIA || {};
    function paintTeamPhoto(element, role, team = api.team) {
        const photo = element.classList.contains('team-choice-art') ? (media[team.id]?.selection || media[team.id]?.[role]) : media[team.id]?.[role];
        if (!photo) return api.paintArt(element, team);
        element.classList.add('has-team-photo');
        const image = document.createElement('img');
        image.className = 'team-photo';
        image.src = photo.src;
        image.alt = `${team.name}: ${photo.alt || 'home crowd'}`;
        image.decoding = 'async';
        image.style.objectPosition = photo.objectPosition || 'center';
        if (photo.frameScale) image.style.setProperty('--team-photo-scale', photo.frameScale);
        if (element.classList.contains('team-choice-art')) {
            image.loading = 'lazy';
            element.replaceChildren(image);
            element.title = photo.credit;
            return;
        }
        const credit = document.createElement('a');
        credit.className = 'team-photo-credit';
        credit.href = photo.sourcePage;
        credit.target = '_blank'; credit.rel = 'noopener noreferrer';
        credit.textContent = `Photo: ${photo.credit}`;
        if (element.classList.contains('team-hero-art')) {
            element.replaceChildren(image);
            credit.className = 'team-source-credit';
            document.querySelector('.team-hero-copy')?.append(credit);
        } else element.replaceChildren(image, credit);
    }

    // Generated from assets/game-covers/sprite-plays-v1/manifest.json.
    // BEGIN SPRITE PLAY FRAMES
    const playSceneFrames = {
        'eagles': [0,0.33430402,0.67792662,1],
        'cowboys': [0,0.33372161,0.66744321,1],
        'giants': [0,0.33546884,0.67734421,1],
        'commanders': [0,0.33430402,0.66744321,1],
        'bears': [0,0.33546884,0.66860804,1],
        'lions': [0,0.3331392,0.66744321,1],
        'packers': [0,0.33372161,0.66627839,1],
        'vikings': [0,0.33488643,0.67734421,1],
        'falcons': [0,0.34653465,0.6721025,1],
        'panthers': [0,0.33372161,0.66744321,1],
        'saints': [0,0.33372161,0.66511357,1],
        'buccaneers': [0,0.33488643,0.67734421,1],
        'cardinals': [0,0.3331392,0.66919045,1],
        'rams': [0,0.33430402,0.66802563,1],
        '49ers': [0,0.33488643,0.67734421,1],
        'seahawks': [0,0.33605125,0.66802563,1],
        'bills': [0,0.33488643,0.6721025,1],
        'dolphins': [0,0.33430402,0.66744321,1],
        'patriots': [0,0.35294118,0.68666278,1],
        'jets': [0,0.33197437,0.66744321,1],
        'ravens': [0,0.33372161,0.66744321,1],
        'bengals': [0,0.34595224,0.67152009,1],
        'browns': [0,0.33352736,0.66705471,1],
        'steelers': [0,0.33197437,0.6668608,1],
        'texans': [0,0.33197437,0.66569598,1],
        'colts': [0,0.33197437,0.66569598,1],
        'jaguars': [0,0.33372161,0.66744321,1],
        'titans': [0,0.3331392,0.66627839,1],
        'broncos': [0,0.33372161,0.66627839,1],
        'chiefs': [0,0.33372161,0.66744321,1],
        'raiders': [0,0.33255679,0.66569598,1],
        'chargers': [0,0.33197437,0.66919045,1]
    };
    // END SPRITE PLAY FRAMES

    function coverFor(id, team = api.team) {
        if (id === 'bird') return {...profiles[team.id].flightSprite, cutout: true};
        if (team.id === 'eagles' && id === 'search') return {src: 'assets/search-level-3-v2.jpg', cols: 1, rows: 1, index: 0, photo: true};
        const photos = window.NFL_PHOTO_SCENES?.[team.id];
        if (id === 'search' && photos) return photos.scenes[0].src
            ? {src: photos.scenes[0].src, cols: 1, rows: 1, index: 0, photo: true}
            : {src: photos.src, cols: photos.cols, rows: photos.rows, index: 0, region: photos.scenes[0].region, photo: true};
        const playIndex = ['game', 'pocket', 'kick'].indexOf(id);
        const frames = playSceneFrames[team.id];
        if (playIndex >= 0 && frames) return {
            src: `assets/game-covers/sprite-plays-v1/${team.id}.png`,
            cols: 1, rows: 3, index: playIndex, illustration: true,
            region: [0, frames[playIndex], 1, frames[playIndex + 1] - frames[playIndex]]
        };
        const roles = {game: 'runner', kick: 'kicker', pocket: 'quarterback', shove: 'runner', recall: 'quarterback', punt: 'kicker', blitz: 'defender', signal: 'quarterback'};
        if (roles[id]) {
            const teamIndex = Object.keys(profiles).indexOf(team.id);
            const sheet = Math.floor(teamIndex / 4);
            return {src: `assets/characters/cast-${sheet}${sheet === 0 ? '-v2' : ''}.png`, cols: 4, rows: 4, index: teamIndex % 4 * 4 + ['runner', 'quarterback', 'kicker', 'defender'].indexOf(roles[id]), trimAlpha: true, character: true};
        }
        return {src: `assets/game-covers/${team.id}.png`, cols: team.id === 'eagles' ? 4 : 5, rows: 2, index: (team.id === 'eagles' ? eaglesOrder : order).indexOf(id), focusY: focusY[id]};
    }

    // The illustrated sheets are not an exact grid: hands and feet cross cell
    // boundaries. Separate connected silhouettes before framing each character.
    function spritesFor(image, cols, rows) {
        if (characterSprites.has(image)) return characterSprites.get(image);
        const sample = document.createElement('canvas');
        sample.width = image.naturalWidth;
        sample.height = image.naturalHeight;
        const context = sample.getContext('2d', {willReadFrequently: true});
        context.drawImage(image, 0, 0);
        const {width, height} = sample;
        const pixels = context.getImageData(0, 0, width, height).data;
        const labels = new Int32Array(width * height);
        const queue = new Int32Array(labels.length);
        const components = [];
        let label = 0;
        for (let start = 0; start < labels.length; start++) {
            if (labels[start] || pixels[start * 4 + 3] < 40) continue;
            label++;
            let head = 0, tail = 1;
            let left = width, top = height, right = 0, bottom = 0;
            queue[0] = start;
            labels[start] = label;
            while (head < tail) {
                const position = queue[head++];
                const px = position % width, py = Math.floor(position / width);
                left = Math.min(left, px); right = Math.max(right, px);
                top = Math.min(top, py); bottom = Math.max(bottom, py);
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    if (px + dx < 0 || px + dx >= width || py + dy < 0 || py + dy >= height) continue;
                    const next = position + dy * width + dx;
                    if (labels[next] || pixels[next * 4 + 3] < 40) continue;
                    labels[next] = label;
                    queue[tail++] = next;
                }
            }
            if (tail < 3000) continue;
            const index = Math.min(rows - 1, Math.floor((top + bottom) / 2 / height * rows)) * cols
                + Math.min(cols - 1, Math.floor((left + right) / 2 / width * cols));
            if (!components[index] || components[index].area < tail) components[index] = {label, left, top, right, bottom, area: tail};
        }
        const sprites = components.map(part => {
            const left = Math.max(0, part.left - 2), top = Math.max(0, part.top - 2);
            const sprite = document.createElement('canvas');
            sprite.width = Math.min(width, part.right + 3) - left;
            sprite.height = Math.min(height, part.bottom + 3) - top;
            sprite.sourceBounds = {left, top};
            const spriteContext = sprite.getContext('2d');
            const data = spriteContext.createImageData(sprite.width, sprite.height);
            for (let sy = 0; sy < sprite.height; sy++) for (let sx = 0; sx < sprite.width; sx++) {
                const px = left + sx, py = top + sy, position = py * width + px;
                let belongs = labels[position] === part.label;
                // Retain the original antialiased fringe, but exclude neighbors.
                if (!labels[position] && pixels[position * 4 + 3]) {
                    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                        if (px + dx >= 0 && px + dx < width && py + dy >= 0 && py + dy < height
                            && labels[position + dy * width + dx] === part.label) belongs = true;
                    }
                }
                if (belongs) data.data.set(pixels.subarray(position * 4, position * 4 + 4), (sy * sprite.width + sx) * 4);
            }
            spriteContext.putImageData(data, 0, 0);
            return sprite;
        });
        characterSprites.set(image, sprites);
        return sprites;
    }

    function drawCover(ctx, image, cover, x, y, width, height, fit = 'cover') {
        if (cover.character) {
            const sprite = spritesFor(image, cover.cols, cover.rows)[cover.index];
            if (sprite) {
                const scale = Math.min(width / sprite.width, height / sprite.height);
                ctx.save();
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(sprite, x + (width - sprite.width * scale) / 2, y + (height - sprite.height * scale) / 2, sprite.width * scale, sprite.height * scale);
                ctx.restore();
                return;
            }
        }
        let tileWidth = image.naturalWidth / cover.cols;
        let tileHeight = image.naturalHeight / cover.rows;
        let sourceX = cover.index % cover.cols * tileWidth;
        let sourceY = Math.floor(cover.index / cover.cols) * tileHeight;
        if (cover.region) {
            const [left, top, width, height] = cover.region;
            sourceX = left * image.naturalWidth; sourceY = top * image.naturalHeight;
            tileWidth = width * image.naturalWidth; tileHeight = height * image.naturalHeight;
        }
        if (cover.trimAlpha) {
            if (!alphaBounds.has(image)) alphaBounds.set(image, new Map());
            const key = `${cover.cols}/${cover.rows}/${cover.index}`;
            const cache = alphaBounds.get(image);
            if (!cache.has(key)) {
                const sample = document.createElement('canvas');
                sample.width = 256;
                sample.height = 256;
                const sampleContext = sample.getContext('2d', {willReadFrequently: true});
                sampleContext.drawImage(image, sourceX, sourceY, tileWidth, tileHeight, 0, 0, 256, 256);
                const pixels = sampleContext.getImageData(0, 0, 256, 256).data;
                let left = 256, top = 256, right = 0, bottom = 0;
                for (let sy = 0; sy < 256; sy++) for (let sx = 0; sx < 256; sx++) {
                    if (pixels[(sy * 256 + sx) * 4 + 3] < 40) continue;
                    left = Math.min(left, sx); top = Math.min(top, sy);
                    right = Math.max(right, sx); bottom = Math.max(bottom, sy);
                }
                cache.set(key, left < right && top < bottom ? [Math.max(0,left-3)/256, Math.max(0,top-3)/256, Math.min(256,right+4)/256, Math.min(256,bottom+4)/256] : [0,0,1,1]);
            }
            const [left,top,right,bottom] = cache.get(key);
            sourceX += left * tileWidth;
            sourceY += top * tileHeight;
            tileWidth *= right - left;
            tileHeight *= bottom - top;
        }
        const scale = fit === 'contain' ? Math.min(width / tileWidth, height / tileHeight) : Math.max(width / tileWidth, height / tileHeight);
        const renderedWidth = tileWidth * scale;
        const renderedHeight = tileHeight * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, sourceX, sourceY, tileWidth, tileHeight, x + (width - renderedWidth) / 2, y + (height - renderedHeight) * (fit === 'contain' ? 0.5 : cover.focusY ?? 0.5), renderedWidth, renderedHeight);
        ctx.restore();
    }

    function paintGameArt(element, id, team = api.team) {
        const cover = coverFor(id, team);
        const canvas = document.createElement('canvas');
        canvas.className = 'game-cover-canvas';
        element.classList.add('has-game-cover');
        element.dataset.cover = `${cover.src}#${cover.index}`;
        element.dataset.gameArt = id;
        if (cover.illustration) element.dataset.sceneStyle = 'ai-sprite-play';
        element.style.backgroundImage = 'none';
        element.setAttribute('role', 'img');
        element.setAttribute('aria-label', `${team.games[id]}: ${profiles[team.id]?.gameHooks[id] || 'Football artwork'}`);
        canvas.setAttribute('aria-hidden', 'true');
        element.replaceChildren(canvas);
        const render = async () => {
            const box = element.getBoundingClientRect();
            if (!box.width || !box.height) return;
            const ratio = Math.min(devicePixelRatio || 1, 2);
            canvas.width = Math.round(box.width * ratio);
            canvas.height = Math.round(box.height * ratio);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = cover.photo ? '#0b1d28' : team.primary;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            try {
                const image = await imageFor(cover.src);
                if (!element.isConnected) return;
                const tileRatio = cover.region
                    ? image.naturalWidth * cover.region[2] / (image.naturalHeight * cover.region[3])
                    : (image.naturalWidth / cover.cols) / (image.naturalHeight / cover.rows);
                element.style.setProperty('--art-ratio', tileRatio);
                const frame = element.closest('.team-library-art') || element;
                frame.style.setProperty('--art-ratio', tileRatio);
                if (cover.cutout) {
                    const sky = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                    sky.addColorStop(0, '#142b42');
                    sky.addColorStop(1, team.primary);
                    ctx.fillStyle = sky;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                if (cover.character) {
                    const world = await imageFor(`assets/game-covers/${team.id}.png`);
                    const sceneOrder = team.id === 'eagles' ? eaglesOrder : order;
                    drawCover(ctx, world, {cols: team.id === 'eagles' ? 4 : 5, rows: 2, index: sceneOrder.indexOf(id)}, 0, 0, canvas.width, canvas.height, 'cover');
                    ctx.fillStyle = '#071b3055';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                drawCover(ctx, image, cover, 0, 0, canvas.width, canvas.height, cover.cutout || cover.character ? 'contain' : 'cover');
                element.dataset.artReady = 'true';
            } catch {
                element.dataset.artReady = 'error';
            }
        };
        const observer = new ResizeObserver(render);
        observer.observe(element);
        observers.push(observer);
        render();
    }

    for (const team of api.teams) {
        const profile = profiles[team.id];
        if (!profile) continue;
        team.games.game = 'Touchdown Rush';
        team.games.pocket = 'Passing Drive';
        profile.gameHooks.pocket = 'Call a route, work the pocket against the rival rush, and lead a receiver. Control the catcher to finish the drive.';
        profile.gameHooks.game = `Run with ${profile.runner.name}. Outrun rival chasers, collect the football, and score with fewer steps for more stars.`;
        team.games.bird = profile.flierTitle;
        profile.gameHooks.bird = `${profile.runner.name} takes flight in ${profile.flierTitle}. Carry the football through the hometown obstacles and chase the next gap.`;
        const searchPlayer = window.NFL_PHOTO_SCENES?.[team.id]?.playerName || profile.searchPlayer?.name || profile.quarterback.name;
        profile.gameHooks.search = `Find ${searchPlayer} naturally blended into five crowded situations. Compare the face reference and follow the clues.`;
        if (window.NFL_PHOTO_SCENES?.[team.id]?.authentic) {
            profile.searchTitle = `${team.nickname} Photo Hunt`;
            profile.gameHooks.search = 'Search real team football photos for small faces, helmets, and jersey details. Five hard rounds; use zoom and optional hints.';
        }
        if (window.NFL_PHOTO_SCENES?.[team.id]?.consistentPerson) {
            profile.searchTitle = `Where’s ${searchPlayer.split(' ')[0]}?`;
            profile.gameHooks.search = `Find ${searchPlayer} in five real ${team.nickname} crowd photographs. The same face every round, carefully inserted among the spectators. Compare the portrait and zoom past the front row.`;
        }
        team.games.search = profile.searchTitle;
    }
    api.personality = profiles[api.team.id];
    for (const game of api.games) {
        game.title = api.team.games[game.id];
        game.description = api.personality?.gameHooks[game.id] || game.description;
    }
    api.media = media[api.team.id];
    api.paintTeamPhoto = paintTeamPhoto;
    api.coverFor = coverFor;
    api.paintGameArt = paintGameArt;
    api.loadGameImage = imageFor;
    api.drawGameCover = drawCover;
    api.characterSpritesFor = spritesFor;
    window.addEventListener('pagehide', () => observers.forEach(observer => observer.disconnect()));
})();
