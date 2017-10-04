// 2>&-; exec node "$0" "$@"

// Total bonus from an additive perk. `x` is the percentage from each level.
const add = (perk, x) => 1 + perk.level * x / 100;

// Total bonus from a compounding perk. `x` is the percentage from each level.
const mult = (perk, x) => pow(1 + x / 100, perk.level);

function Perk(name, base_cost, increment, cap, free) {
	return {
		name, level: 0, pack: 1, cap, must: 0, spent: 0, free,

		// Compute the current cost of a perk, based on its current level.
		cost: increment ? function() {
			return this.pack * (base_cost + increment * (this.level + (this.pack - 1) / 2));
		} : function() {
			return ceil(this.level / 2 + base_cost * mult(this, 30));
		}
	};
}

function parse_perks(fixed, unlocks) {
	let perks = [
		Perk('Looting_II',     100e3, 10e3, Infinity, 1e4),
		Perk('Carpentry_II',   100e3, 10e3, Infinity, 1e4),
		Perk('Motivation_II',  50e3,  1e3,  Infinity, 1e4),
		Perk('Power_II',       20e3,  500,  Infinity, 1e4),
		Perk('Toughness_II',   20e3,  500,  Infinity, 1e4),
		Perk('Overkill',       1e6,   0,    30,       1e4),
		Perk('Resourceful',    50e3,  0,    Infinity, 1e6),
		Perk('Coordinated',    150e3, 0,    Infinity, 1e4),
		Perk('Siphonology',    100e3, 0,    3,        1e4),
		Perk('Anticipation',   1000,  0,    10,       1e4),
		Perk('Resilience',     100,   0,    Infinity, 1e4),
		Perk('Meditation',     75,    0,    7,        1e4),
		Perk('Relentlessness', 75,    0,    10,       1e4),
		Perk('Carpentry',      25,    0,    Infinity, 1e4),
		Perk('Artisanistry',   15,    0,    Infinity, 1e4),
		Perk('Range',          1,     0,    10,       1e4),
		Perk('Agility',        4,     0,    20,       1e4),
		Perk('Bait',           4,     0,    Infinity, 1e7),
		Perk('Trumps',         3,     0,    Infinity, 1e8),
		Perk('Pheromones',     3,     0,    Infinity, 1e6),
		Perk('Packrat',        3,     0,    Infinity, 1e7),
		Perk('Motivation',     2,     0,    Infinity, 1e4),
		Perk('Power',          1,     0,    Infinity, 1e4),
		Perk('Toughness',      1,     0,    Infinity, 1e4),
		Perk('Looting',        1,     0,    Infinity, 1e4),
	];

	for (let item of fixed.split(/ *, */).filter(x => x)) {
		let m = item.match(/(.*) *([<=>])=? *(.*)/);
		if (!m)
			throw 'Enter a list of perk levels, such as “power=42, toughness=51”';

		let tier2 = m[1].match(/2$|II$/);
		let name = m[1].replace(/[ _]?(2|II)/i, '').replace('Ok', 'O').replace('Looty', 'L');
		let regex = new RegExp(`^${name}[a-z]*${tier2 ? '_II' : ''}$`, 'i');
		let matches = perks.filter(p => p.name.match(regex));

		if (matches.length > 1)
			throw `Ambiguous perk abbreviation: ${m[1]}.`;
		if (matches.length < 1)
			throw `Unknown perk: ${m[1]}.`;

		let level = parse_suffixes(m[3]);
		if (level === null)
			throw `Invalid number: ${m[3]}.`;

		if (m[2] != '>')
			matches[0].cap = level;
		if (m[2] != '<')
			matches[0].must = level;
	}

	for (let perk of perks)
		if (unlocks.indexOf(perk.name) == -1)
			perk.cap = -1;

	return perks;
}

