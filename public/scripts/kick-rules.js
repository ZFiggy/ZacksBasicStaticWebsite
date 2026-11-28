// Shared, deterministic field goal physics. Distances are arcade yards.
(() => {
    const trajectories = {
        drive: {label: 'Drive', range: 1.08, clearance: 0.42},
        balanced: {label: 'Balanced', range: 1, clearance: 0.75},
        high: {label: 'High arc', range: 0.86, clearance: 1.05}
    };
    const distanceFor = attempt => [25, 33, 40, 47, 55][attempt];
    const protectionFor = attempt => 5.6 - attempt * 0.25;
    function rivalFor(teams, team, rushRival) {
        return teams.find(other => other.conference === team.conference && other.division === team.division && other.id !== team.id && other.id !== rushRival);
    }
    const hashBias = (distance, hash = 0) => Math.atan(hash * (18.5 / 6) / distance) / 0.25;
    // Source: https://operations.nfl.com/rules-officiating/nfl-football-basics/football-terms
    // Official NFL hashes are 18 ft 6 in apart, the same width as the uprights.
    const openingFor = distance => Math.atan((18.5 / 6 - 0.16) / distance) / 0.25;
    function situations(random = Math.random) {
        const hashes = random() < 0.5 ? [-1, 0, 1, -1, 1] : [1, -1, 0, 1, -1];
        const shift = Math.min(2, Math.floor(random() * 3));
        return hashes.map((hash, i) => ({
            hash, distance: distanceFor(i), rush: [-1, 0, 1][(i + shift) % 3],
            gust: [0, 0.09, 0.14, 0.05, 0.11][i], phase: random() * Math.PI * 2,
            headwind: [0, 0, 0.06, -0.04, 0.08][i],
            label: ['Settle in', 'Shifting crosswind', 'Headwind & edge rush', 'Tailwind opportunity', 'Long-range pressure'][i]
        }));
    }
    const rangeFor = (power, loft, headwind = 0) => (18 + power * 52) * trajectories[loft].range * (1 - headwind);
    const windAt = (situation, base, time) => base + (situation?.gust || 0) * Math.sin(time * 1.8 + (situation?.phase || 0));
    const protectionBonus = (situation, lane) => situation?.rush === lane ? 0.75 : -0.2;
    function resolve({distance, hash = 0, power, aim, accuracy = 0, wind, loft, release, protection, headwind = 0}) {
        const trajectory = trajectories[loft];
        const range = rangeFor(power, loft, headwind);
        const offset = aim + hashBias(distance, hash) + accuracy * 1.6 + wind * (loft === 'high' ? 1.5 : 1);
        const clearance = trajectory.clearance + power * 0.2 - (release / protection) * 0.5;
        const blocked = release >= protection || clearance < 0.32;
        const outcome = blocked ? 'blocked' : range < Math.hypot(distance, hash * (18.5 / 6)) ? 'short' : Math.abs(offset) > openingFor(distance) ? (offset < 0 ? 'left' : 'right') : 'good';
        return {outcome, range, offset, clearance};
    }
    const rules = {trajectories, distanceFor, protectionFor, rivalFor, resolve, hashBias, openingFor, situations, rangeFor, windAt, protectionBonus};
    if (typeof module !== 'undefined') module.exports = rules;
    else window.fieldGoalRules = rules;
})();
