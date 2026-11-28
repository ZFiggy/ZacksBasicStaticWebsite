import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
class Cdp {
    constructor(url) {
        this.ws = new WebSocket(url);
        this.id = 0;
        this.pending = new Map();
        this.errors = [];
        this.ready = new Promise(resolve => this.ws.addEventListener('open', resolve, {once: true}));
        this.ws.addEventListener('message', ({data}) => {
            const message = JSON.parse(data);
            if (message.method === 'Runtime.exceptionThrown') this.errors.push(message.params.exceptionDetails);
            if (message.id) {
                const handler = this.pending.get(message.id);
                this.pending.delete(message.id);
                message.error ? handler.reject(message.error) : handler.resolve(message.result);
            }
        });
    }
    async send(method, params = {}) {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.pending.set(++this.id, {resolve, reject});
            this.ws.send(JSON.stringify({id: this.id, method, params}));
        });
    }
    async evaluate(expression) {
        const response = await this.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
        if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
        return response.result.value;
    }
    async until(expression) {
        for (let i = 0; i < 200; i++) {
            if (await this.evaluate(expression)) return;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Timed out: ${expression}\n${await this.evaluate('document.body.innerText')}`);
    }
    async navigate(emulator = true) {
        await this.send('Page.navigate', {url: `http://localhost:8000/counter.html?${emulator ? 'emulator=1&' : ''}qa=${Date.now()}`});
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.until("document.readyState === 'complete' && !!document.clickLeaderboard");
    }
}

