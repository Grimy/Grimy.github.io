const max_ticks = 864000; // One day

const biomes = {
	all: [0.7, 1.3, 1.3, 1, 0.7, 0.8, 1.1],
	gardens: [0.95, 0.95, 1, 0.8, 1.3, 1.1, 1.4],
	sea: [0.9, 1.1, 1.1],
	mountain: [2, 1.4, 1.4],
	forest: [1.2, 1.5],
	depths: [1, 0.7, 1.4, 0.8],
};

let seed = 42;
const max_rand = pow(2, 31);
function rng() {
	seed ^= seed >> 11;
	seed ^= seed << 8;
	seed ^= seed >> 19;
	return seed;
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
	let loot = 0;
	let poison = 0, wind = 0, ice = 0;

	for (let ticks = 0; ticks < max_ticks; ++cell) {

		let imp, toughness;
		if (cell % g.size === 99) {
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
			damage *= 2 - pow(0.366, ice * g.ice);
			hp -= damage + poison * g.poison;
			poison += damage;
			++ice;
		}

		wind = min(wind + turns, 200);
		loot += 1 + wind * g.wind;
		ok_dmg = -hp * g.overkill;
		ticks += (turns > 0) + (g.speed > 9) + ceil(turns * g.speed);
		if (g.titimp && imp < 0.03 * max_rand)
			titimp = min(max(ticks, titimp) + 300, ticks + 450);

		poison = ceil(g.transfer * poison) + 1;
		wind = ceil(g.transfer * wind) + 1;
		ice = ceil(g.transfer * ice) + 1;
	}

	return loot * 10 / max_ticks;
}

// Return efficiency stats for the given zone
function zone_stats(zone, stances, g) {
	result = { zone: 'z' + zone, loot: pow(1.25, zone), value: 0 };

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

// Return a list of efficiency stats for all sensible zones
function stats(g) {
	let stats = [];
	let stances = (g.zone < 70 ? 'X' : 'D') + (g.scry && g.zone >= 60 ? 'S' : '');

	for (let zone = 1; zone <= g.zone - g.reducer || !stats.length; ++zone) {
		let ratio = g.attack / (max.apply(0, g.biome) * enemy_hp(g, zone, g.size - 1));
		if (ratio < 0.001)
			break;
		if (ratio < 2 && zone >= 6)
			stats.push(zone_stats(zone, stances, g));
		if (g.coordinate)
			g.challenge = ceil(1.25 * g.challenge);
	}

	return [stats, stances];
}
