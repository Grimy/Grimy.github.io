// 2>&-; exec node "$0"

var max_ticks = 6048000; // One week

var biomes = {
	all: [0.7, 1.3, 1.3, 1, 0.7, 0.8, 1.1],
	gardens: [0.95, 0.95, 1, 0.8, 1.3, 1.1, 1.4],
	sea: [0.9, 1.1, 1.1],
	mountain: [2, 1.4, 1.4],
	forest: [1.2, 1.5],
	depths: [1, 0.7, 1.4, 0.8],
	bionic: [1.5, 0.8, 1.2, 1.3, 1.5],
};

Array.prototype.max = function() { return Math.max.apply(null, this); };

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

// Base HP (before imp modifiers) for an enemy
// at the given position (zone + cell).
function enemy_hp(g, zone, cell) {
	var amt = 14.3 * Math.sqrt(zone * Math.pow(3.265, zone)) - 12.1;
	amt *= zone < 60 ? (3 + (3 / 110) * cell) : (5 + 0.08 * cell) * Math.pow(1.1, zone - 59);
	if (g.zone >= 230)
		amt *= Math.round(50 * Math.pow(1.05, Math.floor(g.zone / 6 - 25))) / 10
	return g.difficulty * g.challenge * amt;
}

// Simulate farming at the given zone for a fixed time, and return the number cells cleared.
function simulate(zone, g) {
	var ticks = 0;
	var buff = 0;
	var ok_dmg = 0;

	for (var cell = 0; ticks < max_ticks; ++cell) {
		var imp, toughness;
		if (cell % g.size == 99) {
			imp = max_rand;
			toughness = 2.9;
		} else {
			imp = rng();
			toughness = imp < g.import_chance ? 1 : g.biome[imp % g.biome.length];
		}
		var hp = toughness * enemy_hp(g, zone, cell % g.size);

		if (cell % g.size !== 0)
			hp -= Math.min(ok_dmg, hp);

		for (var turns = 0; hp > 0; ++turns) {
			var crit = rng() < g.cc ? g.cd : 1;
			hp -= g.atk * (1 + g.range * rng()) * crit * (buff > ticks ? 2 : 1);
		}

		ok_dmg = -hp * g.overkill;
		ticks += (turns > 0) + (g.agility > 9) + Math.ceil(turns * g.agility);
		if (g.titimp && imp < 0.03 * max_rand)
			buff = Math.min(Math.max(ticks, buff) + 300, ticks + 450);
	}

	return cell;
}

// Computes looting efficiency based on the given game state.
function stats(g) {
	console.log(g);
	var max_os = 6;
	while (g.atk >= g.biome.max() * enemy_hp(g, max_os + 1, g.size - 1))
		++max_os;

	var result = [];
	for (let zone = max_os; zone <= g.zone || zone <= max_os; ++zone) {
		result.push({
			zone: 'z' + zone,
			cells: simulate(zone, g),
			loot: Math.pow(1.25, zone) * g.looting,
		});
	}

	if (g.zone >= 120 && max_os % 15 < 8 && g.biome.length == 14) {
		let zone = 5 + (max_os - max_os % 15);
		var loot = (300 / 180) * Math.pow(1.25, zone) * g.looting;
		g.size = 100;
		g.biome = biomes.all.concat(biomes.bionic);
		g.difficulty = 2.6;
		var cells = simulate(zone, g);
		result.push({zone: 'BW' + zone, cells, loot});
	}

	return result;
}

// When executing from the command-line
if (typeof window === 'undefined') {
	var start = Date.now();
	var infos = stats({
		agility: 10 * Math.pow(0.95, 20),
		atk: 2.5e37,
		biome: biomes.all.concat(biomes.gardens),
		cc: 0.5 * max_rand,
		cd: 5,
		difficulty: 0.84,
		import_chance: 0.15 * max_rand,
		overkill: 0,
		range: 0.2 / max_rand,
		size: 30,
		titimp: true,
	});
	for (let info of infos)
		info.value = info.cells * info.loot;
	infos.sort((a, b) => b.value - a.value);
	console.log(infos);
	console.log(Date.now() - start);
}
