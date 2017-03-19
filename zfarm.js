// 2>&-; exec node "$0" "$@"

// Copy these Math functions in our namespace
const {min, max, sqrt, pow, log, floor, round, ceil} = Math;

const max_ticks = 864000; // One day

const biomes = {
	all: [0.7, 1.3, 1.3, 1, 0.7, 0.8, 1.1],
	gardens: [0.95, 0.95, 1, 0.8, 1.3, 1.1, 1.4],
	sea: [0.9, 1.1, 1.1],
	mountain: [2, 1.4, 1.4],
	forest: [1.2, 1.5],
	depths: [1, 0.7, 1.4, 0.8],
	bionic: [1.5, 0.8, 1.2, 1.3, 1.5],
};

let seed = 42;
const max_rand = pow(2, 31);
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

// Base HP (before imp modifiers) for an enemy at the given position (zone + cell).
function enemy_hp(g, zone, cell) {
	let amt = 14.3 * sqrt(zone * pow(3.265, zone)) - 12.1;
	amt *= zone < 60 ? (3 + (3 / 110) * cell) : (5 + 0.08 * cell) * pow(1.1, zone - 59);
	if (g.zone >= 230)
		amt *= round(50 * pow(1.05, floor(g.zone / 6 - 25))) / 10;
	return g.difficulty * g.challenge * amt;
}

// Simulate farming at the given zone for a fixed time, and return the number cells cleared.
function simulate(zone, g, mult) {
	g.atk = g.attack * mult;
	let buff = 0;
	let ok_dmg = 0;
	let cell = 0;

	for (let ticks = 0; ticks < max_ticks; ++cell) {

		let imp, toughness;
		if (cell % g.size == 99) {
			imp = max_rand;
			toughness = 2.9;
		} else {
			imp = rng();
			toughness = imp < g.import_chance ? 1 : g.biome[imp % g.biome.length];
		}

		let hp = toughness * enemy_hp(g, zone, cell % g.size);
		if (cell % g.size !== 0)
			hp -= min(ok_dmg, hp);

		let turns = 0;
		while (hp > 0) {
			++turns;
			let crit = rng() < g.cc ? g.cd : 1;
			hp -= g.atk * (1 + g.range * rng()) * crit * (buff > ticks ? 2 : 1);
		}

		ok_dmg = -hp * g.overkill;
		ticks += (turns > 0) + (g.agility > 9) + ceil(turns * g.agility);
		if (g.titimp && imp < 0.03 * max_rand)
			buff = min(max(ticks, buff) + 300, ticks + 450);
	}

	return cell * 10 / max_ticks;
}

// Computes looting efficiency based on the given game state.
function stats(g) {
	let max_os = 6;
	while (g.attack >= max.apply(0, g.biome) * enemy_hp(g, max_os + 1, g.size - 1))
		++max_os;

	let results = {};
	let max_zone = max(g.zone - g.reducer, max_os);

	let speed;
	let value;
	let info;
	let nullBest = {stance: '', value: -1, zone_stats: {}};
	let bests = {best: nullBest, second: nullBest, byStance: {}};
	for (let zone = max_os; zone <= max_zone; ++zone) {
		let loot = pow(1.25, zone);
		let zone_stats = {loot: loot, stats: {}};

		if (g.zone < 70) {
			speed = simulate(zone, g, 1);
			value = speed * loot;
			zone_stats.stats['X'] = {speed: speed, value: value};
		} else {
			speed = simulate(zone, g, 4);
			value = speed * loot;
			zone_stats.stats['D'] = {speed: speed, value: value};

			if (g.scry) {
				speed = simulate(zone, g, 0.5);
				value = speed * 2 * loot;
				zone_stats.stats['S'] = {speed: speed, value: value};
			}
		}

		compareTo(zone_stats, bests);
		results['z' + zone] = zone_stats;
	}

	if (max_zone > 120 && max_zone % 15 >= 5 && g.biome.length == 14) {
		let bw = Object.assign({}, g);
		bw.size = 100;
		bw.difficulty = 2.6;
		bw.biome = biomes.all.concat(biomes.bionic);

		let zone = 5 + (max_zone - max_zone % 15);
		let loot = (300 / 180) * pow(1.25, zone);
		let zone_stats = {loot: loot, stats: {}};

		speed = simulate(zone, bw, 4);
		value = loot * speed;
		zone_stats.stats['D'] = {speed: speed, value: value};

		if (g.scry) {
			speed = simulate(zone, bw, 0.5);
			value = speed * 2 * loot;
			zone_stats.stats['S'] = {speed: speed, value: value};
		}

		compareTo(zone_stats, bests);
		results['BW' + zone] = zone_stats;
	}

	bests.best.zone_stats.stats[bests.best.stance].best = true;
	bests.second.zone_stats.stats[bests.second.stance].secondBest = true;
	for (let stance in bests.byStance) {
		bests.byStance[stance].zone_stats.stats[stance].stanceBest = true;
	}

	return results;
}

function compareTo(zone_stats, bests) {
	for (let stance in zone_stats.stats) {
		let value = zone_stats.stats[stance].value;

		if (value > bests.best.value) {
			bests.second = bests.best;
			bests.best = {stance: stance, value: value, zone_stats: zone_stats};
		} else if (value > bests.second.value) {
			bests.second = {stance: stance, value: value, zone_stats: zone_stats};
		}

		if (!bests.byStance[stance] || value > bests.byStance[stance].value) {
			bests.byStance[stance] = {value: value, zone_stats: zone_stats};
		}
	}
}

// When executing from the command-line
if (typeof window === 'undefined') {
	let start = Date.now();
	let infos = stats({
		agility: 10 * pow(0.95, 20),
		atk: 2.5e37,
		biome: biomes.all.concat(biomes.gardens),
		cc: 0.5 * max_rand,
		cd: 5,
		challenge: 1,
		difficulty: 0.84,
		import_chance: 0.15 * max_rand,
		overkill: 0,
		range: 0.2 / max_rand,
		reducer: false,
		size: 30,
		titimp: true,
		zone: 127,
	});
	for (let info of infos)
		info.value = info.cells * info.loot;
	infos.sort((a, b) => b.value - a.value);
	console.log(infos);
	console.log(Date.now() - start);
}
