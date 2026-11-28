// Portable drive state: no DOM or team dependencies. Field position is yards from our goal.
(() => {
    function initial() {
        return {spot: 25, down: 1, toGo: 10, points: 0, completions: 0, attempts: 0, drive: 1, ended: false, outcome: null};
    }
    function resolve(state, play) {
        if (state.ended) return state;
        const next = {...state, attempts: state.attempts + (play.thrown ? 1 : 0), completions: state.completions + (play.complete ? 1 : 0)};
        const spot = Math.max(0, Math.min(100, state.spot + Math.round(play.yards || 0)));
        next.spot = play.kind === 'incomplete' || play.kind === 'interception' ? state.spot : spot;
        if (play.kind === 'interception') next.outcome = 'interception';
        else if (spot === 0 && play.kind !== 'incomplete') next.outcome = 'safety';
        else if (next.spot >= 100) { next.outcome = 'touchdown'; next.points += 6; }
        else if (next.spot >= state.spot + state.toGo) { next.down = 1; next.toGo = Math.min(10, 100 - next.spot); }
        else { next.down++; next.toGo = Math.min(100 - next.spot, state.toGo - (next.spot - state.spot)); }
        if (!next.outcome && next.down > 4) next.outcome = 'downs';
        next.ended = !!next.outcome;
        return next;
    }
    function nextDrive(state) {
        return {...initial(), points: state.points, completions: state.completions, attempts: state.attempts, drive: state.drive + 1, recentTargets: Array.isArray(state.recentTargets) ? state.recentTargets.slice(-3) : []};
    }
    const concepts = {
        slants: {name: 'Slants', note: 'Quick diagonal breaks. Beat pressure with a fast release.', routes: [[[8, -2], [22, 10], [45, 18]], [[7, 1], [24, -10], [45, -18]], [[9, -2], [25, -14], [48, -18]]]},
        flood: {name: 'Flood', note: 'Three depths on one side. Make the safety choose.', routes: [[[14, 0], [32, 5], [52, 5]], [[9, -2], [20, -12], [45, -12]], [[4, -8], [13, -22], [37, -22]]]},
        cross: {name: 'Cross', note: 'Receivers cross underneath. Look for separation in traffic.', routes: [[[7, 0], [15, 16], [38, 30]], [[14, 0], [30, 0], [52, 0]], [[8, 0], [17, -16], [40, -30]]]}
    };
    // One seeded call per down: audibles cannot reroll the defense or restore energy.
    function random(seed) {
        return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    }
    const looks = [
        {name: 'Press man · wide rush', coverage: 'man', depth: 1.5, spread: 3, safetyDepth: 17, rush: [13, 39]},
        {name: 'Off man · narrow front', coverage: 'man', depth: 7, spread: -3, safetyDepth: 23, rush: [22, 31]},
        {name: 'Cover 2 · split safeties', coverage: 'two', depth: 4, spread: 2, safetyDepth: 18, rush: [17, 36]},
        {name: 'Cover 3 · deep middle', coverage: 'three', depth: 8, spread: -2, safetyDepth: 24, rush: [12, 41]},
        {name: 'Man blitz · overload', coverage: 'blitz', depth: 2.5, spread: 3.5, safetyDepth: 20, rush: [15, 25, 39]},
        {name: 'Robber · underneath help', coverage: 'robber', depth: 5, spread: -3, safetyDepth: 10, rush: [20, 34]}
    ];
    const routeVariants = {
        slants: [
            {name: 'Double slant', routes: concepts.slants.routes},
            {name: 'Slant / flat', routes: [[[5, 0], [18, 12], [40, 18]], [[3, -8], [14, -16], [38, -16]], [[10, 0], [24, -10], [48, -14]]]},
            {name: 'Slant / wheel', routes: [[[7, 0], [21, 13], [43, 18]], [[4, 8], [16, 15], [44, 15]], [[6, -10], [12, -15], [44, -15]]]}
        ],
        flood: [
            {name: 'Sail', routes: concepts.flood.routes},
            {name: 'Seam / out', routes: [[[18, 0], [38, 0], [57, 0]], [[12, 0], [16, -13], [36, -13]], [[3, -8], [10, -20], [29, -20]]]},
            {name: 'Switch flood', routes: [[[7, 8], [22, 10], [46, 10]], [[17, -2], [25, -15], [50, -15]], [[4, -7], [9, -21], [32, -21]]]}
        ],
        cross: [
            {name: 'Deep cross', routes: concepts.cross.routes},
            {name: 'Mesh / sit', routes: [[[4, 0], [9, 16], [25, 30]], [[11, 0], [13, -5], [18, -5]], [[5, 0], [11, -16], [28, -30]]]},
            {name: 'Drive / dig', routes: [[[5, 0], [11, 13], [32, 29]], [[16, 0], [22, 12], [42, 12]], [[9, 0], [19, -15], [41, -28]]]}
        ]
    };
    function callFor(concept, seed) {
        const rng = random(seed);
        const mirror = rng() < 0.5 ? -1 : 1;
        const variant = Math.floor(rng() * 3);
        const width = [0.82, 1, 1.13][variant];
        const depth = [0.78, 1, 1.24][Math.floor(rng() * 3)];
        const starts = [8 + rng() * 4, 24 + rng() * 5, 41 + rng() * 4];
        const family = routeVariants[concept][variant];
        const routes = family.routes.map((route, i) => route.map(([x, y], j) => [
            x * depth + (j === 0 ? variant - 1 : 0),
            Math.max(3 - starts[i], Math.min(50 - starts[i], y * width))
        ]));
        return {
            label: `${['Quick', 'Standard', 'Deep'][depth < 0.9 ? 0 : depth > 1.1 ? 2 : 1]} ${family.name} · ${mirror < 0 ? 'left' : 'right'}`,
            receivers: routes.map((route, i) => ({startY: mirror < 0 ? 53 - starts[i] : starts[i], route: route.map(([x, y]) => [x, y * mirror])})),
            look: looks[Math.floor(rng() * looks.length)]
        };
    }
    const movement = {quarterback: 5.4, carrier: 6.5, sprint: 1.26, pursuit: 7.15, rush: 6.25, drain: 0.56};
    function energy(stamina, sprintHeld, moving, dt) {
        const sprinting = sprintHeld && moving && stamina > 0;
        // A play's burst budget never regenerates, even if Shift is released.
        return {sprinting, stamina: Math.max(0, stamina - (sprinting ? movement.drain * dt : 0))};
    }
    globalThis.PassingRules = {initial, resolve, nextDrive, concepts, routeVariants, looks, callFor, movement, energy};
})();
