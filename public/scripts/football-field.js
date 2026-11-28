// Shared painted turf and stadium details; cached grain stays fixed between frames.
(() => {
    const logos = new Map();
    const grain = document.createElement('canvas');
    grain.width = 96; grain.height = 96;
    const g = grain.getContext('2d');
    for (let i = 0; i < 520; i++) {
        g.fillStyle = i % 2 ? '#ffffff0b' : '#00000016';
        g.fillRect((i * 43) % 96, (i * 71 + Math.floor(i / 96) * 13) % 96, 1, 2);
    }
    function logoFor(team) {
        if (team.id !== 'eagles') return null;
        if (!logos.has(team.id)) {
            const image = new Image(); image.src = 'assets/team-logos/eagles.png';
            image.onload = () => { document.passingGame?.draw(); document.kickGame?.draw(); document.myGame?.redraw(); };
            logos.set(team.id, image);
        }
        return logos.get(team.id);
    }
    // Representative home paint families. Seasonal/throwback fields can differ.
    const palettes = {
        cowboys: ['#102b4e', '#ffffff', '#b9c7d1'], giants: ['#0b2265', '#ffffff', '#a71930'],
        commanders: ['#5a1414', '#ffb612', '#ffffff'], bears: ['#101d32', '#ffffff', '#d75b27'],
        packers: ['#244631', '#ffcf31', '#ffffff'], lions: ['#0076b6', '#ffffff', '#b0b7bc'],
        vikings: ['#4f2683', '#ffcf31', '#ffffff'], saints: ['#171715', '#d3bc8d', '#ffffff'],
        falcons: ['#a71930', '#ffffff', '#101820'], panthers: ['#111820', '#ffffff', '#0085ca'],
        buccaneers: ['#b32025', '#ffffff', '#34302b'], rams: ['#003594', '#ffd100', '#ffffff'],
        '49ers': ['#aa0000', '#ffffff', '#b3995d'], seahawks: ['#002244', '#ffffff', '#69be28'],
        cardinals: ['#97233f', '#ffffff', '#111820'], bills: ['#00338d', '#ffffff', '#c60c30'],
        jets: ['#125740', '#ffffff', '#ffffff'], dolphins: ['#008e97', '#ffffff', '#fc4c02'],
        patriots: ['#002244', '#ffffff', '#c60c30'], ravens: ['#24135f', '#ffffff', '#c5a76b'],
        bengals: ['#fb4f14', '#ffffff', '#101820'], browns: ['#311d00', '#ffffff', '#ff3c00'],
        steelers: ['#ffb612', '#171715', '#ffffff'], colts: ['#003b7b', '#ffffff', '#ffffff'],
        jaguars: ['#006778', '#ffffff', '#d7a22a'], titans: ['#0c2340', '#ffffff', '#4b92db'],
        texans: ['#071e2d', '#ffffff', '#c8102e'], chiefs: ['#e31837', '#ffb81c', '#ffffff'],
        broncos: ['#fb4f14', '#ffffff', '#002244'], raiders: ['#111111', '#ffffff', '#a5acaf'],
        chargers: ['#0080c6', '#ffc20e', '#ffffff']
    };
    const branding = new Map();
    function brandingFor(team) {
        if (!branding.has(team.id)) {
            const entry = {};
            entry.ready = Promise.all(['logo', 'wordmark'].map(kind => new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    entry[kind] = img;
                    if (kind === 'logo') {
                        const outline = document.createElement('canvas'); outline.width = img.naturalWidth; outline.height = img.naturalHeight;
                        const ctx = outline.getContext('2d'); ctx.drawImage(img, 0, 0);
                        ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, outline.width, outline.height);
                        entry.logoOutline = outline;
                    }
                    if (kind === 'wordmark') {
                        const mask = document.createElement('canvas'); mask.width = img.naturalWidth; mask.height = img.naturalHeight;
                        const ctx = mask.getContext('2d'); ctx.drawImage(img, 0, 0);
                        const data = ctx.getImageData(0, 0, mask.width, mask.height).data;
                        let left = mask.width, top = mask.height, right = 0, bottom = 0;
                        for (let yy = 0; yy < mask.height; yy++) for (let xx = 0; xx < mask.width; xx++) if (data[(yy * mask.width + xx) * 4 + 3] > 25) {
                            left = Math.min(left, xx); top = Math.min(top, yy); right = Math.max(right, xx); bottom = Math.max(bottom, yy);
                        }
                        entry.crop = [left, top, right - left + 1, bottom - top + 1];
                        ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = palettes[team.id][1]; ctx.fillRect(0, 0, mask.width, mask.height);
                        entry.paint = mask;
                    }
                    resolve(); document.passingGame?.draw(); document.kickGame?.draw(); document.myGame?.redraw();
                };
                img.onerror = () => reject(new Error(`Missing field ${kind}: ${team.id}`));
                img.src = `assets/field-branding/${team.id}-${kind}.png`;
            })));
            entry.ready.catch(() => {}); branding.set(team.id, entry);
        }
        return branding.get(team.id);
    }
    function endzone(c, x, y, width, height, team, side = 'right', rotation = 0) {
        const [base, lettering, trim] = palettes[team.id] || [team.primary, '#ffffff', '#b6c6cb'];
        const art = team.id === 'eagles' ? null : brandingFor(team);
        c.save(); c.beginPath(); c.rect(x, y, width, height); c.clip();
        c.fillStyle = base; c.fillRect(x, y, width, height);
        c.fillStyle = c.createPattern(grain, 'repeat'); c.fillRect(x, y, width, height);
        c.strokeStyle = trim; c.lineWidth = 2; c.strokeRect(x + 4, y + 4, width - 8, height - 8);
        // The top of each mark points toward midfield. Artwork is fitted in
        // physical canvas units, so different field proportions never stretch it.
        c.translate(x + width / 2, y + height / 2);
        c.rotate((side === 'left' ? Math.PI / 2 : -Math.PI / 2) + rotation);
        if (team.id === 'bengals') {
            c.fillStyle = '#111111';
            for (let i = -height / 2; i < height / 2; i += height / 9) {
                c.beginPath(); c.moveTo(i, -width / 2); c.lineTo(i + height / 14, -width / 2); c.lineTo(i + height / 10, -width / 8); c.closePath(); c.fill();
                c.beginPath(); c.moveTo(i, width / 2); c.lineTo(i + height / 14, width / 2); c.lineTo(i + height / 24, width / 8); c.closePath(); c.fill();
            }
        }
        if (art?.paint && art.crop) {
            const [sx, sy, sw, sh] = art.crop;
            const factor = Math.min(height * 0.66 / sw, width * 0.58 / sh);
            c.drawImage(art.paint, sx, sy, sw, sh, -sw * factor / 2, -sh * factor / 2, sw * factor, sh * factor);
        } else {
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.font = 'italic 900 52px Impact, Arial Black, sans-serif';
            const text = team.nickname.toUpperCase();
            const factor = Math.min(height * 0.6 / c.measureText(text).width, width * 0.46 / 52);
            c.save(); c.scale(factor, factor);
            c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = '#071a23'; c.strokeText(text, 0, 0);
            c.fillStyle = lettering; c.fillText(text, 0, 0); c.restore();
        }
        const logo = art?.logo || (team.id === 'eagles' ? logoFor(team) : null);
        if (logo?.complete && logo.naturalWidth) {
            const factor = Math.min(height * 0.12 / logo.naturalWidth, width * 0.48 / logo.naturalHeight);
            const ww = logo.naturalWidth * factor, hh = logo.naturalHeight * factor;
            for (const xx of [-height * 0.414, height * 0.414]) {
                if (art?.logoOutline) for (const [dx, dy] of [[-0.8, 0], [0.8, 0], [0, -0.8], [0, 0.8]]) c.drawImage(art.logoOutline, xx - ww / 2 + dx, -hh / 2 + dy, ww, hh);
                c.drawImage(logo, xx - ww / 2, -hh / 2, ww, hh);
            }
        }
        c.restore(); c.save(); c.strokeStyle = '#f2f4e8'; c.lineWidth = 3; c.strokeRect(x, y, width, height); c.restore();
    }
    function preload() {
        const eagle = logoFor({id: 'eagles'});
        const ready = eagle.complete && eagle.naturalWidth ? Promise.resolve() : new Promise((resolve, reject) => {
            eagle.addEventListener('load', resolve, {once: true}); eagle.addEventListener('error', reject, {once: true});
        });
        return Promise.all([ready, ...NFL_TEAMS.filter(team => team.id !== 'eagles').map(team => brandingFor(team).ready)]);
    }
    function pylon(c, x, y) {
        c.save(); c.fillStyle = '#061c2460'; c.beginPath(); c.ellipse(x + 3, y + 5, 5, 3, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ec6f21'; c.fillRect(x - 3, y - 6, 6, 11);
        c.fillStyle = '#ffc779'; c.fillRect(x - 3, y - 6, 6, 2); c.restore();
    }
    function goalpost(c, x, y, team, scale = 1) {
        c.save(); c.translate(x, y); c.scale(scale, scale);
        // Both uprights attach to one crossbar, with the stanchion behind the end line.
        c.strokeStyle = '#071c2770'; c.lineWidth = 7; c.lineCap = 'round';
        c.beginPath(); c.moveTo(6, 9); c.lineTo(6, -47); c.lineTo(-5, -65); c.stroke();
        const gold = c.createLinearGradient(-20, 0, 12, 0);
        gold.addColorStop(0, '#c79a21'); gold.addColorStop(0.45, '#fff29a'); gold.addColorStop(1, '#e8b729');
        c.strokeStyle = gold; c.lineWidth = 4.5;
        c.beginPath(); c.moveTo(3, 0); c.lineTo(3, -49); c.lineTo(-6, -66);
        c.moveTo(-19, -102); c.lineTo(7, -30);
        c.moveTo(-19, -102); c.lineTo(-19, -179);
        c.moveTo(7, -30); c.lineTo(7, -107); c.stroke();
        c.fillStyle = team.primary; c.strokeStyle = '#c8dcdf'; c.lineWidth = 1;
        c.beginPath(); c.roundRect(-3, -28, 12, 34, 3); c.fill(); c.stroke();
        c.restore();
    }
    window.footballField = {endzone, pylon, goalpost, preload, palettes};
})();
