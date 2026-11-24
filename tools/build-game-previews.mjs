// Native vector previews show the actual challenge instead of unrelated practice photos.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import vm from 'node:vm';
const context = {window: {}};
vm.runInNewContext(await readFile('public/scripts/teams-data.js', 'utf8'), context);
const profiles = JSON.parse(await readFile('public/assets/game-covers/personality-sources.json', 'utf8'));
const directory = 'public/assets/game-covers/previews';
await mkdir(directory, {recursive: true});
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const text = (x, y, value, size = 24, fill = 'white') => `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial,sans-serif" font-size="${size}" font-weight="700" text-anchor="middle">${escape(value)}</text>`;
const jersey = (x, y, number, color = '#eef6f8', ink = '#102531', scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-26-38-50-20-37 0-27-7-27 40H27V-7L37 0 50-20 26-38 12-31H-12Z" fill="${color}" stroke="#ffffff88" stroke-width="3"/>${text(0, 20, number, 38, ink)}</g>`;
const ball = (x, y, scale = 1) => `<g transform="translate(${x} ${y}) rotate(-30) scale(${scale})"><ellipse rx="30" ry="17" fill="#b97542" stroke="#e9bb87" stroke-width="3"/><path d="M-17 0H17M-10-6V6M0-6V6M10-6V6" stroke="white" stroke-width="3"/></g>`;
const route = (d, color = '#b8f69d') => `<path d="${d}" stroke="${color}" stroke-width="7" stroke-dasharray="12 8" fill="none" stroke-linecap="round"/>`;
let count = 0;
for (const team of context.window.NFL_TEAMS) {
    if (team.id === 'eagles') continue;
    const profile = profiles.find(item => item.teamId === team.id);
    const primary = team.primary;
    const accent = team.secondary;
    const qb = profile.quarterback.number;
    const player = profile.runner.number;
    const scenes = {
        game: jersey(250, 295, player) + ball(435, 210, 1.3) + ball(585, 340, 1.3) + route('M285 290Q380 290 420 220M280 320Q420 400 550 345') + text(400, 115, 'COLLECT BOTH FOOTBALLS', 24),
        kick: `<path d="M330 100V220H550V100M440 220V350" fill="none" stroke="#ffe293" stroke-width="12"/>` + route('M235 355Q270 100 440 150') + ball(235, 355, 1.4) + `<rect x="200" y="400" width="400" height="24" rx="8" fill="#061925"/><rect x="365" y="400" width="70" height="24" fill="#b8f69d"/><path d="M390 390V435" stroke="white" stroke-width="5"/>`,
        pocket: [200, 400, 600].map((x, i) => `<rect x="${x - 75}" y="120" width="150" height="170" rx="12" fill="${i === 1 ? '#a9eb8144' : '#06192555'}" stroke="${i === 1 ? '#c7ff96' : '#ffffff55'}" stroke-width="3"/>` + jersey(x, 190, i + 1, i === 1 ? '#c7ff96' : '#eef6f8') + text(x, 265, i === 1 ? 'OPEN' : 'COVERED', 19)).join('') + jersey(400, 370, qb, accent) + route('M400 330V290'),
        shove: `<path d="M600 130V390" stroke="white" stroke-width="7"/>${text(665, 270, 'TD', 50, accent)}` + [280, 350, 420].map((x, i) => jersey(x, 250 + (i === 1 ? 12 : 0), [63, qb, 65][i], i === 1 ? accent : '#eef6f8', '#102531', 1.15)).join('') + route('M465 250H570') + `<rect x="180" y="365" width="400" height="28" rx="6" fill="#061925"/><rect x="350" y="365" width="90" height="28" fill="#b8f69d"/><path d="M395 354V405" stroke="white" stroke-width="5"/>`,
        recall: [0, 1, 2, 3].map(i => {const x = 200 + (i % 2) * 260, y = 115 + Math.floor(i / 2) * 150; return `<rect x="${x}" y="${y}" width="200" height="120" rx="12" fill="${i === 1 ? accent : '#06192588'}" stroke="#ffffff99" stroke-width="3"/>` + route(`M${x + 30} ${y + 90}V${y + 35}H${x + 155}`, i === 1 ? '#102531' : '#d9f6f1') + text(x + 175, y + 100, i + 1, 24, i === 1 ? '#102531' : 'white');}).join(''),
        punt: `<rect x="605" y="100" width="100" height="300" fill="${accent}55"/><path d="M180 400H710M605 100V400" stroke="white" stroke-width="4"/>` + route('M185 360Q370 40 565 350') + ball(385, 175, 1.3) + `<ellipse cx="565" cy="385" rx="28" ry="10" fill="#b8f69d99"/>` + text(660, 240, 'END', 22) + text(660, 270, 'ZONE', 22) + text(565, 435, 'PIN IT HERE', 22, '#c7ff96'),
        blitz: Array.from({length: 36}, (_, i) => {const x = 240 + (i % 6) * 52, y = 100 + Math.floor(i / 6) * 52; const value = i === 30 ? 'QB' : i === 5 ? 'TD' : [8, 19, 28].includes(i) ? 'R' : [14, 22].includes(i) ? '■' : ''; const fill = value === 'QB' ? '#e9f6f3' : value === 'TD' ? '#c7ff96' : value === 'R' ? '#c65146' : '#ffffff12'; return `<rect x="${x}" y="${y}" width="46" height="46" rx="5" fill="${fill}" stroke="#ffffff55"/>` + text(x + 23, y + 30, value, 18, ['QB', 'TD'].includes(value) ? '#102531' : 'white');}).join(''),
        signal: text(400, 120, 'DECODE THE THREE-PLAY CALL', 24) + [250, 400, 550].map(x => `<rect x="${x - 56}" y="160" width="112" height="108" rx="12" fill="#06192599" stroke="${accent}" stroke-width="3"/>` + text(x, 235, '?', 62, accent)).join('') + ['RUN', 'PASS', 'SCREEN', 'KICK'].map((label, i) => text(205 + i * 130, 330, label, 20)).join('') + text(400, 395, '2 EXACT · 1 SHIFTED', 26, '#c7ff96')
    };
    for (const [id, scene] of Object.entries(scenes)) {
        const role = id === 'game' ? profile.runner : ['kick', 'punt'].includes(id) ? profile.kicker : profile.quarterback;
        const stripes = Array.from({length: 7}, (_, i) => `<path d="M80 ${90 + i * 50}H720" stroke="#ffffff12" stroke-width="2"/>`).join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="field" x2="0" y2="1"><stop stop-color="${primary}"/><stop offset="1" stop-color="#081f2b"/></linearGradient></defs><rect width="800" height="500" fill="url(#field)"/>${stripes}<path d="M80 80H720V445H80Z" fill="none" stroke="#ffffff33" stroke-width="3"/>${text(400, 48, team.name.toUpperCase(), 22, accent)}${scene}${text(400, 480, `${role.name} · #${role.number}`, 19)}</svg>`;
        await writeFile(`${directory}/${team.id}-${id}.svg`, svg + '\n');
        count++;
    }
}
console.log(`Built ${count} team-colored game previews.`);
