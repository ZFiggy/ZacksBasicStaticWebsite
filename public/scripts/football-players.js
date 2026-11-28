// Jointed canvas athletes: every limb remains attached through interpolated poses.
// Used only by Passing Drive and Field Goals; the original Eagles games retain their art.
(() => {
    const legacyIdentity = window.playerMotion.identity;
    const headImages = new Map();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = n => Math.max(0, Math.min(1, n));
    const mix = (a, b, t) => a.map((point, i) => point.map((v, j) => v + (b[i][j] - v) * t));
    const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
    // head, shoulders, hips, elbows/hands, knees/boots (left then right).
    const idle = [[0,-91],[0,-73],[0,-43],[-20,-57],[-15,-43],[20,-57],[16,-43],[0,-22],[-15,0],[20,-22],[17,0]];
    const poses = {
        idle,
        // Index 6 is always the throwing hand; index 8 is its opposite, lead foot.
        throw: [
            idle,
            [[-5,-92],[-6,-73],[-2,-43],[-22,-64],[-2,-64],[5,-88],[-15,-104],[20,-23],[12,0],[-12,-23],[-22,-3]],
            [[16,-91],[13,-72],[8,-40],[-3,-62],[17,-58],[30,-83],[54,-95],[27,-24],[26,0],[-1,-23],[-17,-4]],
            [[20,-86],[17,-68],[10,-39],[2,-58],[21,-49],[36,-62],[43,-49],[25,-22],[26,0],[2,-22],[-11,-4]],
            [[16,-89],[13,-71],[10,-42],[-6,-57],[11,-48],[18,-57],[2,-44],[24,-22],[26,0],[8,-23],[4,-4]]
        ],
        catch: [idle, [[2,-93],[0,-74],[0,-41],[-22,-92],[-9,-109],[23,-92],[10,-109],[-14,-22],[-18,0],[14,-23],[20,0]], [[2,-91],[0,-73],[0,-40],[-20,-67],[0,-73],[23,-67],[5,-73],[-13,-22],[-18,0],[14,-22],[20,0]], idle],
        intercept: [idle, [[3,-104],[0,-85],[0,-52],[-23,-104],[-8,-121],[25,-102],[10,-121],[-22,-36],[-25,-13],[22,-36],[29,-14]], [[3,-91],[0,-73],[0,-40],[-19,-63],[0,-68],[23,-63],[5,-68],[-13,-22],[-18,0],[14,-22],[20,0]], idle],
        block: [idle, [[13,-81],[9,-63],[-3,-38],[-4,-46],[25,-52],[35,-37],[55,-47],[-10,-22],[-22,0],[15,-22],[19,0]]],
        protect: [[[9,-77],[5,-59],[-6,-34],[-14,-39],[18,-44],[30,-33],[48,-43],[-15,-19],[-25,0],[18,-19],[25,0]]],
        // Lower the shoulders so the hands reach the ball with bent elbows.
        // The head sits over the collar instead of projecting past the chest.
        snap: [[[9,-60],[7,-44],[-7,-26],[-13,-30],[-3,-10],[22,-16],[4,-10],[-23,-18],[-28,0],[17,-17],[27,0]], [[9,-60],[7,-44],[-7,-26],[-23,-31],[-37,-22],[7,-30],[-31,-22],[-23,-18],[-28,0],[17,-17],[27,0]]],
        holder: [[[3,-67],[0,-49],[-9,-25],[-25,-34],[-14,-17],[13,-22],[32,-18],[-19,-1],[-42,0],[15,-23],[25,0]]],
        // The near leg (10) cocks behind the hip, strikes, and follows through.
        // The far leg (8) plants before the swing and stays on the turf through contact.
        kick: [
            [[-2,-91],[-2,-73],[0,-43],[-22,-58],[-25,-49],[20,-58],[24,-49],[-5,-23],[-11,0],[15,-22],[18,0]],
            [[-8,-91],[-7,-73],[-1,-43],[-27,-68],[-38,-80],[18,-65],[33,-74],[-5,-23],[-11,0],[-13,-30],[-33,-27]],
            [[-5,-91],[-3,-73],[0,-43],[-25,-72],[-36,-87],[23,-64],[39,-66],[-5,-23],[-11,0],[23,-29],[39,-7]],
            [[-11,-89],[-8,-71],[1,-43],[-27,-69],[-39,-82],[20,-63],[34,-75],[-5,-23],[-11,0],[26,-51],[41,-67]],
            [[3,-90],[2,-72],[1,-43],[-22,-56],[-15,-43],[23,-57],[29,-46],[-5,-23],[-11,0],[20,-26],[29,-8]],
            [[4,-91],[2,-73],[0,-43],[-20,-57],[-15,-43],[20,-57],[16,-43],[-5,-23],[-11,0],[19,-23],[22,0]]
        ],
        slide: [
            idle,
            [[-7,-68],[-3,-50],[5,-25],[-16,-34],[-4,-27],[14,-38],[12,-27],[22,-18],[36,-2],[18,-14],[35,0]],
            [[-26,-43],[-18,-27],[4,-14],[-12,-17],[0,-20],[1,-29],[16,-27],[25,-14],[45,-3],[20,-7],[42,0]]
        ],
        tackle: [
            idle,
            [[18,-73],[8,-56],[-6,-35],[24,-49],[36,-41],[29,-41],[43,-31],[-19,-23],[-28,0],[10,-20],[23,0]],
            [[29,-57],[17,-44],[-2,-29],[34,-38],[40,-25],[34,-29],[39,-17],[-17,-19],[-32,0],[17,-16],[29,0]],
            [[43,-29],[25,-25],[-1,-18],[39,-20],[46,-11],[35,-10],[43,-6],[-20,-12],[-34,-3],[12,-9],[26,0]]
        ],
        tackled: [
            idle,
            [[8,-77],[2,-60],[-6,-37],[-15,-52],[5,-51],[22,-52],[29,-43],[-19,-23],[-26,0],[9,-21],[22,0]],
            [[23,-48],[10,-37],[-8,-24],[-7,-25],[8,-22],[28,-28],[37,-19],[-23,-15],[-35,0],[3,-12],[22,0]],
            [[36,-18],[18,-15],[-13,-12],[5,-5],[23,-3],[30,-5],[46,-3],[-33,-8],[-48,-3],[-14,-3],[-30,0]]
        ],
        jump: [idle, [[0,-112],[0,-94],[0,-61],[-26,-109],[-15,-131],[25,-110],[15,-131],[-20,-41],[-23,-20],[23,-41],[29,-20]], idle]
    };
    function identity(role, teamId = teamArcade.team.id, variant = 0) {
        const cast = window.currentRosters?.teams[teamId]?.cast;
        if (!cast) return legacyIdentity(role, teamId, variant);
        const resolved = role === 'defender' ? 'rusher' : role === 'receiver2' ? 'receiver' : role;
        const players = cast[resolved];
        // No modulo: an invalid formation must never silently clone a player.
        if (!players?.[variant]) throw new Error(`Missing ${teamId} ${resolved} slot ${variant}`);
        return players[variant];
    }
    function pose(action, time = 0, progress = 0.5, variant = 0, stride) {
        // A stance foot travels backward at a constant speed relative to the body.
        // The caller advances stride by distance, so a slowing player cannot moonwalk.
        if (action === 'run' || action === 'rush') {
            const cycle = reduced.matches ? 0 : ((stride ?? time * 1.65) + variant * 0.17) % 1;
            const p = idle.map(point => [...point]);
            const bob = Math.cos(cycle * Math.PI * 4) * 1.6;
            p[0] = [7, -89 + bob]; p[1] = [4, -71 + bob]; p[2] = [-2, -39 + bob];
            for (let side = 0; side < 2; side++) {
                const f = (cycle + side * 0.5) % 1;
                const stance = f < 0.6, t = stance ? f / 0.6 : (f - 0.6) / 0.4;
                const foot = stance ? [18 - 36 * t, 0] : [-18 + 36 * smooth(t), -23 * Math.sin(Math.PI * t)];
                p[8 + side * 2] = foot;
                p[7 + side * 2] = [foot[0] + 18, -24 - (stance ? 0 : 10 * Math.sin(Math.PI * t))];
                const swing = Math.sin((cycle + side * 0.5) * Math.PI * 2);
                // Pump from the shoulder with a relaxed, consistently bent elbow.
                // Both arms swing in the direction of travel, half a stride apart.
                const angle = swing * 0.65;
                const normal = [32 / Math.hypot(6, 32), 6 / Math.hypot(6, 32)];
                const start = [p[1][0] + normal[0] * (side ? 13 : -13), p[1][1] + normal[1] * (side ? 13 : -13) + 2];
                const elbow = [start[0] + Math.sin(angle) * 21, start[1] + Math.cos(angle) * 21];
                p[3 + side * 2] = elbow;
                p[4 + side * 2] = [elbow[0] + Math.sin(angle + 1.65) * 20, elbow[1] + Math.cos(angle + 1.65) * 20];
            }
            return p;
        }
        if (action === 'block') {
            const engage = smooth(progress * 3);
            const p = mix(poses.protect[0], poses.block[1], engage);
            const effort = reduced.matches ? 0 : Math.sin(time * 7 + variant * 1.7);
            // Short, alternating hand strikes and weight shifts; boots stay planted.
            p[0][0] += effort * 1.5 * engage;
            p[1][0] += effort * 2 * engage;
            p[2][1] += Math.abs(effort) * 1.2 * engage;
            if (!reduced.matches) for (const [foot, phase] of [[8, 0], [10, Math.PI]]) {
                const step = Math.sin(time * 4 + phase + variant);
                p[foot][0] += step * 2 * engage;
                p[foot][1] -= Math.max(0, step) * 2.2 * engage;
            }
            p[4][0] += effort * 3 * engage;
            p[6][0] -= effort * 3 * engage;
            return p;
        }
        if (action === 'snapBlock') {
            // Finish the snap before rising into protection; no idle-pose jump.
            const snapEnd = 0.3 / 0.75;
            if (progress <= snapEnd) return mix(poses.snap[0], poses.snap[1], smooth(progress / snapEnd));
            return mix(poses.snap[1], poses.block[1], smooth((progress - snapEnd) / (1 - snapEnd)));
        }
        if (action === 'holder') {
            const p = poses.holder[0].map(point => [...point]);
            // Receive with both hands, lower the ball, then steady it on the turf.
            const receive = Math.sin(clamp(progress) * Math.PI);
            // The free hand returns to the near knee after the catch. Keeping
            // both wrists at the spot made the overlapping forearms unreadable.
            p[4][0] += receive * 39;
            p[4][1] -= receive * 20;
            p[6][1] -= receive * 17;
            if (!reduced.matches) p[0][1] += Math.sin(time * 2.2) * 0.6;
            return p;
        }
        const frames = poses[action === 'rush' ? 'run' : action] || poses.idle;
        if (!Array.isArray(frames[0][0])) {
            const p = frames.map(point => [...point]);
            if (!reduced.matches) for (const i of [0, 1, 3, 4, 5, 6]) p[i][1] += Math.sin(time * 2.4 + variant) * 0.65;
            return p;
        }
        let fraction = action === 'run' || action === 'rush' ? (time * 1.8 + variant * 0.19) % 1 : clamp(progress);
        if (reduced.matches && ['run', 'rush', 'idle', 'block'].includes(action)) fraction = 0;
        const value = fraction * (frames.length - 1), index = Math.min(frames.length - 1, Math.floor(value));
        let blend = value - index;
        if (action === 'throw' || action === 'kick') {
            const stops = action === 'throw' ? [0, 0.32, 0.5, 0.78, 1] : [0, 0.26, 0.5, 0.66, 0.88, 1];
            const next = stops.findIndex(stop => stop > fraction);
            const to = next < 0 ? stops.length - 1 : Math.max(1, next);
            blend = clamp((fraction - stops[to - 1]) / (stops[to] - stops[to - 1]));
            return mix(frames[to - 1], frames[to], blend * blend * (3 - 2 * blend));
        }
        return mix(frames[index], frames[Math.min(frames.length - 1, index + 1)], blend * blend * (3 - 2 * blend));
    }
    function shade(hex, light) {
        const value = hex.replace('#', '');
        const rgb = [0, 2, 4].map(i => Math.max(0, Math.min(255, parseInt(value.slice(i, i + 2), 16) + light)));
        return `rgb(${rgb.join(',')})`;
    }
    function headFor(player) {
        const art = window.playerLikenesses?.[player.id];
        if (!art) return null;
        if (!headImages.has(art.src)) {
            const image = new Image();
            image.src = art.src;
            headImages.set(art.src, {image, ready: new Promise((resolve, reject) => {
                image.onload = () => { resolve(image); document.kickGame?.draw(); };
                image.onerror = () => reject(new Error(`Unable to load likeness atlas ${art.src}`));
            })});
            headImages.get(art.src).ready.catch(() => {});
        }
        return {...art, image: headImages.get(art.src).image};
    }
    function preload(teamId = teamArcade.team.id) {
        const cast = window.currentRosters.teams[teamId].cast;
        const counts = {quarterback: 1, receiver: 3, lineman: 2, corner: 3, safety: 2, rusher: 3, kicker: 1, holder: 1, snapper: 1};
        const art = Object.entries(counts).flatMap(([role, count]) => cast[role].slice(0, count)).map(headFor);
        return Promise.all([...new Set(art.filter(Boolean).map(a => headImages.get(a.src).ready))]);
    }
    function armJoint(start, hand, hint, upper = 22, lower = 22, bendSign) {
        // Two-bone IK keeps elbow anatomy consistent as a shared pose changes.
        const dx = hand[0] - start[0], dy = hand[1] - start[1];
        const distance = Math.max(0.01, Math.min(upper + lower - 0.01, Math.hypot(dx, dy)));
        const direction = Math.atan2(dy, dx);
        const bend = Math.acos(Math.max(-1, Math.min(1, (upper * upper + distance * distance - lower * lower) / (2 * upper * distance))));
        const candidates = [direction + bend, direction - bend].map(angle => [start[0] + Math.cos(angle) * upper, start[1] + Math.sin(angle) * upper]);
        if (bendSign) return candidates[bendSign > 0 ? 0 : 1];
        return candidates.sort((a, b) => Math.hypot(a[0] - hint[0], a[1] - hint[1]) - Math.hypot(b[0] - hint[0], b[1] - hint[1]))[0];
    }
    function rig(role, options = {}) {
        const {action = 'idle', time = 0, progress = 0.5, variant = 0, teamId = teamArcade.team.id} = options;
        const player = identity(role, teamId, variant);
        const stature = Math.max(0.94, Math.min(1.07, (player.height || 74) / 74));
        // Body mass changes volume more than shoulder span. Avoid scaling width
        // directly with weight, which made heavier linemen unnaturally broad.
        const bulk = Math.max(0.9, Math.min(1.15, Math.sqrt((player.weight || 225) / 225)));
        let p = pose(action, time * (options.pace || 1), progress, variant, options.stride).map(point => [...point]);
        if (['run', 'rush'].includes(action) && options.movement !== undefined) p = mix(pose('idle', time, 0, variant), p, smooth(options.movement));
        if (action === 'catch' && options.movement > 0.05) {
            // A receiver gathers the pass without losing the stride underneath them.
            const gait = pose('run', time, 0, variant, options.stride);
            for (const i of [7, 8, 9, 10]) p[i] = gait[i];
            p[2] = gait[2];
            p = mix(p, gait, smooth((progress - 0.78) / 0.22));
        }
        // Uniform scale preserves each athlete's proportions through every action.
        // Seat the chin at the collar instead of leaving a long exposed neck.
        p[0] = p[0].map((v, i) => p[1][i] + (v - p[1][i]) * 0.76);
        p = p.map(point => point.map(v => v * stature));
        const hip = p[2], shoulder = p[1];
        const angle = Math.atan2(shoulder[0] - hip[0], hip[1] - shoulder[1]);
        const normal = [Math.cos(angle), Math.sin(angle)];
        function solve(start, endIndex, jointIndex, upper, lower, bendSign) {
            const end = p[endIndex], length = Math.hypot(end[0] - start[0], end[1] - start[1]);
            const reach = Math.max(Math.abs(upper - lower) + 0.2, Math.min(upper + lower - 0.2, length));
            if (length !== reach) p[endIndex] = start.map((v, i) => v + (length ? (end[i] - v) / length : i ? 1 : 0) * reach);
            p[jointIndex] = armJoint(start, p[endIndex], p[jointIndex], upper, lower, bendSign);
        }
        for (const side of [-1, 1]) {
            const handIndex = side === -1 ? 4 : 6, footIndex = side === -1 ? 8 : 10;
            const armStart = [shoulder[0] + normal[0] * side * 13 * bulk, shoulder[1] + normal[1] * side * 13 * bulk + 2];
            // The kneeling holder receives with elbows down, then reaches to
            // the spot without switching to an upward elbow bend.
            solve(armStart, handIndex, handIndex - 1, 21 * stature, 20 * stature, action === 'holder' ? 1 : undefined);
            const legStart = [hip[0] + side * 6 * bulk, hip[1] + 1];
            solve(legStart, footIndex, footIndex - 1, 24 * stature, 23 * stature, -1);
        }
        return {p, bulk, player, normal, angle};
    }
    function advance(actor, dx, dy, dt, height = 60) {
        const distance = Math.hypot(dx, dy);
        actor.stride = (actor.stride || 0) + distance / (36 / 0.6 * height / 110);
        const target = distance > 0.02 ? 1 : 0;
        actor.movement = (actor.movement || 0) + (target - (actor.movement || 0)) * Math.min(1, dt * 12);
    }
    function hand(role, x, y, width, height, options = {}) {
        const {p} = rig(role, options);
        const scale = height / 110;
        return {x: x + width / 2 + p[6][0] * scale * (options.flip ? -1 : 1), y: y + height + p[6][1] * scale};
    }
    function foot(role, x, y, width, height, options = {}) {
        const {p} = rig(role, options), scale = height / 110;
        return {x: x + width / 2 + p[10][0] * scale * (options.flip ? -1 : 1), y: y + height + p[10][1] * scale};
    }
    function draw(c, role, x, y, width, height, options = {}) {
        const {teamId = teamArcade.team.id, variant = 0, flip = false, action = 'idle', time = 0, progress = 0.5, ball = false} = options;
        const team = NFL_TEAMS.find(t => t.id === teamId);
        const {p, bulk, player, normal, angle: torsoAngle} = rig(role, options);
        const art = headFor(player);
        const skin = art?.skin || '#a77050';
        const scale = height / 110;
        const hip = p[2], shoulder = p[1];
        c.save(); c.translate(x + width / 2, y + height); c.scale((flip ? -1 : 1) * scale, scale);
        c.lineJoin = 'round'; c.lineCap = 'round';
        function tube(a, b, ra, rb, color, bulge = 1, surface) {
            const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
            const tx = dx / length, ty = dy / length, nx = -ty, ny = tx;
            const paint = c.createLinearGradient(a[0] - nx * ra, a[1] - ny * ra, a[0] + nx * ra, a[1] + ny * ra);
            paint.addColorStop(0, shade(color, -14)); paint.addColorStop(0.45, shade(color, 9)); paint.addColorStop(1, shade(color, -5));
            c.beginPath(); c.moveTo(a[0] + nx * ra, a[1] + ny * ra);
            c.bezierCurveTo(a[0] + dx * 0.3 + nx * ra * bulge, a[1] + dy * 0.3 + ny * ra * bulge,
                b[0] - dx * 0.2 + nx * rb, b[1] - dy * 0.2 + ny * rb, b[0] + nx * rb, b[1] + ny * rb);
            c.quadraticCurveTo(b[0] + tx * rb, b[1] + ty * rb, b[0] - nx * rb, b[1] - ny * rb);
            c.bezierCurveTo(b[0] - dx * 0.2 - nx * rb, b[1] - dy * 0.2 - ny * rb,
                a[0] + dx * 0.3 - nx * ra * bulge, a[1] + dy * 0.3 - ny * ra * bulge, a[0] - nx * ra, a[1] - ny * ra);
            c.quadraticCurveTo(a[0] - tx * ra, a[1] - ty * ra, a[0] + nx * ra, a[1] + ny * ra);
            c.closePath(); c.fillStyle = surface || paint; c.fill();
            if (surface) return;
            // Outline only the long edges, so elbows and knees have no ring seams.
            c.strokeStyle = shade(color, -37); c.lineWidth = 0.65;
            c.beginPath(); c.moveTo(a[0] + nx * ra, a[1] + ny * ra);
            c.bezierCurveTo(a[0] + dx * 0.3 + nx * ra * bulge, a[1] + dy * 0.3 + ny * ra * bulge,
                b[0] - dx * 0.2 + nx * rb, b[1] - dy * 0.2 + ny * rb, b[0] + nx * rb, b[1] + ny * rb); c.stroke();
            c.beginPath(); c.moveTo(a[0] - nx * ra, a[1] - ny * ra);
            c.bezierCurveTo(a[0] + dx * 0.3 - nx * ra * bulge, a[1] + dy * 0.3 - ny * ra * bulge,
                b[0] - dx * 0.2 - nx * rb, b[1] - dy * 0.2 - ny * rb, b[0] - nx * rb, b[1] - ny * rb); c.stroke();
        }
        function contour(points, radii, color) {
            // A shared light source and overlapping fills make a single soft volume.
            const left = Math.min(...points.map((p, i) => p[0] - radii[i]));
            const right = Math.max(...points.map((p, i) => p[0] + radii[i]));
            const surface = c.createLinearGradient(left, 0, right, 0);
            surface.addColorStop(0, shade(color, -12));
            surface.addColorStop(0.45, shade(color, 8));
            surface.addColorStop(1, shade(color, -6));
            for (let i = 1; i < points.length; i++) tube(points[i - 1], points[i], radii[i - 1], radii[i], color, 1, surface);
            for (let i = 1; i < points.length - 1; i++) {
                c.fillStyle = surface; c.beginPath(); c.arc(points[i][0], points[i][1], radii[i], 0, Math.PI * 2); c.fill();
            }
        }
        function segment(a, b, color, thickness) {
            tube(a, b, thickness / 2, thickness * 0.42, color);
        }
        function boot(foot, knee) {
            c.save(); c.translate(...foot);
            if (foot[1] < -3) c.rotate(Math.atan2(foot[1] - knee[1], foot[0] - knee[0]) * 0.45);
            c.beginPath(); c.moveTo(-6, -5); c.quadraticCurveTo(-10, 2, -4, 3); c.lineTo(13, 3); c.quadraticCurveTo(16, -1, 9, -4); c.lineTo(3, -6); c.closePath();
            c.fillStyle = '#17252d'; c.fill(); c.strokeStyle = '#071a21'; c.lineWidth = 1.2; c.stroke();
            c.strokeStyle = '#e5eef0'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-5, 2); c.lineTo(12, 2); c.moveTo(0, -3); c.lineTo(5, -3); c.stroke();
            c.restore();
        }
        for (const [knee, foot, side] of [[p[9], p[10], 1], [p[7], p[8], -1]]) {
            const start = [hip[0] + side * 6 * bulk, hip[1] + 1];
            // One continuous silhouette covers the knee; seams describe cloth, not hinges.
            contour([start, knee, foot], [9 * bulk, 6.4 * bulk, 3.4 * bulk], '#e1e6e8');
            const sock = [knee[0] * 0.48 + foot[0] * 0.52, knee[1] * 0.48 + foot[1] * 0.52];
            contour([sock, foot], [4.3 * bulk, 3.3 * bulk], '#263640', false);
            c.strokeStyle = team.secondary; c.lineWidth = 1.6;
            c.beginPath(); c.moveTo(start[0] + side * 5 * bulk, start[1]);
            c.quadraticCurveTo(knee[0] + side * 4 * bulk, knee[1] - 5, knee[0] + side * 3 * bulk, knee[1] + 3); c.stroke();
            c.strokeStyle = '#a4b3ba'; c.lineWidth = 0.75;
            c.beginPath(); c.moveTo(knee[0] - 3, knee[1] - 2); c.quadraticCurveTo(knee[0], knee[1] - 4, knee[0] + 3, knee[1] - 1); c.stroke();
            boot(foot, knee);
        }
        function arm(side, elbowHint, glove, foreground = false) {
            const start = [shoulder[0] + normal[0] * side * 13 * bulk, shoulder[1] + normal[1] * side * 13 * bulk + 2];
            const elbow = elbowHint;
            const fullArm = !foreground || side === -1;
            if (!fullArm) {
                contour([elbow, glove], [4.8 * bulk, 3 * bulk], skin);
            } else {
                contour([start, elbow, glove], [6.7 * bulk, 4.8 * bulk, 3 * bulk], skin);
                const sleeveEnd = [start[0] * 0.4 + elbow[0] * 0.6, start[1] * 0.4 + elbow[1] * 0.6];
                // A fitted sleeve joins the outer shoulder without a second pad across the chest.
                contour([start, sleeveEnd], [6.7 * bulk, 5.8 * bulk], team.primary);
                c.strokeStyle = team.secondary; c.lineWidth = 2.2;
                c.beginPath(); c.moveTo(sleeveEnd[0] - 3.5, sleeveEnd[1]); c.lineTo(sleeveEnd[0] + 3.5, sleeveEnd[1]); c.stroke();
            }
            if (!foreground) return;
            // A small inner crease makes the elbow bend legible without a
            // circular seam that would make the arm look like a mechanical hinge.
            c.save(); c.translate(...elbow);
            c.rotate(Math.atan2(glove[1] - elbow[1], glove[0] - elbow[0]));
            c.strokeStyle = shade(skin, -28); c.lineWidth = 0.9;
            c.beginPath(); c.moveTo(-1, -2.7 * bulk);
            c.quadraticCurveTo(1.5, 0, -1, 2.7 * bulk); c.stroke(); c.restore();
            const bareHands = ['quarterback', 'kicker', 'holder', 'snapper'].includes(role);
            c.fillStyle = bareHands ? skin : '#edf3f5'; c.strokeStyle = '#16333b'; c.lineWidth = 1;
            c.beginPath(); c.ellipse(glove[0], glove[1], 3.5 * bulk, 4.2 * bulk, -0.35, 0, Math.PI * 2); c.fill(); c.stroke();
            c.strokeStyle = bareHands ? shade(skin, -30) : '#9badb5'; c.lineWidth = 0.7;
            c.beginPath(); c.moveTo(glove[0], glove[1] - 2); c.lineTo(glove[0] + 2, glove[1] + 2); c.stroke();
            // Individual sleeves and wrist tape remain part of the articulated limb.
            if (Number(player.number) % 2 === 0) segment([elbow[0] * 0.4 + glove[0] * 0.6, elbow[1] * 0.4 + glove[1] * 0.6], [elbow[0] * 0.25 + glove[0] * 0.75, elbow[1] * 0.25 + glove[1] * 0.75], '#f5f6ef', 7.5 * bulk);
        }
        arm(1, p[5], p[6]);
        arm(-1, p[3], p[4]);
        // Match the joint rig's rotation: local down must point from shoulder
        // to hip. The opposite sign detached the jersey from bent players' legs.
        c.save(); c.translate(...shoulder); c.rotate(torsoAngle);
        const torsoHeight = Math.hypot(hip[0] - shoulder[0], hip[1] - shoulder[1]);
        const jersey = c.createLinearGradient(-20 * bulk, -5, 20 * bulk, 8);
        jersey.addColorStop(0, shade(team.primary, -20)); jersey.addColorStop(0.42, shade(team.primary, 30)); jersey.addColorStop(1, shade(team.primary, -12));
        c.beginPath(); c.moveTo(-17 * bulk, 0);
        c.quadraticCurveTo(-12 * bulk, -5, -5, -5); c.lineTo(-3, -1);
        c.quadraticCurveTo(0, 2, 3, -1); c.lineTo(5, -5);
        c.quadraticCurveTo(12 * bulk, -5, 17 * bulk, 0);
        c.quadraticCurveTo(19 * bulk, 6, 16 * bulk, 13);
        c.lineTo(12 * bulk, torsoHeight + 3); c.lineTo(-12 * bulk, torsoHeight + 3);
        c.lineTo(-16 * bulk, 13); c.quadraticCurveTo(-19 * bulk, 6, -17 * bulk, 0); c.closePath();
        c.fillStyle = jersey; c.fill(); c.strokeStyle = '#102733'; c.lineWidth = 1.4; c.stroke();
        c.strokeStyle = '#ffffff55'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-15 * bulk, 0); c.quadraticCurveTo(-7, -4, -4, -2); c.stroke();
        c.strokeStyle = team.secondary; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-4, -5); c.lineTo(0, 0); c.lineTo(4, -5); c.stroke();
        c.strokeStyle = '#10252e'; c.lineWidth = 3; c.beginPath(); c.moveTo(-12 * bulk, torsoHeight + 1); c.lineTo(12 * bulk, torsoHeight + 1); c.stroke();
        c.save(); if (flip) c.scale(-1, 1);
        c.fillStyle = '#fff'; c.strokeStyle = '#18303c'; c.lineWidth = 1.1; c.textAlign = 'center'; c.font = '900 20px Impact, Arial Black, sans-serif';
        c.strokeText(player.number, 0, 22); c.fillText(player.number, 0, 22); c.restore();
        c.restore();
        // The near arm overlays the jersey from the shoulder all the way to
        // the hand. Hiding its upper arm made the elbow emerge from the chest.
        arm(1, p[5], p[6], true);
        arm(-1, p[3], p[4], true);
        // Small neck bridges the portrait to the jersey in every pose.
        segment([shoulder[0], shoulder[1] - 2], [p[0][0], p[0][1] + 13], skin, 9 * bulk);
        if (art?.image.complete && art.image.naturalWidth) {
            const [sx, sy, sw, sh] = art.crop;
            const headHeight = 32, headWidth = Math.min(36, headHeight * sw / sh);
            const pitch = action === 'holder' ? 0.2 : ['tackle', 'tackled'].includes(action) ? clamp(progress) * 0.48 : action === 'kick' ? -0.08 : torsoAngle * 0.12;
            c.save(); c.translate(p[0][0], p[0][1] + 13); c.rotate(pitch);
            c.drawImage(art.image, sx, sy, sw, sh, -headWidth / 2, -headHeight, headWidth, headHeight); c.restore();
        } else {
            // Loading frame: a neutral silhouette, never another player's face.
            c.fillStyle = skin; c.beginPath(); c.ellipse(p[0][0], p[0][1], 14, 18, 0, 0, Math.PI * 2); c.fill();
        }
        // Cancel the athlete's local scale so catches and releases keep the
        // same ball size as the flight drawn directly in field coordinates.
        if (ball) footballArt.draw(c, p[6][0], p[6][1], footballArt.gameplayWidth / scale, role === 'holder' ? Math.PI / 2 : -0.5);
        c.restore(); return true;
    }
    window.footballPlayers = {draw, identity, pose, rig, preload, hand, foot, headFor, advance};
    window.playerMotion.identity = identity;
})();