const browserInfo = await (await fetch('http://localhost:9224/json/version')).json();
const browser = new Cdp(browserInfo.webSocketDebuggerUrl);
const {browserContextId} = await browser.send('Target.createBrowserContext');
const {targetId} = await browser.send('Target.createTarget', {url: 'about:blank', browserContextId});
const targets = await (await fetch('http://localhost:9224/json/list')).json();
const client = new Cdp(targets.find(target => target.id === targetId).webSocketDebuggerUrl);
await client.send('Page.enable');
await client.send('Runtime.enable');
await client.send('Network.enable');
await client.send('Network.setCacheDisabled', {cacheDisabled: true});
async function go(page) {
    await client.send('Page.navigate', {url: `http://localhost:8000/${page}`});
    await client.until(`location.href.includes(${JSON.stringify(page)}) && document.readyState === 'complete' && !!window.teamArcade`);
}
async function lobby(team) {
    await go(`games.html?team=${team}`);
    await client.until('!!document.gamesLobby && document.querySelector(".lobby-team-art").dataset.artReady === "true"');
}
async function featured() {
    return client.evaluate(`(() => {
        const game = document.gamesLobby.featuredGame;
        const link = document.getElementById('featured-game-link');
        return {id: game.id, title: document.getElementById('featured-game-title').textContent,
            expectedTitle: game.title, href: link.getAttribute('href'), expectedHref: teamArcade.link(game.href),
            button: link.textContent, art: document.querySelector('.lobby-team-art').dataset.gameArt,
            record: document.getElementById('featured-game-best').textContent,
            expectedRecord: fanArcade.number(game.key) + ' ' + game.unit};
    })()`);
}
async function check(id) {
    const result = await featured();
    if (id) assert.equal(result.id, id);
    assert.equal(result.title, result.expectedTitle);
    assert.equal(result.href, result.expectedHref);
    assert.equal(result.button, `Play ${result.expectedTitle}`);
    assert.equal(result.art, result.id);
    assert.equal(result.record, result.expectedRecord);
}
try {
    for (const team of ['eagles', 'jaguars', 'bears']) {
        await lobby(team);
        await check('bird');
        const games = await client.evaluate('teamArcade.games.map(({id, href, key, target}) => ({id, href, key, target}))');
        for (const game of games) {
            // Enter the real game page so FanArcade records the most recent game.
            await go(`${game.href}${game.href.includes('?') ? '&' : '?'}team=${team}`);
            await client.until('!!window.fanArcade');
            await client.evaluate(`for (const game of teamArcade.games) teamArcade.storage.setItem(game.key, 0);
                teamArcade.storage.setItem(${JSON.stringify(game.key)}, ${game.target - 1})`);
            await lobby(team);
            await check(game.id);
            await client.evaluate(`teamArcade.storage.setItem(${JSON.stringify(game.key)}, ${game.target});
                document.dispatchEvent(new Event('arcade:progress'))`);
            assert.notEqual((await featured()).id, game.id, `Skip capped ${team}/${game.id}`);
            // With just one unfinished game, that game always wins.
            await client.evaluate(`for (const game of teamArcade.games) teamArcade.storage.setItem(game.key, game.target);
                teamArcade.storage.setItem(${JSON.stringify(game.key)}, ${game.target - 1});
                window.dispatchEvent(new StorageEvent('storage'))`);
            await check(game.id);
        }
    }
    // Team-scoped recent games and caps stay independent.
    await client.evaluate(`teamArcade.storage.setItem('arcadeLastGame', 'kick.html');
        teamArcade.storage.setItem('fieldGoalBest', 0)`);
    await lobby('bears');
    await check('kick');
    await lobby('jaguars');
    await check('pocket');
    // Ignore old/invalid history; new visitors retain flight as the default.
    for (const recent of ['retired.html', 'playbook.html?game=shove', '']) {
        await client.evaluate(`for (const game of teamArcade.games) teamArcade.storage.setItem(game.key, 0);
            teamArcade.storage.setItem('arcadeLastGame', ${JSON.stringify(recent)})`);
        await lobby('jaguars');
        await check('bird');
    }
    // All five games capped: sample the full lineup on every visit, even with scoreboard at zero.
    await client.evaluate(`for (const game of teamArcade.games) teamArcade.storage.setItem(game.key, game.target);
        teamArcade.storage.setItem('clickCount', 0)`);
    for (const [random, expected] of [[0, 'game'], [0.99, 'pocket']]) {
        const {identifier} = await client.send('Page.addScriptToEvaluateOnNewDocument', {source: `Math.random = () => ${random};`});
        await lobby('jaguars');
        await check(expected);
        await client.send('Page.removeScriptToEvaluateOnNewDocument', {identifier});
    }
    // A restored history page also selects again, while routine updates keep the panel steady.
    await client.evaluate(`Math.random = () => 0.3;
        window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}))`);
    await check('bird');
    await client.evaluate(`Math.random = () => 0.99; window.dispatchEvent(new StorageEvent('storage'))`);
    await check('bird');
    for (const width of [1440, 768, 390, 320]) {
        await client.send('Emulation.setDeviceMetricsOverride', {width, height: 1000, deviceScaleFactor: 1, mobile: width < 600});
        for (const theme of ['light', 'dark']) {
            await client.evaluate(`document.documentElement.dataset.theme = '${theme}'`);
            assert.equal(await client.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `${width}/${theme}`);
        }
    }
    await client.send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false});
    await client.evaluate(`teamArcade.storage.setItem('arcadeLastGame', 'kick.html');
        teamArcade.storage.setItem('fieldGoalBest', 3); document.dispatchEvent(new Event('arcade:progress'))`);
    await client.until('document.querySelector(".lobby-team-art").dataset.artReady === "true"');
    await check('kick');
    const screenshot = await client.send('Page.captureScreenshot', {format: 'png'});
    await writeFile('/private/tmp/games-featured.png', Buffer.from(screenshot.data, 'base64'));
    assert.deepEqual(client.errors.map(error => error.exception?.description || error.text), []);
    console.log('PASS recent-game tracking, every game cap, only unfinished option, team isolation, invalid history, random revisit selection, restored pages, progress/storage updates, matching art/links/records, responsive light/dark layouts, and no browser exceptions.');
} finally {
    await browser.send('Target.disposeBrowserContext', {browserContextId});
    client.ws.close();
    browser.ws.close();
}
