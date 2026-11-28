// Reuse the shared transparent football silhouette with each team's exact palette.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../public/', import.meta.url);
const context = {window: {}};
vm.runInNewContext(await readFile(new URL('scripts/teams-data.js', root), 'utf8'), context);
const football = await readFile(new URL('assets/football.svg', root), 'utf8');
await mkdir(new URL('assets/favicons/', root), {recursive: true});
const shade = (hex, end, amount) => '#' + [1, 3, 5].map(offset => Math.round(parseInt(hex.slice(offset, offset + 2), 16) * (1 - amount) + end * amount).toString(16).padStart(2, '0')).join('');
for (const team of context.window.NFL_TEAMS) {
    const icon = football
        .replaceAll('#cf8a50', shade(team.primary, 255, 0.25))
        .replaceAll('#a65c32', team.primary)
        .replaceAll('#60321f', shade(team.primary, 0, 0.25))
        .replaceAll('#45291d', shade(team.primary, 0, 0.45))
        .replaceAll('#efba7d', shade(team.primary, 255, 0.65))
        .replaceAll('#542d1f', shade(team.primary, 0, 0.35))
        .replaceAll('#633722', shade(team.primary, 0, 0.4))
        .replaceAll('#fff2d8', '#ffffff');
    await writeFile(new URL(`assets/favicons/${team.id}.svg`, root), icon);
}
console.log('Updated 32 transparent team football icons.');
