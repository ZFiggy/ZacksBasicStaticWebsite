class JalenSearch {
    constructor() {
        this.team = window.teamArcade.team;
        this.photoSet = this.team.id === 'eagles' ? null : window.NFL_PHOTO_SCENES?.[this.team.id];
        this.playerName = this.photoSet?.playerName || 'Jalen Hurts';
        this.progressKey = this.photoSet ? 'photoSearchProgress' : 'jalenProgress';
        this.progressVersion = this.photoSet?.version || (this.photoSet ? 1 : 3);
        this.mode = 'photo';
        this.canvas = document.getElementById('searchCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.status = document.getElementById('search-status');
        this.next = document.getElementById('search-next');
        this.viewport = document.getElementById('search-viewport');
        // Rectangles use normalized photo coordinates and are checked against the final edited images.
        this.scenes = [
            { name: 'Behind the tailgate', difficulty: 'Hard', target: [0.397, 0.248, 0.059, 0.131], clue: 'A red cap and a black hoodie.' },
            { name: 'One row farther back', difficulty: 'Harder', target: [0.266, 0.38, 0.046, 0.105], clue: 'A relaxed smile and green jersey. No hat.' },
            { name: 'Winter camouflage', difficulty: 'Very hard', target: [0.604, 0.157, 0.070, 0.119], clue: 'A black knit cap and a partly hidden cream hoodie.' },
            { name: 'Among the raised arms', difficulty: 'Expert', target: [0.699, 0.258, 0.047, 0.100], clue: 'A short haircut and a small smile behind the raised arms.' },
            { name: 'Deep in the crowd', difficulty: 'Final challenge', target: [0.787, 0.297, 0.050, 0.085], clue: 'A dark green cap and black hoodie, far behind the foreground fans.' }
        ];
        if (this.photoSet) {
            this.scenes = this.photoSet.scenes.map((scene, i) => ({...scene, difficulty: scene.difficulty || ['Warmup','Tricky','Hard','Expert','Final challenge'][i]}));
            this.setupPhotoStory();
        }
        this.images = new Map();
        this.next.addEventListener('click', () => {
            if (!this.found) return;
            if (this.level === 4) this.reset();
            else { this.level++; this.loadLevel(); }
        });
        document.getElementById('search-reset').addEventListener('click', () => this.reset());
        document.getElementById('search-retry').addEventListener('click', () => this.loadLevel(this.found));
        this.applyZoom = () => {
            const scale = Number(document.getElementById('search-zoom').value);
            const width = Math.max(1, Math.min(this.viewport.clientWidth, this.viewport.clientHeight * this.canvas.width / this.canvas.height));
            this.canvas.style.width = `${width * scale}px`;
            this.canvas.style.height = `${width * scale * this.canvas.height / this.canvas.width}px`;
        };
        document.getElementById('search-zoom').addEventListener('change', this.applyZoom);
        window.addEventListener('resize', this.applyZoom);
        this.applyZoom();
        document.getElementById('search-hint').addEventListener('click', () => {
            if (this.loading || this.found) return;
            if (!this.clueShown && !this.photoSet?.authentic) {
                this.clueShown = true;
                this.status.textContent = `${this.photoSet?.photographicComposite ? 'Face' : 'Clothing'} clue: ${this.scenes[this.level].clue} Need more help? Show the area hint.`;
                document.getElementById('search-hint').textContent = 'Show area hint';
                return;
            }
            this.hint = true;
            const [x, y, w, h] = this.scenes[this.level].target;
            this.status.textContent = `Try the ${x + w / 2 < 0.5 ? 'left' : 'right'} half, ${y + h / 2 < 0.5 ? 'toward the top' : 'toward the bottom'}. ${this.scenes[this.level].clue}`;
            this.draw();
        });
        this.canvas.addEventListener('click', (event) => {
            if (event.button !== 0 || this.loading) return;
            const box = this.canvas.getBoundingClientRect();
            this.choosePoint((event.clientX - box.left) * this.canvas.width / box.width, (event.clientY - box.top) * this.canvas.height / box.height);
        });
        this.canvas.addEventListener('keydown', (event) => {
            const moves = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
            if (this.loading) return;
            if (moves[event.key]) {
                event.preventDefault();
                this.cursor ??= { x: this.canvas.width / 2, y: this.canvas.height / 2 };
                const step = event.shiftKey ? 8 : 32;
                this.cursor.x = Math.max(0, Math.min(this.canvas.width, this.cursor.x + moves[event.key][0] * step));
                this.cursor.y = Math.max(0, Math.min(this.canvas.height, this.cursor.y + moves[event.key][1] * step));
                const scale = this.canvas.getBoundingClientRect().width / this.canvas.width;
                this.viewport.scrollTo(this.cursor.x * scale - this.viewport.clientWidth / 2, this.cursor.y * scale - this.viewport.clientHeight / 2);
                this.draw();
            } else if (event.key === 'Enter' || event.code === 'Space') {
                event.preventDefault();
                if (this.cursor) this.choosePoint(this.cursor.x, this.cursor.y);
            }
        });
        this.restoreProgress();
    }

    setupPhotoStory() {
        if (this.photoSet.authentic) {
            document.querySelector('.search-heading h1').textContent = `${this.team.nickname.toUpperCase()} PHOTO HUNT`;
            document.querySelector('.search-heading .eyebrow').textContent = 'REAL PHOTOS · FIVE SCENES';
            document.querySelector('.search-heading > div > p:last-child').textContent = 'Five hard rounds in real team football and fan photographs. Find the small face, helmet, or jersey detail described in each clue. Zoom in to inspect the background.';
            const reference = document.querySelector('.jalen-reference');
            reference.replaceChildren();
            const badge = document.createElement('b'); badge.className = 'photo-hunt-badge'; badge.textContent = 'FIND';
            this.targetClue = document.createElement('span');
            reference.append(badge, this.targetClue);
            const disclosure = document.querySelector('.photo-disclosure');
            disclosure.textContent = 'Real team photography. No generated or inserted people. ';
            this.photoSource = document.createElement('a');
            this.photoSource.target = '_blank'; this.photoSource.rel = 'noopener noreferrer';
            disclosure.append(this.photoSource);
            document.getElementById('search-help').textContent = 'Read the clue and tap the named detail, not the whole person. Zoom and scroll to inspect. Keyboard: arrows move the crosshair, Shift makes fine adjustments, Enter checks your choice.';
            return;
        }
        document.querySelector('.search-heading h1').textContent = this.team.games.search.toUpperCase();
        document.querySelector('.search-heading .eyebrow').textContent = `${this.playerName} · ${this.photoSet.era}`;
        document.querySelector('.search-heading > div > p:last-child').textContent = `Find ${this.playerName} in five crowded ${this.team.nickname} fan photos. The same face every round, hidden among the spectators. Compare the portrait, zoom in, and look beyond the front row.`;
        const reference = document.querySelector('.jalen-reference');
        reference.replaceChildren();
        this.referenceCanvas = document.createElement('canvas');
        this.referenceCanvas.width = 300; this.referenceCanvas.height = 220;
        this.referenceCanvas.setAttribute('role', 'img');
        this.referenceCanvas.setAttribute('aria-label', `Photographic identity reference for ${this.playerName}`);
        const label = document.createElement('span'); label.textContent = this.playerName;
        reference.append(this.referenceCanvas, label);
        const disclosure = document.querySelector('.photo-disclosure');
        const generatedCrowd = this.photoSet.scenes.some(scene => scene.kind === 'generated');
        disclosure.textContent = this.photoSet.aiIntegrated
            ? 'Real crowd photos · AI-edited player. '
            : this.photoSet.photographicComposite
            ? `Real crowd photograph with a real ${this.playerName} photo cutout inserted for this fictional game. `
            : generatedCrowd
            ? 'AI-created fictional scenes and player likenesses for this fan game. '
            : `Fan photography, AI-edited for a fictional ${this.playerName} search. ${this.photoSet.credit || ''} `;
        if (this.photoSet.referenceSrc) {
            const portrait = new Image();
            portrait.onload = () => {
                const ctx = this.referenceCanvas.getContext('2d');
                const {width: frameWidth, height: frameHeight} = this.referenceCanvas;
                ctx.clearRect(0, 0, frameWidth, frameHeight);
                const scale = Math.min(frameWidth / portrait.naturalWidth, frameHeight / portrait.naturalHeight);
                const width = portrait.naturalWidth * scale;
                const height = portrait.naturalHeight * scale;
                ctx.drawImage(portrait, (frameWidth - width) / 2, (frameHeight - height) / 2, width, height);
            };
            portrait.onerror = () => { label.textContent = `${this.playerName.toUpperCase()} · PORTRAIT UNAVAILABLE`; };
            portrait.src = this.photoSet.referenceSrc;
        }
        const source = document.createElement('a'); source.href = this.photoSet.sourcePage; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = generatedCrowd ? 'Player information' : 'Original fan photo'; disclosure.append(source);
        if (this.photoSet.photographicComposite) {
            this.photoSource = source;
            disclosure.append(' · ');
            const portraitSource = document.createElement('a');
            portraitSource.href = this.photoSet.referencePage;
            portraitSource.target = '_blank';
            portraitSource.rel = 'noopener noreferrer';
            portraitSource.textContent = 'Player photo: ESPN';
            disclosure.append(portraitSource);
        }
        this.canvas.setAttribute('aria-label', `Fictional ${this.team.name} crowd scene. Find ${this.playerName}.`);
        document.getElementById('search-help').textContent = `Tap or click ${this.playerName}. Zoom and scroll to inspect. Keyboard: arrows move the crosshair, Shift makes fine adjustments, Enter checks your choice.`;
    }

    paintReference(image) {
        let sw = image.naturalWidth / this.photoSet.cols;
        let sh = image.naturalHeight / this.photoSet.rows;
        const tile = this.photoSet.referenceIndex;
        let sx = tile % this.photoSet.cols * sw;
        let sy = Math.floor(tile / this.photoSet.cols) * sh;
        if (this.photoSet.referenceRegion) {
            const [x, y, width, height] = this.photoSet.referenceRegion;
            sx = x * image.naturalWidth; sy = y * image.naturalHeight;
            sw = width * image.naturalWidth; sh = height * image.naturalHeight;
        }
        const scale = Math.min(160 / sw, 160 / sh);
        const ctx = this.referenceCanvas.getContext('2d');
        ctx.clearRect(0, 0, 160, 160);
        ctx.drawImage(image, sx, sy, sw, sh, (160 - sw * scale) / 2, (160 - sh * scale) / 2, sw * scale, sh * scale);
    }

    restoreProgress() {
        this.level = 0;
        this.misses = 0;
        let found = false;
        try {
            const saved = JSON.parse(window.teamArcade.storage.getItem(this.progressKey));
            if (saved?.version === this.progressVersion && Number.isInteger(saved.level) && saved.level >= 0 && saved.level < 5 && Number.isSafeInteger(saved.misses) && saved.misses >= 0 && typeof saved.found === 'boolean') {
                this.level = saved.level;
                this.misses = saved.misses;
                found = saved.found;
            }
        } catch {
            // Missing or invalid progress starts a fresh search.
        }
        this.loadLevel(found);
    }

    saveProgress() {
        try {
            window.teamArcade.storage.setItem(this.progressKey, JSON.stringify({version: this.progressVersion, level: this.level, found: this.found, misses: this.misses}));
            if (this.found) {
                const previous = Number(window.teamArcade.storage.getItem('jalenCleared'));
                const cleared = Number.isInteger(previous) && previous >= 0 && previous <= 5 ? previous : 0;
                window.teamArcade.storage.setItem('jalenCleared', Math.max(cleared, this.level + 1).toString());
            }
        } catch {
            // All photos can still be played without saving progress.
        }
        this.renderProgress();
        document.dispatchEvent(new Event('arcade:progress'));
    }

    renderProgress() {
        document.getElementById('search-points').textContent = `${(this.level + (this.found ? 1 : 0)) * 20} / 100 search points`;
        const steps = document.getElementById('photo-progress');
        steps.replaceChildren();
        for (let i = 0; i < 5; i++) {
            const item = document.createElement('li');
            const completed = i < this.level || (i === this.level && this.found);
            item.className = completed ? 'is-complete' : i === this.level ? 'is-current' : '';
            item.textContent = `${i + 1}`;
            item.setAttribute('aria-label', `Photo ${i + 1}: ${completed ? 'found' : i === this.level ? 'current' : 'up next'}`);
            if (i === this.level) item.setAttribute('aria-current', 'step');
            steps.append(item);
        }
    }

    reset() {
        this.level = 0;
        this.misses = 0;
        this.loadLevel();
    }

    loadLevel(restoreFound = false) {
        const level = this.level;
        const request = this.loadRequest = (this.loadRequest || 0) + 1;
        this.found = restoreFound;
        this.hint = false;
        this.clueShown = false;
        this.cursor = null;
        this.lastGuess = null;
        this.loading = true;
        this.next.disabled = true;
        document.getElementById('search-hint').disabled = true;
        document.getElementById('search-hint').textContent = this.photoSet?.authentic ? 'Show area hint' : this.photoSet?.photographicComposite ? 'Face clue' : 'Clothing clue';
        document.getElementById('search-retry').hidden = true;
        this.next.textContent = level === 4 ? 'Play again' : 'Next photo';
        document.getElementById('search-level').textContent = `Photo ${level + 1} / 5`;
        document.getElementById('search-scene').textContent = `${this.scenes[level].name} · ${this.scenes[level].difficulty}`;
        this.status.textContent = 'Loading photo…';
        if (this.photoSet?.photographicComposite) document.getElementById('search-zoom').value = '1';
        if (this.photoSet?.photographicComposite) {
            this.photoSource.href = this.scenes[level].sourcePage;
            this.photoSource.textContent = `Crowd photo: ${this.scenes[level].credit}`;
        }
        if (this.targetClue) this.targetClue.textContent = this.scenes[level].clue;
        this.image = null;
        this.saveProgress();
        this.draw();
        const image = this.images.get(level) || new Image();
        const loaded = () => {
            if (this.loadRequest !== request) return;
            this.image = image;
            const isAtlas = this.photoSet && !this.scenes[level].src;
            this.canvas.width = isAtlas ? Math.round(image.naturalWidth / this.photoSet.cols) : image.naturalWidth;
            this.canvas.height = isAtlas ? Math.round(image.naturalHeight / this.photoSet.rows) : image.naturalHeight;
            if (this.scenes[level].region) {
                this.canvas.width = Math.round(image.naturalWidth * this.scenes[level].region[2]);
                this.canvas.height = Math.round(image.naturalHeight * this.scenes[level].region[3]);
            }
            this.viewport.style.aspectRatio = `${this.canvas.width} / ${this.canvas.height}`;
            if (this.photoSet && !this.photoSet.referenceSrc && !this.photoSet.authentic) this.paintReference(image);
            this.loading = false;
            this.next.disabled = !this.found;
            document.getElementById('search-hint').disabled = false;
            this.status.textContent = this.found ? (level === 4 ? `All five crowd scenes solved. ${this.team.motto}` : `Welcome back. You found ${this.playerName} here — continue to the next photo.`) : `Find ${this.playerName}. Zoom to look closer.`;
            if (this.photoSet?.authentic) {
                this.status.textContent = this.found ? 'Target found. Continue to the next photo.' : `${this.scenes[level].clue} Zoom in to inspect the whole photo.`;
                this.photoSource.href = this.scenes[level].sourcePage;
                this.photoSource.textContent = 'Photo: ' + this.scenes[level].credit;
                this.canvas.setAttribute('aria-label', `${this.team.name} photo hunt. ${this.scenes[level].clue}`);
            }
            this.viewport.scrollTo(0, 0);
            this.applyZoom();
            this.draw();
        };
        if (image.complete && image.naturalWidth) loaded();
        else {
            image.onload = loaded;
            image.onerror = () => {
                if (this.loadRequest !== request) return;
                this.images.delete(level);
                this.status.textContent = 'This photo could not load. Check your connection and retry.';
                document.getElementById('search-retry').hidden = false;
            };
            image.src = this.scenes[level].src || this.photoSet?.src || `assets/search-level-${level + 1}-v2.jpg`;
            this.images.set(level, image);
        }
    }

    choosePoint(x, y) {
        if (this.loading || this.found) return;
        const [left, top, width, height] = this.scenes[this.level].target;
        const hit = x >= left * this.canvas.width && x <= (left + width) * this.canvas.width && y >= top * this.canvas.height && y <= (top + height) * this.canvas.height;
        this.lastGuess = { x, y };
        if (hit) {
            this.found = true;
            this.next.disabled = false;
            this.status.textContent = this.level === 4 ? `You found ${this.playerName} in all five crowd scenes! ${this.misses} wrong guesses. ${this.team.motto}` : `That’s ${this.playerName}! Ready for the next photo?`;
        } else {
            this.misses++;
            this.status.textContent = `Not quite. Compare ${this.playerName} with the face reference. His clothes can change; try zooming in.`;
        }
        if (this.photoSet?.authentic) {
            this.status.textContent = hit
                ? (this.level === 4 ? `All five targets found! ${this.misses} wrong guesses. ${this.team.motto}` : 'Found it! The next photo is ready.')
                : `Try again. ${this.scenes[this.level].clue}`;
        }
        this.saveProgress();
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.fillStyle = '#0b303a';
        ctx.fillRect(0, 0, w, h);
        if (!this.image) {
            ctx.fillStyle = '#d3e6e2';
            ctx.textAlign = 'center';
            ctx.font = '28px Arial';
            ctx.fillText('Loading photo…', w / 2, h / 2);
            return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (this.scenes[this.level].region) {
            const [x, y, width, height] = this.scenes[this.level].region;
            ctx.drawImage(this.image, x * this.image.naturalWidth, y * this.image.naturalHeight, width * this.image.naturalWidth, height * this.image.naturalHeight, 0, 0, w, h);
        } else if (this.photoSet && !this.scenes[this.level].src) {
            const tile = this.scenes[this.level].index;
            const sw = this.image.naturalWidth / this.photoSet.cols;
            const sh = this.image.naturalHeight / this.photoSet.rows;
            ctx.drawImage(this.image, tile % this.photoSet.cols * sw, Math.floor(tile / this.photoSet.cols) * sh, sw, sh, 0, 0, w, h);
        } else {
            ctx.drawImage(this.image, 0, 0, w, h);
        }
        const [x, y, tw, th] = this.scenes[this.level].target;
        if (this.hint && !this.found) {
            ctx.strokeStyle = '#ffdf83';
            ctx.lineWidth = 5;
            ctx.strokeRect(x + tw / 2 < 0.5 ? 5 : w / 2, y + th / 2 < 0.5 ? 5 : h / 2, w / 2 - 10, h / 2 - 10);
        }
        if (this.found) {
            ctx.strokeStyle = '#ffe699';
            ctx.lineWidth = 6;
            ctx.strokeRect(x * w, y * h, tw * w, th * h);
        } else if (this.lastGuess) {
            ctx.strokeStyle = '#ffba9d'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(this.lastGuess.x, this.lastGuess.y, 15, 0, Math.PI * 2); ctx.stroke();
        }
        if (this.cursor && !this.found) {
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(this.cursor.x, this.cursor.y, 18, 0, Math.PI * 2); ctx.moveTo(this.cursor.x - 26, this.cursor.y); ctx.lineTo(this.cursor.x + 26, this.cursor.y); ctx.moveTo(this.cursor.x, this.cursor.y - 26); ctx.lineTo(this.cursor.x, this.cursor.y + 26); ctx.stroke();
        }
    }
}

document.jalenGame = new JalenSearch();
