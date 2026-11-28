// Evergreen football challenges: no live roster or season data required.
window.playbookGames = {
    pocket: {
        title: 'Pocket Read', category: 'action', mark: 'QB', tagline: 'Read the safety. Release on the break.',
        description: 'Three receivers, one roaming safety. Throw into the open lane before the pocket collapses.',
        rules: 'Choose a receiver with buttons or keys 1–3. The bright OPEN lane changes as the safety rotates. Each snap gives you less time; a covered throw or sack costs a heart. Complete ten passes before losing three hearts.',
        unit: 'completions', goal: 7, badge: 'Pocket professor'
    },
    shove: {
        title: 'Brotherly Shove', category: 'timing', mark: 'PUSH', tagline: 'One yard. A whole city behind you.',
        description: 'Time the snap, then spend your line’s energy wisely. Three downs to move the pile.',
        rules: 'Press Snap / Push or Space as the marker crosses the green window. Each push spends energy and the window narrows as your line tires. Rest restores energy but costs a down. Gain 36 inches in three downs; every successful series makes the next tougher.',
        unit: 'touchdowns', goal: 2, badge: 'Push together'
    },
    recall: {
        title: 'Route Recall', category: 'strategy', mark: 'X O', tagline: 'Learn the route. Listen for the audible.',
        description: 'Remember a growing route sequence. An audible can flip the entire play backward.',
        rules: 'Watch the numbered route pads light up, then repeat with buttons or keys 1–4. Every third round calls an audible: enter the sequence in REVERSE. Clear eight rounds to master the playbook. Replay the demonstration once per round if needed.',
        unit: 'rounds', goal: 5, badge: 'Playbook memory'
    },
    punt: {
        title: 'Coffin Corner', category: 'timing', mark: 'PIN', tagline: 'Big leg. Soft landing.',
        description: 'Balance hang time, wind, and the first bounce to pin a punt just short of the goal line.',
        rules: 'Set power and loft, then Punt. Wind changes on each of five kicks. Low loft rolls farther; high loft softens the bounce. Finish between 80 and 100 yards for points, with the most near 98. At 100 or beyond it is a touchback worth zero. The preview predicts landing, not the roll.',
        unit: 'points', goal: 300, badge: 'Pinned deep'
    },
    signal: {
        title: 'Sideline Cipher', category: 'strategy', mark: 'CALL', tagline: 'Crack the call before fourth down.',
        description: 'Decode a secret three-play call using exact and misplaced clues. No repeated plays.',
        rules: 'Choose three different plays, then send the call. EXACT means the right play in the right position; SHIFT means a right play in the wrong position. Use both counts to decode the call within six attempts. New codes use the same five plays, with no repeats.',
        unit: 'calls cracked', goal: 1, badge: 'Signal caller'
    }
};

for (const [id, game] of Object.entries(window.playbookGames)) {
    const team = window.teamArcade.team;
    game.title = team.games[id];
    game.description = window.teamArcade.personality?.gameHooks[id] || game.description;
    game.tagline = `${team.nickname} football. ${game.tagline}`;
    if (id === 'shove') game.tagline = `One yard. All ${team.nickname}.`;
    const rule = window.teamArcade.ruleFor(id);
    if (rule) game.rules = `${rule.theme}. ${rule.description} ${id === 'signal' ? 'Select three plays and send your call. Use EXACT and SHIFT feedback to solve the order.' : id === 'recall' ? 'Watch the route pads, then answer with keys 1–4 or buttons. Clear eight rounds; replay once per round.' : game.rules}`;
    game.badge = `${team.short} ${game.badge}`;
}

// Passing Drive replaces the original lane-selection Pocket Read, preserving its record slot.
Object.assign(window.playbookGames.pocket, {
    title: 'Passing Drive', tagline: 'Call the route. Work the pocket. Run after the catch.',
    description: 'Choose slants, flood, or crossing routes. Evade the rival rush, lead a receiver, and run after the catch across three football drives.',
    rules: 'Four downs to gain ten yards. Choose a route and snap with Space. Move with arrows / WASD, throw with 1–3, then control the receiver. Bullet passes are fast; lobs clear underneath defenders. P pauses.',
    goal: 7
});
