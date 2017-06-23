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
function simulate(zone, g) {
	let titimp = 0;
	let ok_dmg = 0;
	let cell = 0;
	let poison = 0;
	let ice = 0;

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
			let damage = g.atk * (1 + g.range * rng());
			damage *= rng() < g.cc ? g.cd : 1;
			damage *= titimp > ticks ? 2 : 1;
			damage *= 2 - pow(0.99, g.ice * ice);
			hp -= poison + damage;
			ice += g.ice ? 1 : 0;
			poison += g.poison * damage;
		}

		ok_dmg = -hp * g.overkill;
		ticks += (turns > 0) + (g.agility > 9) + ceil(turns * g.agility);
		if (g.titimp && imp < 0.03 * max_rand)
			titimp = min(max(ticks, titimp) + 300, ticks + 450);

		poison = ceil(g.transfer * poison);
		ice = ceil(g.transfer * ice);
	}

	return cell * 10 / max_ticks;
}

function info(prefix, zone, loot, stances, g) {
	result = { zone: prefix + zone, loot: loot * pow(1.25, zone), value: 0 };

	for (let stance of stances) {
		g.atk = g.attack * ({ X: 1, D: 4, S: 0.5 })[stance];
		let speed = simulate(zone, g);
		let value = speed * result.loot * ({ X: 1, D: 1, S: 2 })[stance];
		result[stance] = { speed, value };

		if (value > result.value) {
			result.value = value;
			result.stance = stance;
		}
	}

	return result;
}

// Computes looting efficiency based on the given game state.
function stats(g) {
	let max_os = 6;
	while (g.attack >= max.apply(0, g.biome) * enemy_hp(g, max_os + 1, g.size - 1))
		++max_os;

	let stats = [];
	let max_zone = min(max_os + 15, max(g.zone - g.reducer, max_os));
	let stances = (g.zone < 70 ? 'X' : 'D') + (g.scry && g.zone >= 60 ? 'S' : '');

	for (let zone = max_os; zone <= max_zone; ++zone) {
		stats.push(info('z', zone, 1, stances, g));
	}

	if (max_zone > 120 && max_zone % 15 >= 5 && g.biome.length == 14) {
		let bw = Object.assign({}, g);
		bw.size = 100;
		bw.difficulty = 2.6;
		bw.biome = biomes.all.concat(biomes.bionic);
		let zone = 5 + (max_zone - max_zone % 15);
		stats.push(info('BW', zone, 300 / 180, stances, bw));
	}

	let best = {};
	let copy = stats.slice();

	/* jshint loopfunc:true */
	for (let stance of stances) {
		copy.sort((a, b) => b[stance].value - a[stance].value);
		best[stance] = copy[0].zone;
	}

	copy.sort((a, b) => b.value - a.value);
	best.overall = copy[0].zone;
	best.stance = copy[0].stance;
	if (copy[1]) {
		best.second = copy[1].zone;
		best.second_stance = copy[1].stance;
		best.ratio = copy[0].value / copy[1].value;
	}

	return [stances, stats, best];
}

function compareTo(zone_stats, bests) {
	for (let stance in zone_stats) {
		let value = zone_stats[stance].value;

		if (!bests.best || value > bests.best.value) {
			bests.second = bests.best;
			bests.best = {stance: stance, value: value, zone_stats: zone_stats};
		} else if (!bests.second || value > bests.second.value) {
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
		attack: 2.5e37,
		biome: biomes.all.concat(biomes.gardens),
		cc: 0.5 * max_rand,
		cd: 5,
		challenge: 1,
		difficulty: 0.84,
		import_chance: 0.15 * max_rand,
		overkill: 0,
		range: 0.2 / max_rand,
		reducer: true,
		scry: true,
		size: 30,
		titimp: true,
		zone: 127,
		poison: 0,
		ice: 0,
		transfer: 0.01,
	});
	console.log(infos);
	console.log(Date.now() - start);
}
