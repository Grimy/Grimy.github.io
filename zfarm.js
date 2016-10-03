':' //; exec node "$0"

var max_ticks = 6048000; // One week

var biomes = {
	all: [.7, 1.3, 1.3, 1, .7, .8, 1.1],
	gardens: [.95, .95, 1, .8, 1.3, 1.1, 1.4],
	sea: [.9, 1.1, 1.1],
	mountain: [2, 1.4, 1.4],
	forest: [1.2, 1.5],
	depths: [1, .7, 1.4, .8],
};

Array.prototype.max = function() { return Math.max.apply(null, this) };

var seed = 42;
var max_rand = Math.pow(2, 31);
function rng() {
	seed ^= seed >> 11;
	seed ^= seed << 8;
	seed ^= seed >> 19;
	return seed;
}

// Converts a ratio (x1.15) into a percentage (+15%)
function percentage(ratio) {
	return ((ratio - 1) * 100).toFixed(1);
}

/*
function enemy_atk(zone, cell) {
	var amt = 5.5 * Math.sqrt(zone * Math.pow(3.27, zone)) - 1.1;
	amt *= zone < 60 ? (3.1875 + .0595 * cell) : (4 + .09 * cell) * Math.pow(1.15, zone - 59);
	return amt;
}
*/

// Compute the base HP (ignoring difficulty and imp modifiers) for an enemy
// at the given position (zone + cell).
function enemy_hp(zone, cell) {
	var amt = 14.3 * Math.sqrt(zone * Math.pow(3.265, zone)) - 12.1;
	amt *= zone < 60 ? (3 + (3 / 110) * cell) : (5 + .08 * cell) * Math.pow(1.1, zone - 59);
	return amt;
}

// Simulate farming at the given zone, and return the number of ticks it takes.
function simulate(zone, g) {
	var ticks = 0;
	var buff = 0;
	var ok_dmg = 0;

	for (var cell = 0; ticks < max_ticks; ++cell) {
		var imp = rng();
		var toughness = imp < g.import_chance ? 1 : g.biome[imp % g.biome.length];
		var hp = g.difficulty * toughness * enemy_hp(zone, cell % g.size);

		hp -= Math.min(ok_dmg, hp);
		for (var turns = 0; hp > 0; ++turns) {
			var crit = rng() < g.cc ? g.cd : 1;
			hp -= g.atk * (1 + g.range * rng()) * crit * (buff > ticks ? 2 : 1);
		}

		ok_dmg = -hp * g.overkill;
		ticks += (turns > 0) + (g.agility > 9) + Math.ceil(turns * g.agility);
		if (g.titimp && imp < .03 * max_rand)
			buff = Math.min(Math.max(ticks, buff) + 300, ticks + 450);
	}

	return cell;
}

// Computes looting efficiency based on the given game state.
function stats(g) {
	var max_os = 6;
	while (g.atk >= g.difficulty * g.biome.max() * enemy_hp(max_os + 1, g.size - 1))
		++max_os;

	return [0, 1, 2, 3].map((i) => max_os + i).map((zone) => ({
		zone: zone,
		cells: simulate(zone, g),
		loot: Math.pow(1.25, zone),
	}));
}

// When executing from the command-line
if (typeof window === 'undefined') {
	var start = Date.now();
	console.log(stats({
		agility: 10 * Math.pow(.95, 20),
		atk: 1e18,
		biome: biomes.all.concat(biomes['gardens']),
		cc: .5 * max_rand,
		cd: 5,
		difficulty: .84,
		import_chance: .15 * max_rand,
		overkill: 0,
		range: .2 / max_rand,
		size: 30,
		titimp: true,
	}));
	console.log(Date.now() - start);
}