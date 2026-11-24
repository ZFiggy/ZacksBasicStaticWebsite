/*
 * NFL team names/conferences: https://www.nfl.com/teams/
 * Division membership: https://www.nfl.com/standings/division/2026/REG
 * Verified November 2026. Colors are representative fan-art palettes, not brand specifications.
 * Mascot concepts, mottos, settings, and game titles below are original arcade artwork/copy.
 * They do not claim to be the teams' official mascots or slogans.
 */
(() => {
    const gameKeys = ['game', 'bird', 'search', 'kick', 'pocket', 'shove', 'recall', 'punt', 'blitz', 'signal'];
    const teams = [
        {
            id: 'eagles', name: 'Philadelphia Eagles', city: 'Philadelphia', nickname: 'Eagles', short: 'PHI', conference: 'NFC', division: 'East',
            primary: '#004c54', secondary: '#a5d4c4', ink: '#ffffff', symbol: '🦅', effects: 'feathers',
            mascot: 'A spirited silver-winged eagle in a midnight-green football jersey, carrying a football above a rowhouse skyline.',
            motto: 'Midnight green. All heart. Your home field.', setting: 'Silver wings above the Philly skyline, rowhouse rooftops, and stadium lights.',
            titles: ['Eagles Field Run', 'Barkley Bird', 'Where’s Jalen?', 'Liberty Bell Field Goals', 'Eagle Eye Pocket Read', 'Brotherly Shove', 'Midnight Green Route Recall', 'Delaware River Coffin Corner', 'South Philly Blitz Escape', 'Sideline Liberty Cipher']
        },
        {
            id: 'cowboys', name: 'Dallas Cowboys', city: 'Dallas', nickname: 'Cowboys', short: 'DAL', conference: 'NFC', division: 'East',
            primary: '#003594', secondary: '#b6bdc8', ink: '#ffffff', symbol: '⭐', effects: 'stars',
            mascot: 'A smiling silver-and-blue cowboy riding a tiny football-shaped rocket, with a large star on the hat.',
            motto: 'Big sky. Bright stars. Bigger plays.', setting: 'A blue-silver rodeo beneath a Texas night sky full of stars.',
            titles: ['Lone Star Field Run', 'Silver Star Skyride', 'Find the Lone Star Captain', 'Big D Star Kicks', 'Star Route Pocket Read', 'Texas Trail Push', 'Lasso Route Recall', 'Prairie Pin Punt', 'Rodeo Blitz Escape', 'Cowboy Sideline Cipher']
        },
        {
            id: 'giants', name: 'New York Giants', city: 'New York', nickname: 'Giants', short: 'NYG', conference: 'NFC', division: 'East',
            primary: '#0b2265', secondary: '#ff6475', ink: '#ffffff', symbol: '🏙️', effects: 'confetti',
            mascot: 'A friendly giant football guardian in blue and red standing beside miniature city skyscrapers.',
            motto: 'City-sized heart. Giant-sized game.', setting: 'Blue towers, red subway lights, and a pocket-sized New York skyline.',
            titles: ['Big Blue Field Run', 'Skyline Giant Flight', 'Find the Big Blue Captain', 'Uptown Upright Challenge', 'Big Apple Pocket Read', 'Giant Goal-Line Push', 'Subway Route Recall', 'Hudson River Pin Punt', 'Skyscraper Blitz Escape', 'Broadway Sideline Cipher']
        },
        {
            id: 'commanders', name: 'Washington Commanders', city: 'Washington', nickname: 'Commanders', short: 'WAS', conference: 'NFC', division: 'East',
            primary: '#5a1414', secondary: '#ffb612', ink: '#ffffff', symbol: '🛡️', effects: 'stars',
            mascot: 'A cheerful burgundy-and-gold football captain holding a shield and a rolled-up playbook.',
            motto: 'Burgundy resolve. Gold-standard plays.', setting: 'Burgundy banners, golden shields, and broad capital avenues.',
            titles: ['Capital Field Run', 'Burgundy Banner Flight', 'Find the Capital Captain', 'Monument Field Goals', 'Command Post Pocket Read', 'Capital Goal-Line Charge', 'Gold Standard Route Recall', 'Potomac Pin Punt', 'Beltway Blitz Escape', 'Command Center Cipher']
        },
        {
            id: 'bears', name: 'Chicago Bears', city: 'Chicago', nickname: 'Bears', short: 'CHI', conference: 'NFC', division: 'North',
            primary: '#0b162a', secondary: '#ff7b36', ink: '#ffffff', symbol: '🐻', effects: 'snow',
            mascot: 'A stocky navy bear in an orange scarf and football pads, bounding over a snowy lakefront.',
            motto: 'Lakefront grit. Every yard earned.', setting: 'A windy navy-and-orange Chicago lakefront with snowy stadium lights.',
            titles: ['Lakefront Bear Run', 'Windy City Bear Flight', 'Find the Lakefront Captain', 'Lake Wind Field Goals', 'Bear Den Pocket Read', 'Chicago Goal-Line Grind', 'Orange Line Route Recall', 'Lakefront Coffin Corner', 'Bear Claw Blitz Escape', 'Windy City Signal Cipher']
        },
        {
            id: 'lions', name: 'Detroit Lions', city: 'Detroit', nickname: 'Lions', short: 'DET', conference: 'NFC', division: 'North',
            primary: '#005a8b', secondary: '#c2d2dc', ink: '#ffffff', symbol: '🦁', effects: 'confetti',
            mascot: 'A bright-blue cartoon lion with a silver mane, football gloves, and a gear-shaped medallion.',
            motto: 'Motor City motion. Keep the pride rolling.', setting: 'Blue neon, silver gears, and Detroit factory rooftops under stadium lights.',
            titles: ['Motor City Field Run', 'Silver Mane Skybound', 'Find the Pride Captain', 'Motor City Uprights', 'Pride Pocket Read', 'Assembly Line Push', 'Gearshift Route Recall', 'Riverfront Pin Punt', 'Motor City Blitz Escape', 'Pride Sideline Cipher']
        },
        {
            id: 'packers', name: 'Green Bay Packers', city: 'Green Bay', nickname: 'Packers', short: 'GB', conference: 'NFC', division: 'North',
            primary: '#203731', secondary: '#ffb612', ink: '#ffffff', symbol: '🧀', effects: 'snow',
            mascot: 'A bundled-up green-and-gold football fan with a playful cheese-shaped helmet and snow boots.',
            motto: 'Frozen air. Warm hearts. Golden chances.', setting: 'Evergreen pines, gold scarves, and a snow-dusted Green Bay field.',
            titles: ['Frozen Field Run', 'Cheesehead Snow Flight', 'Find the Green Bay Captain', 'Frozen Upright Challenge', 'Tundra Pocket Read', 'Green Bay Goal-Line Push', 'Cheesehead Route Recall', 'Frozen Tundra Pin Punt', 'Lambeau Leap Blitz Escape', 'Green and Gold Cipher']
        },
        {
            id: 'vikings', name: 'Minnesota Vikings', city: 'Minnesota', nickname: 'Vikings', short: 'MIN', conference: 'NFC', division: 'North',
            primary: '#4f2683', secondary: '#ffc62f', ink: '#ffffff', symbol: '⛵', effects: 'snow',
            mascot: 'A friendly purple-and-gold Viking voyager with a football shield aboard a tiny dragon-prowed boat.',
            motto: 'Purple sails. Northern heart. Full speed.', setting: 'Purple northern skies, golden longships, and icy Minnesota lakes.',
            titles: ['North Star Field Run', 'Longship Sky Voyage', 'Find the Purple Captain', 'Northern Lights Field Goals', 'Longship Pocket Read', 'Shield Wall Goal-Line Push', 'Voyager Route Recall', 'Frozen Fjord Pin Punt', 'Northwind Blitz Escape', 'Runestone Sideline Cipher']
        },
        {
            id: 'falcons', name: 'Atlanta Falcons', city: 'Atlanta', nickname: 'Falcons', short: 'ATL', conference: 'NFC', division: 'South',
            primary: '#a71930', secondary: '#d3d3d3', ink: '#ffffff', symbol: '🦅', effects: 'feathers',
            mascot: 'A sleek red-and-black falcon with silver goggles banking over a stylized Atlanta skyline.',
            motto: 'Red wings. City speed. Find your opening.', setting: 'Red-lit Atlanta towers, silver flight trails, and fast-moving clouds.',
            titles: ['Atlanta Talon Run', 'Red Wing Skyline Flight', 'Find the Atlanta Captain', 'Peachtree Field Goals', 'Falcon Focus Pocket Read', 'Talon Goal-Line Drive', 'Peachtree Route Recall', 'Skyline Pin Punt', 'Red Zone Blitz Escape', 'Falcon Flight Cipher']
        },
        {
            id: 'panthers', name: 'Carolina Panthers', city: 'Carolina', nickname: 'Panthers', short: 'CAR', conference: 'NFC', division: 'South',
            primary: '#005f86', secondary: '#bfc0bf', ink: '#ffffff', symbol: '🐈‍⬛', effects: 'confetti',
            mascot: 'An electric-blue-eyed black panther in silver football pads, leaping between Carolina pine trees.',
            motto: 'Blue sparks. Quiet focus. Sudden speed.', setting: 'Carolina pines, electric-blue claw trails, and silver city lights.',
            titles: ['Carolina Claw Run', 'Blue Claw Night Flight', 'Find the Carolina Captain', 'Queen City Field Goals', 'Panther Prowl Pocket Read', 'Carolina Claw Push', 'Pine Trail Route Recall', 'Carolina Corner Punt', 'Panther Leap Blitz Escape', 'Blue Claw Sideline Cipher']
        },
        {
            id: 'saints', name: 'New Orleans Saints', city: 'New Orleans', nickname: 'Saints', short: 'NO', conference: 'NFC', division: 'South',
            primary: '#1d1d1b', secondary: '#d3bc8d', ink: '#ffffff', symbol: '🎺', effects: 'confetti',
            mascot: 'A gold-and-black jazz-band football captain carrying a trumpet and a football beneath parade ribbons.',
            motto: 'Golden rhythm. Crescent City game.', setting: 'Golden parade ribbons, French Quarter balconies, and black-and-gold jazz lights.',
            titles: ['Crescent City Field Run', 'Jazz Parade Skyride', 'Find the Crescent Captain', 'Brass Band Field Goals', 'Crescent Pocket Read', 'Second Line Goal Push', 'Jazz Route Recall', 'Bayou Coffin Corner', 'Bourbon Street Blitz Escape', 'Brass Section Signal Cipher']
        },
        {
            id: 'buccaneers', name: 'Tampa Bay Buccaneers', city: 'Tampa Bay', nickname: 'Buccaneers', short: 'TB', conference: 'NFC', division: 'South',
            primary: '#a71930', secondary: '#ffb25b', ink: '#ffffff', symbol: '🏴‍☠️', effects: 'fire',
            mascot: 'A jovial red-coated pirate football captain with a pewter helmet and a tiny ship-shaped glider.',
            motto: 'Red sails. Bold calls. Claim the end zone.', setting: 'Red pirate sails, pewter cannons, and a sunlit Tampa Bay harbor.',
            titles: ['Pirate Field Plunder', 'Red Sail Skyraid', 'Find the Pirate Captain', 'Cannonball Field Goals', 'Crow’s Nest Pocket Read', 'Boarding Party Goal Push', 'Treasure Map Route Recall', 'Harbor Pin Punt', 'Pirate Cove Blitz Escape', 'Captain’s Secret Cipher']
        },
        {
            id: 'cardinals', name: 'Arizona Cardinals', city: 'Arizona', nickname: 'Cardinals', short: 'ARI', conference: 'NFC', division: 'West',
            primary: '#97233f', secondary: '#ffb612', ink: '#ffffff', symbol: '🐦', effects: 'feathers',
            mascot: 'A bright red cardinal in gold football cleats soaring over orange desert mesas and saguaro cacti.',
            motto: 'Desert heat. Red wings. Open skies.', setting: 'Arizona red-rock mesas, saguaro silhouettes, and gold desert sunsets.',
            titles: ['Red Rock Field Run', 'Desert Cardinal Flight', 'Find the Desert Captain', 'Cactus Country Field Goals', 'Desert Eye Pocket Read', 'Red Rock Goal-Line Push', 'Canyon Route Recall', 'Desert Edge Pin Punt', 'Saguaro Blitz Escape', 'Red Bird Signal Cipher']
        },
        {
            id: 'rams', name: 'Los Angeles Rams', city: 'Los Angeles', nickname: 'Rams', short: 'LAR', conference: 'NFC', division: 'West',
            primary: '#003594', secondary: '#ffd100', ink: '#ffffff', symbol: '🐏', effects: 'stars',
            mascot: 'A royal-blue ram with curling golden horns and football wristbands leaping through a sunny film-set arch.',
            motto: 'Royal blue. Golden horns. Main-event plays.', setting: 'Golden California sunlight, royal-blue arches, and Los Angeles movie lights.',
            titles: ['Royal Horn Field Run', 'Golden Horn Sky Leap', 'Find the Royal Captain', 'Hollywood Field Goals', 'Golden Horn Pocket Read', 'Ram Charge Goal Push', 'Studio Route Recall', 'Pacific Pin Punt', 'Hollywood Blitz Escape', 'Director’s Sideline Cipher']
        },
        {
            id: '49ers', name: 'San Francisco 49ers', city: 'San Francisco', nickname: '49ers', short: 'SF', conference: 'NFC', division: 'West',
            primary: '#aa0000', secondary: '#e0bf79', ink: '#ffffff', symbol: '⛏️', effects: 'stars',
            mascot: 'A cheerful gold-rush prospector in a red football jersey with a golden helmet and a football-shaped nugget.',
            motto: 'Red resolve. Golden opportunity. Strike a play.', setting: 'Golden bridge cables, red city hills, and sparkling gold-rush trails.',
            titles: ['Gold Rush Field Run', 'Golden Gate Skyride', 'Find the Gold Rush Captain', 'Golden Gate Field Goals', 'Gold Rush Pocket Read', 'Nugget Goal-Line Drive', 'Cable Car Route Recall', 'Bay Fog Pin Punt', 'Gold Country Blitz Escape', 'Prospector Sideline Cipher']
        },
        {
            id: 'seahawks', name: 'Seattle Seahawks', city: 'Seattle', nickname: 'Seahawks', short: 'SEA', conference: 'NFC', division: 'West',
            primary: '#002244', secondary: '#69be28', ink: '#ffffff', symbol: '🦅', effects: 'feathers',
            mascot: 'A navy sea hawk with bright green feather tips and silver football goggles swooping past evergreen trees.',
            motto: 'Evergreen energy. Loud skies. Take flight.', setting: 'Seattle rain, navy mountain silhouettes, evergreen forests, and neon-green flight trails.',
            titles: ['Evergreen Field Run', 'Emerald Sky Hawk Flight', 'Find the Emerald Captain', 'Rain City Field Goals', 'Hawk Vision Pocket Read', 'Evergreen Goal-Line Push', 'Sound Route Recall', 'Puget Sound Pin Punt', 'Rain City Blitz Escape', 'Emerald Sideline Cipher']
        },
        {
            id: 'bills', name: 'Buffalo Bills', city: 'Buffalo', nickname: 'Bills', short: 'BUF', conference: 'AFC', division: 'East',
            primary: '#00338d', secondary: '#ff5a66', ink: '#ffffff', symbol: '🦬', effects: 'snow',
            mascot: 'A royal-blue bison with a red scarf and white football gloves charging through a swirl of lake-effect snow.',
            motto: 'Blue thunder. Snowy skies. Charge together.', setting: 'Buffalo snowbanks, blue stadium lights, and red charging trails.',
            titles: ['Buffalo Stampede Run', 'Lake Effect Bison Flight', 'Find the Buffalo Captain', 'Snowbelt Field Goals', 'Bison Vision Pocket Read', 'Buffalo Snowplow Push', 'Snow Trail Route Recall', 'Lake Effect Pin Punt', 'Stampede Blitz Escape', 'Buffalo Sideline Cipher']
        },
        {
            id: 'dolphins', name: 'Miami Dolphins', city: 'Miami', nickname: 'Dolphins', short: 'MIA', conference: 'AFC', division: 'East',
            primary: '#006c72', secondary: '#ff9248', ink: '#ffffff', symbol: '🐬', effects: 'waves',
            mascot: 'An aqua dolphin with orange sunglasses and a football tucked under one fin, leaping above tropical waves.',
            motto: 'Aqua waves. Orange skies. Make a splash.', setting: 'Miami palms, turquoise surf, orange sunsets, and bright beachside stadium lights.',
            titles: ['Aqua Surf Field Run', 'Dolphin Wave Flight', 'Find the Miami Captain', 'Sunshine Field Goals', 'Dolphin Vision Pocket Read', 'Tidal Goal-Line Push', 'Ocean Route Recall', 'South Beach Pin Punt', 'Aqua Wave Blitz Escape', 'Sunset Sideline Cipher']
        },
        {
            id: 'patriots', name: 'New England Patriots', city: 'New England', nickname: 'Patriots', short: 'NE', conference: 'AFC', division: 'East',
            primary: '#002244', secondary: '#ff6373', ink: '#ffffff', symbol: '🎩', effects: 'stars',
            mascot: 'A navy-and-red football captain with a silver tricorn-style helmet and a star-spangled scarf.',
            motto: 'New England focus. Every snap has a plan.', setting: 'Silver harbor stars, navy coastal rooftops, and red autumn leaves.',
            titles: ['New England Field Run', 'Harbor Star Skyride', 'Find the New England Captain', 'Harbor Lights Field Goals', 'Patriot Pocket Read', 'New England Goal-Line Drive', 'Harbor Route Recall', 'Atlantic Edge Pin Punt', 'Foxborough Blitz Escape', 'Midnight Ride Signal Cipher']
        },
        {
            id: 'jets', name: 'New York Jets', city: 'New York', nickname: 'Jets', short: 'NYJ', conference: 'AFC', division: 'East',
            primary: '#125740', secondary: '#d5e4df', ink: '#ffffff', symbol: '✈️', effects: 'confetti',
            mascot: 'A bright-green cartoon jet pilot with a white football helmet and a football-shaped miniature airplane.',
            motto: 'Green lights. Clear skies. Ready for takeoff.', setting: 'Green runway lights, white jet trails, and a city skyline beyond the hangar.',
            titles: ['Green Runway Field Run', 'Jetstream Sky Flight', 'Find the Flight Captain', 'Runway Field Goals', 'Jet Radar Pocket Read', 'Afterburner Goal-Line Push', 'Flight Plan Route Recall', 'Runway Edge Pin Punt', 'Jetstream Blitz Escape', 'Control Tower Signal Cipher']
        },
        {
            id: 'ravens', name: 'Baltimore Ravens', city: 'Baltimore', nickname: 'Ravens', short: 'BAL', conference: 'AFC', division: 'North',
            primary: '#24135f', secondary: '#e2c46d', ink: '#ffffff', symbol: '🐦‍⬛', effects: 'feathers',
            mascot: 'A purple-and-black raven in gold football goggles with a dramatic cape of feathers.',
            motto: 'Purple shadows. Golden chances. Own the night.', setting: 'Baltimore brick towers, moonlit harbor water, and swirling purple feathers.',
            titles: ['Purple Talon Field Run', 'Midnight Raven Flight', 'Find the Baltimore Captain', 'Harbor Moon Field Goals', 'Raven Eye Pocket Read', 'Purple Wall Goal Push', 'Night Wing Route Recall', 'Inner Harbor Pin Punt', 'Raven Shadow Blitz Escape', 'Night Watch Signal Cipher']
        },
        {
            id: 'bengals', name: 'Cincinnati Bengals', city: 'Cincinnati', nickname: 'Bengals', short: 'CIN', conference: 'AFC', division: 'North',
            primary: '#a83c00', secondary: '#ffb267', ink: '#ffffff', symbol: '🐅', effects: 'fire',
            mascot: 'A grinning orange tiger with bold black stripes, football pads, and a long curling striped tail.',
            motto: 'Orange fire. Sharp stripes. Pounce on the play.', setting: 'Cincinnati river bridges, orange stadium glow, and black tiger-stripe trails.',
            titles: ['Jungle Stripe Field Run', 'Tiger Stripe Sky Leap', 'Find the Jungle Captain', 'Queen City Stripe Kicks', 'Tiger Eye Pocket Read', 'Jungle Goal-Line Pounce', 'Stripe Trail Route Recall', 'Ohio River Pin Punt', 'Tiger Prowl Blitz Escape', 'Jungle Sideline Cipher']
        },
        {
            id: 'browns', name: 'Cleveland Browns', city: 'Cleveland', nickname: 'Browns', short: 'CLE', conference: 'AFC', division: 'North',
            primary: '#311d00', secondary: '#ff8b3d', ink: '#ffffff', symbol: '🐕', effects: 'confetti',
            mascot: 'A sturdy brown bulldog wearing an orange football helmet and a white-and-brown scarf.',
            motto: 'Orange helmets. Lakefront heart. Keep digging.', setting: 'Cleveland lakefront brickwork, orange helmets, and a lively bulldog fan section.',
            titles: ['Dawg Yard Field Run', 'Orange Helmet Skyride', 'Find the Cleveland Captain', 'Lake Erie Field Goals', 'Dawg Vision Pocket Read', 'Dawg Pile Goal Push', 'Orange Route Recall', 'Lake Erie Pin Punt', 'Dawg Yard Blitz Escape', 'Orange Helmet Signal Cipher']
        },
        {
            id: 'steelers', name: 'Pittsburgh Steelers', city: 'Pittsburgh', nickname: 'Steelers', short: 'PIT', conference: 'AFC', division: 'North',
            primary: '#171717', secondary: '#ffb612', ink: '#ffffff', symbol: '⚙️', effects: 'stars',
            mascot: 'A friendly steelworker robot in black-and-gold football pads carrying a small gold rally towel.',
            motto: 'Black and gold. Steel resolve. Built for this.', setting: 'Pittsburgh golden bridges, steel beams, and waving gold rally towels.',
            titles: ['Steel City Field Run', 'Golden Towel Skyride', 'Find the Steel City Captain', 'Three Rivers Field Goals', 'Steel Pocket Read', 'Iron Wall Goal-Line Push', 'Bridge Route Recall', 'Three Rivers Pin Punt', 'Steel Curtain Blitz Escape', 'Foundry Sideline Cipher']
        },
        {
            id: 'texans', name: 'Houston Texans', city: 'Houston', nickname: 'Texans', short: 'HOU', conference: 'AFC', division: 'South',
            primary: '#03202f', secondary: '#ff5367', ink: '#ffffff', symbol: '🐂', effects: 'stars',
            mascot: 'A powerful navy bull with red-and-white football horns and a star-shaped helmet badge.',
            motto: 'Houston heart. Bull-sized drive. Launch the play.', setting: 'Houston space-city lights, navy skies, red stars, and charging bull trails.',
            titles: ['Space City Bull Run', 'Houston Star Flight', 'Find the Houston Captain', 'Space City Field Goals', 'Bullseye Pocket Read', 'Houston Goal-Line Stampede', 'Orbit Route Recall', 'Mission Control Pin Punt', 'Space City Blitz Escape', 'Launch Code Sideline Cipher']
        },
        {
            id: 'colts', name: 'Indianapolis Colts', city: 'Indianapolis', nickname: 'Colts', short: 'IND', conference: 'AFC', division: 'South',
            primary: '#002c5f', secondary: '#c3d2e0', ink: '#ffffff', symbol: '🐎', effects: 'stars',
            mascot: 'A royal-blue colt with a white mane, football cleats, and a silver horseshoe-shaped harness.',
            motto: 'Blue speed. Lucky breaks. Run your race.', setting: 'Indianapolis racing stripes, blue horseshoe arches, and silver stadium lights.',
            titles: ['Horseshoe Field Run', 'Blue Colt Sky Gallop', 'Find the Indy Captain', 'Horseshoe Field Goals', 'Horseshoe Pocket Read', 'Blue Stampede Goal Push', 'Speedway Route Recall', 'Hoosier Pin Punt', 'Blue Hoof Blitz Escape', 'Horseshoe Sideline Cipher']
        },
        {
            id: 'jaguars', name: 'Jacksonville Jaguars', city: 'Jacksonville', nickname: 'Jaguars', short: 'JAX', conference: 'AFC', division: 'South',
            primary: '#006778', secondary: '#e5ba75', ink: '#ffffff', symbol: '🐆', effects: 'waves',
            mascot: 'A golden spotted jaguar in a teal football jersey leaping over river waves with a broad grin.',
            motto: 'Teal tides. Golden paws. Leap into game day.', setting: 'Jacksonville river bridges, teal water, golden pawprints, and coastal palms.',
            titles: ['River City Jaguar Run', 'Teal Tide Sky Pounce', 'Find the Jacksonville Captain', 'River City Field Goals', 'Jaguar Vision Pocket Read', 'Teal Tide Goal Push', 'Spotted Route Recall', 'Riverbank Pin Punt', 'Jaguar Pounce Blitz Escape', 'River City Signal Cipher']
        },
        {
            id: 'titans', name: 'Tennessee Titans', city: 'Tennessee', nickname: 'Titans', short: 'TEN', conference: 'AFC', division: 'South',
            primary: '#0c2340', secondary: '#75b9e8', ink: '#ffffff', symbol: '⚔️', effects: 'fire',
            mascot: 'A friendly navy-and-sky-blue armored titan carrying a football shield with three glowing stars.',
            motto: 'Titan-sized heart. Tennessee-wide energy.', setting: 'Nashville riverfront lights, blue flame trails, and three-star sky patterns.',
            titles: ['Titan Field March', 'Blue Flame Skyride', 'Find the Tennessee Captain', 'Music City Field Goals', 'Titan Vision Pocket Read', 'Titan Wall Goal Push', 'Three Star Route Recall', 'Cumberland Pin Punt', 'Blue Flame Blitz Escape', 'Titan Sideline Cipher']
        },
        {
            id: 'broncos', name: 'Denver Broncos', city: 'Denver', nickname: 'Broncos', short: 'DEN', conference: 'AFC', division: 'West',
            primary: '#002244', secondary: '#ff8a42', ink: '#ffffff', symbol: '🐎', effects: 'snow',
            mascot: 'An energetic white bronco with an orange mane and navy football pads jumping over mountain peaks.',
            motto: 'High altitude. Orange energy. Clear the next peak.', setting: 'Denver mountain silhouettes, orange sunsets, snowcaps, and navy stadium lights.',
            titles: ['Mile High Field Run', 'Orange Mane Mountain Flight', 'Find the Mile High Captain', 'Mile High Field Goals', 'Mountain View Pocket Read', 'Rocky Mountain Goal Push', 'Summit Route Recall', 'Alpine Edge Pin Punt', 'Mile High Blitz Escape', 'Mountain Signal Cipher']
        },
        {
            id: 'chiefs', name: 'Kansas City Chiefs', city: 'Kansas City', nickname: 'Chiefs', short: 'KC', conference: 'AFC', division: 'West',
            primary: '#a71930', secondary: '#ffce55', ink: '#ffffff', symbol: '🐺', effects: 'fire',
            mascot: 'A friendly red-and-gold football wolf with oversized gloves and a golden captain’s scarf.',
            motto: 'Red heart. Golden roar. Keep the drive alive.', setting: 'Kansas City fountains, red stadium banners, and bright golden football trails.',
            titles: ['Red Kingdom Field Run', 'Golden Wolf Sky Leap', 'Find the Kansas City Captain', 'Fountain City Field Goals', 'Red Zone Pocket Read', 'Kingdom Goal-Line Drive', 'Golden Route Recall', 'Heartland Pin Punt', 'Red Kingdom Blitz Escape', 'Kingdom Sideline Cipher']
        },
        {
            id: 'raiders', name: 'Las Vegas Raiders', city: 'Las Vegas', nickname: 'Raiders', short: 'LV', conference: 'AFC', division: 'West',
            primary: '#101010', secondary: '#c4c8cc', ink: '#ffffff', symbol: '🏴‍☠️', effects: 'stars',
            mascot: 'A silver-and-black cartoon adventurer with a football helmet, an eye patch, and a starry black cape.',
            motto: 'Silver night. Black skies. Bold escapes.', setting: 'Las Vegas silver neon, black desert skies, and shimmering stadium spotlights.',
            titles: ['Silver Desert Field Run', 'Black Sky Raider Flight', 'Find the Silver Captain', 'Neon Night Field Goals', 'Silver Shield Pocket Read', 'Black and Silver Goal Push', 'Neon Route Recall', 'Desert Night Pin Punt', 'Silver Shadow Blitz Escape', 'Neon Sideline Cipher']
        },
        {
            id: 'chargers', name: 'Los Angeles Chargers', city: 'Los Angeles', nickname: 'Chargers', short: 'LAC', conference: 'AFC', division: 'West',
            primary: '#005c91', secondary: '#ffd644', ink: '#ffffff', symbol: '⚡', effects: 'bolts',
            mascot: 'A powder-blue lightning runner with golden bolt-shaped boots and a white football helmet.',
            motto: 'Powder blue. Golden sparks. Charge the field.', setting: 'Los Angeles palm trees, powder-blue skies, and golden lightning trails.',
            titles: ['Lightning Bolt Field Run', 'Powder Blue Bolt Flight', 'Find the Lightning Captain', 'Electric Field Goals', 'Bolt Vision Pocket Read', 'Lightning Goal-Line Surge', 'Circuit Route Recall', 'Pacific Bolt Pin Punt', 'High Voltage Blitz Escape', 'Lightning Sideline Cipher']
        }
    ];
    window.NFL_TEAMS = teams.map(({ titles, ...team }) => ({
        ...team,
        games: Object.fromEntries(gameKeys.map((key, index) => [key, titles[index]]))
    }));
})();