function optimize(params) {
	"use strict";

	let {he_left, zone, perks, weight, mod} = params;
	let [
		Looting_II, Carpentry_II, Motivation_II, Power_II, Toughness_II,
		Overkill, Resourceful, Coordinated, Siphonology, Anticipation,
		Resilience, Meditation, Relentlessness, Carpentry, Artisanistry,
		Range, Agility, Bait, Trumps, Pheromones,
		Packrat, Motivation, Power, Toughness, Looting
	] = perks;

	for (let perk of perks)
		if (perk.name.endsWith('_II'))
			perk.pack = pow(10, max(0, floor(log(he_left) / log(100) - 4.2)));

	let imp = {};
	for (let name of ['whip', 'magn', 'taunt', 'ven'])
		imp[name] = pow(1.003, zone * 99 * 0.03 * mod[name]);

	const books = pow(1.25, zone) * pow(zone > 100 ? 1.28 : 1.2, max(zone - 59, 0));
	const gigas = max(0, min(zone - 60, zone/2 - 25, zone/3 - 12, zone/5, zone/10 + 17, 39));
	const base_housing = pow(1.25, min(zone / 2, 30) + gigas);
	const mystic = floor(min(zone >= 25 && zone / 5, 9 + zone / 25, 15));
	const tacular = (20 + zone - zone % 5) / 100;
	const base_income = 600 * imp.whip * books;
	const base_helium = pow(zone - 19, 2);
	const max_tiers = zone / 5 + ((zone - 1) % 10 < 5);
	const exp = {
		cost: pow(1.069, 0.85 * (zone < 60 ? 57 : 53)),
		attack: pow(1.19, 13),
		health: pow(1.19, 14),
	};
	const equip_cost = {
		attack: 211 * (weight.attack + weight.health) / weight.attack,
		health: 248 * (weight.attack + weight.health) / weight.health,
	};

	// Number of ticks it takes to one-shot an enemy.
	function ticks() {
		return 1 + (Agility.level < 3) + ceil(10 * mult(Agility, -5));
	}

	const moti = () => add(Motivation, 5) * add(Motivation_II, 1);
	const looting = () => add(Looting, 5) * add(Looting_II, 0.25);

	function income(ignore_prod) {
		let storage = mod.storage * mult(Resourceful, -5) / add(Packrat, 20);
		let loot = looting() * imp.magn / ticks();
		let prod = ignore_prod ? 0 : moti() * add(Meditation, 1) * mod.prod;
		let chronojest = mod.chronojest * 0.75 * prod * loot;
		return base_income * (prod + loot * mod.loot + chronojest) * (1 - storage);
	}

	// Max population
	function trimps() {
		let carp = mult(Carpentry, 10) * add(Carpentry_II, 0.25);
		let bonus = 3 + max(log(income() / base_income * carp / mult(Resourceful, -5)), 0);
		let territory = add(Trumps, 20) * zone;
		return 10 * (base_housing * bonus + territory) * carp * imp.taunt + mod.dg * carp;
	}

	function equip(stat) {
		let cost = equip_cost[stat] * mult(Artisanistry, -5);
		let levels = 1.136;
		let tiers = log(1 + income() * trimps() / cost) / log(exp.cost);

		if (tiers > max_tiers + 0.45) {
			levels = log(1 + pow(exp.cost, tiers - max_tiers) * 0.2) / log(1.2);
			tiers = max_tiers;
		}
		return levels * pow(exp[stat], tiers);
	}

	// Number of buildings of a given kind that can be built with the current income.
	// cost: base cost of the buildings
	// exp: cost increase for each new level of the building
	function building(cost, exp) {
		cost *= 4 * mult(Resourceful, -5);
		return log(1 + income(true) * trimps() * (exp - 1) / cost) / log(exp);
	}

	// Number of zones spent in the Magma
	function magma() {
		return max(zone - 229, 0);
	}

	// function mancers() {
		// let tributes = building(10000, 1.05);
		// let mancers = log(loot * pow(1.05, tributes) / 1e62) / log(1.01);
		// return magma() ? 1 + 0.6 * (1 - pow(0.9999, mancers)) : 1;
	// }

	// Breed speed
	function breed() {
		let nurseries = building(2e6, 1.06) / (1 + 0.1 * min(magma(), 20));
		let potency = 0.00085 * pow(1.1, floor(zone / 5));
		let traps = zone <= 90 ? add(Bait, 100) * mod.breed_timer / trimps() : 0;
		return potency * pow(1.01, nurseries) * add(Pheromones, 10) * imp.ven + traps;
	}

	let group_size = [];

	for (let coord = 0; coord < log(1 + he_left / 500e3) / log(1.3); ++coord) {
		let ratio = 1 + 0.25 * pow(0.98, coord);
		let result = 1;
		for (let i = 0; i < 100; ++i)
			result = ceil(result * ratio);
		group_size[coord] = result / pow(ratio, 100);
	}

	// Theoretical fighting group size (actual size is lower because of Coordinated)
	function soldiers() {
		let ratio = 1 + 0.25 * mult(Coordinated, -2);
		let coords = log(trimps() / 3 / group_size[Coordinated.level]) / log(ratio);
		let available = zone - 1 + (magma() ? 100 : 0);
		return group_size[0] * pow(1.25, min(coords, available));
	}

	// Total attack
	function attack() {
		let attack = (0.15 + equip('attack')) * pow(0.8, magma());
		attack *= add(Power, 5) * add(Power_II, 1);
		attack *= add(Relentlessness, 5 * add(Relentlessness, 30));
		attack *= pow(1 + Siphonology.level, 0.1) * add(Range, 1);
		attack *= add(Anticipation, 6);
		return soldiers() * attack;
	}

	// Block per imp
	function block() {
		let gyms = building(400, 1.185);
		let trainers = (gyms * log(1.185) - log(1 + gyms)) / log(1.1) + 25 - mystic;
		return 0.04 * gyms * pow(1 + mystic / 100, gyms) * (1 + tacular * trainers);
	}

	// Total survivability (accounts for health and block)
	function health() {
		let health = (0.6 + equip('health')) * pow(0.8, magma());
		health *= add(Toughness, 5) * add(Toughness_II, 1) * mult(Resilience, 10);

		if (!weight.breed) {
			let ratio = 1 + 0.25 * mult(Coordinated, -2);
			let available = zone - 1 + (magma() ? 100 : 0);
			let required = group_size[Coordinated.level] * pow(ratio, available);
			let fighting = min(required / trimps(), 1 / 3);
			let target_speed = fighting > 1e-9 ?
				(pow(0.5 / (0.5 - fighting), 0.1 / mod.breed_timer) - 1) * 10 :
				fighting / mod.breed_timer;
			let geneticists = log(breed() / target_speed) / -log(0.98);
			if (geneticists > 1e308)
				console.log(ratio, available, required, fighting, breed_factor, target_speed, geneticists);
			health *= pow(1.01, geneticists);
		}

		return soldiers() * min(health / 60 + block(), health / 12);
	}

	function agility() {
		return 1 / mult(Agility, -5);
	}

	function helium() {
		return base_helium * looting() + 45;
	}

	const overkill = () => add(Overkill, 9000);

	const stats = { agility, helium, attack, health, overkill, breed };

	function score() {
		let result = 0;
		for (let i in weight) {
			if (!weight[i])
				continue;
			let stat = stats[i]();
			if (!isFinite(stat))
				throw Error(i + ' is ' + stat);
			result += weight[i] * log(stat);
		}

		return result;
	}

	function best_perk() {
		let best;
		let max = 0;
		let baseline = score();

		for (let perk of perks) {
			if (perk.level >= perk.cap || perk.cost() > he_left)
				continue;
			if (perk.level < perk.must)
				return perk;

			perk.level += perk.pack;
			let gain = score() - baseline;
			perk.level -= perk.pack;

			let efficiency = gain / perk.cost();
			if (efficiency > max) {
				max = efficiency;
				best = perk;
			}
		}

		return best;
	}

	mod.loot *= 20.8 * (0.7 + 0.3 * floor((zone + 1) / 101));
	weight.breed = zone < 70 ? weight.health : 0;
	weight.agility = 5;

	// Main loop
	for (let best; (best = best_perk()); ) {
		let spent = 0;
		while (best.level < best.cap && spent < he_left / best.free) {
			he_left -= best.cost();
			spent += best.cost();
			best.level += best.pack;
			if (best.level == 1000 * best.pack)
				best.pack *= 10;
		}
		best.spent += spent;
	}

	for (let perk of perks)
		console.log(perk.name, '=', perk.level);

	return [he_left, perks];
}

// When executing from the command-line
if (typeof window === 'undefined') {
	optimize({
		he_left: parseFloat(process.argv[2]),
		zone: 450,
		weight: {helium: 5, attack: 4, health: 2, overkill: 0},
		perks: parse_perks('trumps=0', {indexOf: _ => 0}),
		mod: {
			storage: 0.125,
			dg: 0,
			whip: true,
			magn: true,
			taunt: true,
			ven: true,
			chronojest: 5,
			prod: 1,
			loot: 1,
			breed_timer: 30,
		}
	});
}
