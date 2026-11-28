// Shared chase simulation used by play, generation, and route verification.
(() => {
    const endzoneCols = 2;
    const fieldCols = 20;
    const cols = fieldCols + endzoneCols * 2;
    const rows = 11;
    const goalColumn = cols - endzoneCols;
    const startColumn = endzoneCols - 1;
    const centerRow = Math.floor(rows / 2);
    // Five yards per column; the field is 53 1/3 yards across.
    const layout = {width: 1324, height: 639, left: 38, top: 42, cellWidth: 52, cellHeight: 52 * (160 / 3) / (5 * rows)};
    const moves = [[1, 0], [0, -1], [0, 1], [-1, 0], [0, 0]];
    const same = (a, b) => a.x === b.x && a.y === b.y;
    const protectedAt = (field, p) => field.allies.some(a => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) <= 1);
    const walkable = (field, p) => p.x >= 0 && p.x < cols && p.y >= 0 && p.y < rows && !field.walls.some(w => same(w, p));
    const initial = field => ({x: startColumn, y: centerRow, turn: 0, carrying: false, defenders: field.rushers.map(r => ({...r}))});
    // One distance map per chase wave. Defenders navigate around rival blockers;
    // friendly protection stops their advance instead of acting as a tackle shield.
    const distanceCaches = new WeakMap();
    function distanceMap(field, target) {
        if (!distanceCaches.has(field)) distanceCaches.set(field, new Map());
        const cache = distanceCaches.get(field);
        const targetKey = target.y * cols + target.x;
        if (cache.has(targetKey)) return cache.get(targetKey);
        const distances = new Int16Array(cols * rows).fill(-1);
        const queue = [target];
        distances[target.y * cols + target.x] = 0;
        for (let i = 0; i < queue.length; i++) {
            const p = queue[i];
            for (const [dx, dy] of moves.slice(0, 4)) {
                const n = {x: p.x + dx, y: p.y + dy};
                const index = n.y * cols + n.x;
                if (!walkable(field, n) || distances[index] !== -1) continue;
                distances[index] = distances[p.y * cols + p.x] + 1;
                queue.push(n);
            }
        }
        cache.set(targetKey, distances);
        return distances;
    }
    function chase(field, state, target, turn) {
        const defenders = (state.defenders || field.rushers).map(r => ({...r}));
        const distances = distanceMap(field, target);
        const waves = turn % field.burstEvery === 0 ? 2 : 1;
        for (let wave = 0; wave < waves; wave++) {
            for (let i = 0; i < defenders.length; i++) {
                const r = defenders[i];
                let best = r;
                let distance = distances[r.y * cols + r.x];
                for (const [dx, dy] of moves.slice(0, 4)) {
                    const n = {x: r.x + dx, y: r.y + dy};
                    if (!walkable(field, n) || protectedAt(field, n) || defenders.some((other, j) => j !== i && same(other, n))) continue;
                    const nextDistance = distances[n.y * cols + n.x];
                    if (nextDistance >= 0 && (distance < 0 || nextDistance < distance)) { best = n; distance = nextDistance; }
                }
                defenders[i] = best;
                if (same(best, target) && !protectedAt(field, target)) return {defenders, captor: i};
            }
        }
        return {defenders, captor: -1};
    }
    function step(field, state, dx, dy) {
        const p = {x: state.x + dx, y: state.y + dy};
        if (!walkable(field, p)) return null;
        const defenders = state.defenders || field.rushers;
        const occupied = defenders.findIndex(r => same(r, p));
        const next = {...p, turn: state.turn + 1, carrying: state.carrying || same(p, field.ball)};
        if (occupied !== -1) return {...next, defenders, caught: true, captor: occupied, tackleReason: 'contact'};
        // Crossing the goal line ends the play before the defense gets another turn.
        if (p.x >= goalColumn && next.carrying) return {...next, defenders};
        const result = chase(field, state, p, next.turn);
        return {...next, defenders: result.defenders, caught: result.captor !== -1, captor: result.captor, tackleReason: result.captor !== -1 ? 'chase' : null};
    }
    // Preview the exact next turn, including bursts, protection, and the clock.
    // These are immediate outcomes, not promises that the whole route is safe.
    function preview(field, state) {
        return moves.map(([dx, dy]) => {
            const next = step(field, state, dx, dy);
            const outcome = !next ? 'blocked' : next.caught ? 'tackle' : next.x >= goalColumn && next.carrying ? 'touchdown' : next.turn >= field.budget ? 'expired' : protectedAt(field, next) ? 'protected' : 'safe';
            return {dx, dy, x: state.x + dx, y: state.y + dy, outcome};
        });
    }
    const remaining = (field, s) => s.carrying ? Math.max(0, goalColumn - s.x) : Math.abs(s.x - field.ball.x) + Math.abs(s.y - field.ball.y) + goalColumn - field.ball.x;
    // A* searches the actual positions of every pursuer, possession, and burst
    // cadence. The admissible distance estimate preserves shortest-route par.
    function solve(field, start = initial(field), limit = 16000, maxTurns = 65) {
        const key = s => `${s.x},${s.y},${s.carrying ? 1 : 0},${s.turn % field.burstEvery}|${s.defenders.map(r => r.y * cols + r.x).join(',')}`;
        const root = {...start, defenders: start.defenders || field.rushers};
        const heap = [];
        const push = node => {
            heap.push(node);
            let i = heap.length - 1;
            while (i) {
                const parent = (i - 1) >> 1;
                if (heap[parent].f < node.f || heap[parent].f === node.f && heap[parent].h <= node.h) break;
                heap[i] = heap[parent]; i = parent;
            }
            heap[i] = node;
        };
        const pop = () => {
            const node = heap[0], last = heap.pop();
            if (heap.length) {
                let i = 0;
                while (i * 2 + 1 < heap.length) {
                    let j = i * 2 + 1;
                    if (j + 1 < heap.length && (heap[j + 1].f < heap[j].f || heap[j + 1].f === heap[j].f && heap[j + 1].h < heap[j].h)) j++;
                    if (last.f < heap[j].f || last.f === heap[j].f && last.h <= heap[j].h) break;
                    heap[i] = heap[j]; i = j;
                }
                heap[i] = last;
            }
            return node;
        };
        const costs = new Map([[key(root), root.turn]]);
        push({state: root, f: remaining(field, root), h: remaining(field, root), parent: null});
        for (let expanded = 0; heap.length && expanded < limit; expanded++) {
            const node = pop(), s = node.state;
            if (s.turn !== costs.get(key(s))) continue;
            if (s.x >= goalColumn && s.carrying) {
                const route = [];
                for (let n = node; n.parent; n = n.parent) route.push(n.move);
                return route.reverse();
            }
            for (const move of moves) {
                const next = step(field, s, ...move);
                if (!next || next.caught || next.turn > maxTurns) continue;
                const h = remaining(field, next);
                if (next.turn + h > maxTurns) continue;
                const id = key(next);
                if ((costs.get(id) ?? Infinity) <= next.turn) continue;
                costs.set(id, next.turn);
                push({state: next, f: next.turn + h, h, parent: node, move});
            }
        }
        return null;
    }
    function random(seed) {
        return () => {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function generate(level, seed) {
        const rng = random(seed);
        const integer = (min, max) => min + Math.floor(rng() * (max - min + 1));
        const pressure = Math.min(12, level);
        for (let attempt = 0; attempt < 16; attempt++) {
            const field = {level, seed, burstEvery: Math.max(4, 8 - Math.floor(pressure / 3)), walls: [], rushers: [], allies: [], ball: {x: integer(11, 16), y: integer(1, rows - 2)}};
            const occupied = p => same(p, field.ball) || field.walls.some(w => same(w, p)) || field.allies.some(a => same(a, p)) || field.rushers.some(r => same(r, p));
            for (const [left, right] of [[5, 9], [13, 18]]) {
                let p;
                do { p = {x: integer(left, right), y: integer(1, rows - 2)}; } while (occupied(p));
                field.allies.push(p);
            }
            // A trailing chaser forces forward progress; upfield defenders cut
            // off the pickup and goal. They all react to the runner's new position.
            field.rushers.push({x: 0, y: integer(0, 1)});
            for (let i = 0; i < 1 + Math.floor(pressure / 4); i++) {
                let p;
                do { p = {x: integer(11, goalColumn - 1), y: integer(0, rows - 1)}; } while (occupied(p) || protectedAt(field, p));
                field.rushers.push(p);
            }
            while (field.walls.length < 6 + pressure) {
                const p = {x: integer(endzoneCols + 1, goalColumn - 1), y: integer(0, rows - 1)};
                if (!occupied(p)) field.walls.push(p);
            }
            const solution = solve(field);
            if (solution) {
                field.solution = solution;
                field.par = solution.length;
                field.budget = field.par + Math.max(2, 6 - Math.floor(level / 2));
                return field;
            }
        }
        return fallbackField(level, seed);
    }
    function fallbackField(level, seed) {
        const pressure = Math.min(12, level);
        // A finite family of verified layouts provides a route without dropping the level's
        // defender count, burst cadence, blocker count, or step allowance.
        const field = {level, seed, burstEvery: Math.max(4, 8 - Math.floor(pressure / 3)), walls: [], rushers: [{x: 0, y: 0}, {x: 0, y: rows - 1}], allies: [{x: 7, y: centerRow}, {x: 16, y: centerRow}], ball: {x: 13, y: centerRow}};
        for (let i = 2; i < 2 + Math.floor(pressure / 4); i++) field.rushers.push({x: i - 1, y: i % 2 ? rows - 1 : 0});
        for (let i = 0; i < 6 + pressure; i++) field.walls.push({x: 4 + i, y: i % 2 ? 0 : rows - 1});
        field.solution = solve(field);
        field.par = field.solution.length;
        field.budget = field.par + Math.max(2, 6 - Math.floor(level / 2));
        return field;
    }
    function rating(field, steps, hints = 0) {
        const extra = steps - field.par;
        return {stars: hints ? 1 : extra <= 0 ? 3 : extra <= 2 ? 2 : 1, points: Math.max(0, 600 + (field.budget - steps) * 100 - hints * 250)};
    }
    // The return follows an open route to the left end zone, around the line.
    function returnRoute(field, from, target = null) {
        const queue = [{...from, route: []}], seen = new Set([`${from.x},${from.y}`]);
        for (let i = 0; i < queue.length; i++) {
            const p = queue[i];
            if (target ? same(p, target) : p.x < endzoneCols) return [{x: from.x, y: from.y}, ...p.route];
            for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
                const n = {x: p.x + dx, y: p.y + dy}, key = `${n.x},${n.y}`;
                if (!walkable(field, n) || seen.has(key)) continue;
                seen.add(key); queue.push({...n, route: [...p.route, n]});
            }
        }
        return [{x: from.x, y: from.y}];
    }
    globalThis.TouchdownRules = {cols, rows, endzoneCols, fieldCols, goalColumn, startColumn, centerRow, layout, moves, same, protectedAt, walkable, initial, chase, step, preview, solve, generate, fallbackField, rating, returnRoute};
})();
