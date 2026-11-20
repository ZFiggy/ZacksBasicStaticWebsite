class JalenSearch {
    constructor() {
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
            this.canvas.style.width = `${Math.max(760, this.viewport.clientWidth) * scale}px`;
        };
        document.getElementById('search-zoom').addEventListener('change', this.applyZoom);
        window.addEventListener('resize', this.applyZoom);
        this.applyZoom();
        document.getElementById('search-hint').addEventListener('click', () => {
            if (this.loading || this.found) return;
            if (!this.clueShown) {
                this.clueShown = true;
                this.status.textContent = `Clothing clue: ${this.scenes[this.level].clue} Need more help? Show the area hint.`;
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

    restoreProgress() {
        this.level = 0;
        this.misses = 0;
        let found = false;
        try {
            const saved = JSON.parse(localStorage.getItem('jalenProgress'));
            if (saved?.version === 3 && Number.isInteger(saved.level) && saved.level >= 0 && saved.level < 5 && Number.isSafeInteger(saved.misses) && saved.misses >= 0 && typeof saved.found === 'boolean') {
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
            localStorage.setItem('jalenProgress', JSON.stringify({version: 3, level: this.level, found: this.found, misses: this.misses}));
            if (this.found) {
                const previous = Number(localStorage.getItem('jalenCleared'));
                const cleared = Number.isInteger(previous) && previous >= 0 && previous <= 5 ? previous : 0;
                localStorage.setItem('jalenCleared', Math.max(cleared, this.level + 1).toString());
            }
        } catch {
            // All photos can still be played without saving progress.
        }
        this.renderProgress();
        document.dispatchEvent(new Event('arcade:progress'));
    }

    renderProgress() {
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
        this.found = restoreFound;
        this.hint = false;
        this.clueShown = false;
        this.cursor = null;
        this.lastGuess = null;
        this.loading = true;
        this.next.disabled = true;
        document.getElementById('search-hint').disabled = true;
        document.getElementById('search-hint').textContent = 'Clothing clue';
        document.getElementById('search-retry').hidden = true;
        this.next.textContent = level === 4 ? 'Play all five again' : 'Next photo';
        document.getElementById('search-level').textContent = `Photo ${level + 1} / 5`;
        document.getElementById('search-scene').textContent = `${this.scenes[level].name} · ${this.scenes[level].difficulty}`;
        this.status.textContent = 'Loading the crowd photo…';
        this.image = null;
        this.saveProgress();
        this.draw();
        const image = this.images.get(level) || new Image();
        const loaded = () => {
            if (this.level !== level) return;
            this.image = image;
            this.canvas.width = image.naturalWidth;
            this.canvas.height = image.naturalHeight;
            this.loading = false;
            this.next.disabled = !this.found;
            document.getElementById('search-hint').disabled = false;
            this.status.textContent = this.found ? (level === 4 ? 'All five photos found. Fly Eagles Fly! Play again anytime.' : 'Welcome back. You found Jalen here — continue to the next photo.') : 'Hard mode: find Jalen’s face in the crowd. His outfit changes between photos. Progress saves automatically.';
            this.viewport.scrollTo(0, 0);
            this.draw();
        };
        if (image.complete && image.naturalWidth) loaded();
        else {
            image.onload = loaded;
            image.onerror = () => {
                if (this.level !== level) return;
                this.images.delete(level);
                this.status.textContent = 'This photo could not load. Check your connection and retry.';
                document.getElementById('search-retry').hidden = false;
            };
            image.src = `assets/search-level-${level + 1}-v2.jpg`;
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
            this.status.textContent = this.level === 4 ? `You found Jalen in all five photos! ${this.misses} wrong guesses. Fly Eagles Fly!` : 'That’s Jalen! Ready for the next photo?';
        } else {
            this.misses++;
            this.status.textContent = 'Not quite. Look for Jalen’s face, short beard, and natural expression. His clothing changes — try zooming in.';
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
        ctx.drawImage(this.image, 0, 0, w, h);
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
