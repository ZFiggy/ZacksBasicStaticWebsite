// Fictional arcade rules inspired by each club's home-field identity.
(() => {
    const api = window.teamArcade;
    const identities = {
        eagles: ['Brotherly timing', 'return', 'gust', 'pump', 'power', 'reverse', 'soft', 'checkpoint', 'distinct'],
        cowboys: ['Star formation', 'gates', 'steady', 'deep', 'alternate', 'mirror', 'firm', 'mirror', 'six'],
        giants: ['Big Blue construction', 'rush', 'gust', 'pump', 'power', 'pairs', 'firm', 'checkpoint', 'repeat'],
        commanders: ['Capital command', 'return', 'steady', 'rhythm', 'alternate', 'rotate', 'soft', 'rotate', 'six'],
        packers: ['Frozen tundra', 'ice', 'ice', 'deep', 'patient', 'reverse', 'frozen', 'mirror', 'repeat'],
        bears: ['Windy City crossfire', 'rush', 'gust', 'pump', 'power', 'mirror', 'gust', 'checkpoint', 'six'],
        lions: ['Motor City gears', 'gates', 'accelerate', 'rhythm', 'alternate', 'rotate', 'firm', 'rotate', 'repeat'],
        vikings: ['Skol drumline', 'return', 'ice', 'rhythm', 'alternate', 'pairs', 'frozen', 'mirror', 'six'],
        saints: ['Second-line rhythm', 'gates', 'accelerate', 'rhythm', 'alternate', 'pairs', 'soft', 'rotate', 'repeat'],
        falcons: ['Flight-path switch', 'rush', 'accelerate', 'deep', 'patient', 'mirror', 'firm', 'mirror', 'six'],
        panthers: ['Pounce and patience', 'rush', 'steady', 'deep', 'patient', 'reverse', 'soft', 'checkpoint', 'repeat'],
        buccaneers: ['Buccaneer treasure run', 'return', 'gust', 'pump', 'power', 'rotate', 'gust', 'rotate', 'six'],
        cardinals: ['Desert heat', 'gates', 'accelerate', 'deep', 'patient', 'rotate', 'firm', 'rotate', 'six'],
        rams: ['Hollywood misdirection', 'gates', 'steady', 'pump', 'alternate', 'mirror', 'soft', 'mirror', 'repeat'],
        '49ers': ['Gold-rush motion', 'return', 'gust', 'pump', 'alternate', 'pairs', 'soft', 'rotate', 'six'],
        seahawks: ['Twelfth-man turbulence', 'rush', 'gust', 'rhythm', 'patient', 'reverse', 'gust', 'checkpoint', 'repeat'],
        bills: ['Lake-effect football', 'ice', 'gust', 'pump', 'power', 'pairs', 'frozen', 'checkpoint', 'six'],
        dolphins: ['South Beach speed', 'gates', 'accelerate', 'rhythm', 'patient', 'rotate', 'soft', 'rotate', 'repeat'],
        jets: ['Jet-engine takeoff', 'gates', 'accelerate', 'deep', 'power', 'mirror', 'firm', 'mirror', 'six'],
        patriots: ['Foxborough disguise', 'return', 'ice', 'pump', 'patient', 'mirror', 'frozen', 'rotate', 'repeat'],
        ravens: ['Raven option', 'rush', 'steady', 'pump', 'alternate', 'rotate', 'soft', 'checkpoint', 'six'],
        steelers: ['Steel curtain', 'rush', 'gust', 'deep', 'power', 'reverse', 'firm', 'checkpoint', 'repeat'],
        browns: ['Dawg Pound grind', 'return', 'ice', 'deep', 'power', 'pairs', 'firm', 'mirror', 'six'],
        bengals: ['Tiger-stripe switch', 'gates', 'steady', 'rhythm', 'alternate', 'mirror', 'firm', 'rotate', 'repeat'],
        texans: ['Space City launch', 'gates', 'accelerate', 'deep', 'power', 'rotate', 'firm', 'rotate', 'six'],
        colts: ['Horseshoe homecoming', 'return', 'steady', 'rhythm', 'patient', 'pairs', 'soft', 'mirror', 'repeat'],
        jaguars: ['Jungle ambush', 'rush', 'gust', 'pump', 'patient', 'pairs', 'gust', 'checkpoint', 'six'],
        titans: ['Titan strength', 'return', 'steady', 'deep', 'power', 'reverse', 'firm', 'mirror', 'repeat'],
        broncos: ['Mile High flight', 'ice', 'accelerate', 'deep', 'alternate', 'rotate', 'altitude', 'rotate', 'six'],
        chiefs: ['Arrowhead improvisation', 'rush', 'gust', 'pump', 'alternate', 'pairs', 'firm', 'rotate', 'repeat'],
        raiders: ['Black Hole heist', 'return', 'steady', 'pump', 'power', 'mirror', 'firm', 'checkpoint', 'six'],
        chargers: ['Bolt of acceleration', 'gates', 'accelerate', 'rhythm', 'patient', 'reverse', 'soft', 'rotate', 'repeat']
    };
    const descriptions = {
        game: {
            return: 'Carry each football back to the HOME end zone before collecting the next. A carry slows your stride.',
            gates: 'Collect the numbered footballs in order. The wrong football stays locked until its turn.',
            rush: 'A defender patrols across midfield after every move. Contact sends you back to HOME; your collected footballs stay safe.',
            ice: 'Slippery turf: every move slides 40 pixels. Use the boundaries to line up each pickup.'
        },
        kick: {
            gust: 'Crosswind gusts move the scoring window while the meter runs. Follow the live window, then kick.',
            steady: 'Precision kicking: the window shrinks each kick. The marker must cross midfield once before you can kick.',
            ice: 'An icy approach accelerates the marker on each sweep. Stop it in the narrow scoring window.',
            accelerate: 'A sprinting approach accelerates toward the far edge of the meter. Judge the changing speed.'
        },
        pocket: {
            pump: 'Pump fake once to a COVERED receiver before throwing to OPEN on every snap. Throwing OPEN before the fake loses a heart.',
            deep: 'Let the deep route develop: wait until the clock is at least half spent, then throw to OPEN. Early throws lose a heart.',
            rhythm: 'Follow the called receiver (1, then 2, then 3, repeating). Wait for that lane to open; a completion to another lane loses a heart.'
        },
        shove: {
            power: 'Power formation: accurate pushes gain extra inches but spend 40 energy. Three downs to reach 36 inches.',
            alternate: 'The snap window alternates between left and right after each push. Follow the window; rest still costs a down.',
            patient: 'The blocking gap drifts across the meter. Time your push to the moving gap rather than the center.'
        },
        recall: {
            reverse: 'Every third round reverses the call. Every other round repeats it in order.',
            mirror: 'Mirror audibles: on even rounds swap routes 1↔4 and 2↔3 while keeping their order.',
            rotate: 'Motion audible: on even rounds move the first demonstrated route to the END of your answer.',
            pairs: 'Switch audible: on even rounds swap adjacent routes in your answer (first with second, third with fourth).'
        },
        punt: {
            soft: 'Soft turf kills most of the roll. Use loft to pin the ball at 98 yards.',
            firm: 'Firm turf doubles the usual roll. Account for the bounce after the predicted landing.',
            frozen: 'Frozen turf triples the roll. Loft is your brake; a touchback still scores zero.',
            gust: 'Crosswinds have a larger effect on low punts. Loft reduces the wind drift.',
            altitude: 'Thin-air arcade rule: the ball travels 18% farther before bouncing. Bring the power down.'
        },
        blitz: {
            checkpoint: 'Collect the key square K before entering TD. The rusher still moves after every step.',
            mirror: 'The field is reflected from the standard formation. Read the blockers and the forecast before each move.',
            rotate: 'The field turns a quarter-turn between rounds. The goal and rush change direction with it.'
        },
        signal: {
            distinct: 'Decode three different plays in six attempts. EXACT counts correct slots; SHIFT counts other matching plays.',
            six: 'An extra play expands the codebook to SIX choices. Decode three different plays in six attempts.',
            repeat: 'Calls may REPEAT a play. Repeated matches are counted once per occurrence; decode all three slots in six attempts.'
        }
    };
    api.ruleFor = (id, teamId = api.team.id) => {
        if (id === 'game') return {theme: 'Touchdown Rush', variant: 'rush', description: 'Collect the football, then score in the right end zone. Defenders chase your position after every step and accelerate on burst turns. Use friendly blockers, collect the ball, and score with fewer steps for more bonus points and stars.'};
        const tuple = identities[teamId];
        const index = ['game', 'kick', 'pocket', 'shove', 'recall', 'punt', 'blitz', 'signal'].indexOf(id);
        return index < 0 ? null : {theme: tuple[0], variant: tuple[index + 1], description: descriptions[id][tuple[index + 1]]};
    };
    for (const game of api.games) {
        const rule = api.ruleFor(game.id);
        if (!rule) continue;
        game.description = `${rule.theme}. ${rule.description}`;
        api.personality.gameHooks[game.id] = game.description;
    }
})();
