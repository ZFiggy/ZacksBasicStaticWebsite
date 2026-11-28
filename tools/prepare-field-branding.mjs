import {readFile, writeFile, mkdir} from 'node:fs/promises';
import vm from 'node:vm';

const context = {window: {}};
vm.runInNewContext(await readFile(new URL('../public/scripts/teams-data.js', import.meta.url), 'utf8'), context);
const directory = new URL('../public/assets/field-branding/', import.meta.url);
await mkdir(directory, {recursive: true});
const credits = [];
for (const team of context.window.NFL_TEAMS) {
    if (team.id === 'eagles') continue;
    const abbreviation = team.short === 'WSH' ? 'WAS' : team.short;
    for (const kind of ['logo', 'wordmark']) {
        const source = kind === 'logo'
            ? `https://a.espncdn.com/i/teamlogos/nfl/500/${({WAS: 'wsh', LAR: 'lar'}[abbreviation] || abbreviation.toLowerCase())}.png`
            : `https://raw.githubusercontent.com/nflverse/nflverse-pbp/master/wordmarks/${abbreviation}.png`;
        const response = await fetch(source);
        if (!response.ok) throw new Error(`${team.id} ${kind}: ${response.status}`);
        const file = `${team.id}-${kind}.png`;
        await writeFile(new URL(file, directory), Buffer.from(await response.arrayBuffer()));
        credits.push({team: team.id, kind, file, source, rights: 'Team trademark; unofficial fan project. Wordmark archive: nflverse.'});
    }
}
await writeFile(new URL('credits.json', directory), `${JSON.stringify({note: 'Representative home-field-inspired paint, not a claim of exact current stadium reproduction.', references: ['https://www.bengals.com/news/bengals-fashion-change-727230', 'https://www.49ers.com/photos/gameday-ready-49ers-red-end-zones-are-back-divisional-playoffs-san-francisco-levis-stadium', 'https://www.steelers.com/news/steelers-to-wear-color-rush-uniforms-vs-ne'], assets: credits}, null, 4)}\n`);
console.log(`Saved ${credits.length} credited team logos and wordmarks.`);
