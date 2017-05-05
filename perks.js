// 2>&-; exec node "$0" "$@"

const equipment = {
	shield: [40, 4, 'health'],
	dagger: [40, 2, 'attack'],
	boots: [55, 6, 'health'],
	mace: [80, 3, 'attack'],
	helm: [100, 10, 'health'],
	pole: [140, 4, 'attack'],
	pants: [160, 14, 'health'],
	axe: [230, 7, 'attack'],
	guards: [275, 23, 'health'],
	sword: [375, 9, 'attack'],
	plate: [415, 35, 'health'],
	arbalest: [450, 15, 'attack'],
	gambeson: [500, 60, 'health'],
};

// Cost of the first level of each perk
const base_cost = {
	Looting_II:     100e3,
	Carpentry_II:   100e3,
	Motivation_II:  50e3,
	Power_II:       20e3,
	Toughness_II:   20e3,
	Overkill:       1e6,
	Resourceful:    50e3,
	Coordinated:    150e3,
	Siphonology:    100e3,
	Anticipation:   1000,
	Resilience:     100,
	Meditation:     75,
	Relentlessness: 75,
	Carpentry:      25,
	Artisanistry:   15,
	Range:          1,
	Agility:        4,
	Bait:           4,
	Trumps:         3,
	Pheromones:     3,
	Packrat:        3,
	Motivation:     2,
	Power:          1,
	Toughness:      1,
	Looting:        1,
};

// Cost increment, in percentage of the base cost, for tier II perks
const increment = {Toughness_II: 500, Power_II: 500, Motivation_II: 1e3, Carpentry_II: 10e3, Looting_II: 10e3};

// Maximum levels for perks
var cap;

// Minimum levels for perks
var must;

var perks = Object.keys(base_cost);

function optimize(params) {
	"use strict";

	let {he_left, zone, unlocks, fixed, pack, weight, climb, mod} = params;
	while (he_left / pack / pack > 1e13)
		pack *= 10;

	// Copy these Math functions in our namespace
	const {min, max, sqrt, pow, log, floor, round, ceil} = Math;

	// Total bonus from an additive perk. `x` is the percentage from each level.
	const add = (perk, x) => 1 + level[perk] * x / 100;

	// Total bonus from a compounding perk. `x` is the percentage from each level.
	const mult = (perk, x) => pow(1 + x / 100, level[perk]);

	const corruption_start = 181;

	function tiers(stat) {
		let {cost, value, exp} = equip_total[stat];
		let result = pow(income() * trimps() / (cost * mult('Artisanistry', -5)), exp) * value;
		return pow(result, mod.income);
	}

	// Amount of Helium awarded at the end of the given zone.
	function zone_helium(z) {
		let level = (z - 19) * 1.35;
		let base = z >= corruption_start ? 10 : z >= 59 ? 5 : 1;
		let reward = round(base * pow(1.23, sqrt(level))) + round(base * level);
		return reward * pow(scientist_done ? 1.005 : 1, z);
	}

	// Total helium from a run up to the given zone
	function run_helium(z) {
		let result = 10 * zone_helium(zone);
		for (let i = 21; i <= z; ++i) {
			let corrupt = floor((i - corruption_start) / 3);
			corrupt = corrupt < 0 ? 0 : min(corrupt + 2, 80);
			result += zone_helium(i) * ((i == 200 ? 20 : 1) + corrupt * 0.15);
		}
		return result;
	}

	// Compute the current cost of a perk, based on its current level.
	function cost(perk) {
		if (increment[perk])
			return pack * (base_cost[perk] + increment[perk] * (level[perk] + (pack - 1) / 2));
		else
			return ceil(level[perk] / 2 + base_cost[perk] * mult(perk, 30));
	}

	// Max population
	function trimps() {
		let carp = mult('Carpentry', 10) * add('Carpentry_II', 0.25);
		let bonus = mod.housing + log(income() / base_income * carp / mult('Resourceful', -5));
		let territory = add('Trumps', 20) * zone;
		return 10 * (base_housing * bonus + territory) * carp * imp.taunt + mod.dg * carp;
	}

	// Number of ticks it takes to one-shot an enemy.
	function ticks() {
		return 1 + (level.Agility < 3) + ceil(10 * mult('Agility', -5));
	}

	// Number of buildings of a given kind that can be built with the current income.
	// cost: base cost of the buildings
	// exp: cost increase for each new level of the building
	function building(cost, exp) {
		cost *= 4 * mult('Resourceful', -5);
		return log(income(true) * trimps() * (exp - 1) / cost + 1) / log(exp);
	}

	const moti = () => add('Motivation', 5) * add('Motivation_II', 1);
	const looting = () => add('Looting', 5) * add('Looting_II', 0.25);

	// Total resource gain per second
	function income(wood) {
		let storage = mod.storage * mult('Resourceful', -5) / add('Packrat', 20);
		let prod = wood ? 0 : moti() * add('Meditation', 1) * 1.25;
		let lmod = looting() * imp.magn / ticks();
		let loot = base_loot * lmod * 1.083;
		let chronojest = mod.chronojest * 0.75 * prod * lmod;
		return 1800 * imp.whip * books * (prod + loot + chronojest) * (1 - storage);
	}

	// Breed speed
	function breed() {
		let nurseries = pow(1.01, building(2e6, 1.06));
		nurseries -= (2000 * pow(0.95, magma())) * (1 - pow(0.9, magma()));
		let potency = pow(1.1, floor(zone / 5));
		let traps = zone <= 90 ? add('Bait', 100) * mod.breed_timer / trimps() : 0;
		return 0.00085 * nurseries * potency * add('Pheromones', 10) * imp.ven + traps;
	}

	function group_size(ratio) {
		let result = 1;
		for (let i = 0; i < 20; ++i)
			result = ceil(result * ratio);
		return result / pow(ratio, 20);
	}

	// Theoretical fighting group size (actual size is lower because of Coordinated) 
	function soldiers() {
		let ratio = 1 + 0.25 * pow(0.98, level.Coordinated);
		let coords = log(trimps() / 3 / group_size(ratio)) / log(ratio);
		let available = zone - 1 + (magma() ? 100 : 0);
		return group_size(1.25) * pow(1.25, min(coords, available));
	}

	function breed_factor() {
		let ratio = 1 + 0.25 * pow(0.98, level.Coordinated);
		let available = zone - 1 + (magma() ? 100 : 0);
		let required = group_size(ratio) * pow(ratio, available);
		let fighting = min(required / trimps(), 1 / 3);
		return 0.5 / (0.5 - fighting);
	}

	// Number of zones spent in the Magma
	function magma() {
		return max(zone - 229, 0);
	}

	// Total attack
	function attack() {
		let attack = tiers('attack') * add('Power', 5) * add('Power_II', 1);
		attack *= add('Relentlessness', 5 * add('Relentlessness', 30));
		attack *= pow(1 + level.Siphonology, 0.1) * add('Range', 1);
		attack *= add('Anticipation', 6);
		attack *= pow(0.8, magma());
		return soldiers() * attack;
	}

	// Block per imp
	// TODO handle shieldblock
	function block() {
		let gyms = building(400, 1.185);
		let trainers = (gyms * log(1.185) - log(gyms)) / log(1.1) + 25 - mystic;
		return 6 * gyms * pow(1 + mystic / 100, gyms) * (1 + tacular * trainers);
	}

	// Total survivability (accounts for health and block)
	function health() {
		let health = tiers('health') * add('Toughness', 5) * mult('Resilience', 10) * add('Toughness_II', 1);
		if (!weight.breed) {
			let target_speed = (pow(breed_factor(), 0.1 / mod.breed_timer) - 1) * 10;
			let geneticists = log(breed() / target_speed) / -log(0.98);
			health *= pow(1.01, geneticists);
		}
		health *= pow(0.8, magma());
		return soldiers() * min(health / 60 + block(), health / 12);
	}

	function agility() {
		return 1 / mult('Agility', -5);
	}

	function helium() {
		return base_helium * looting() + 45;
	}

	const overkill = () => add('Overkill', 60);

	const stats = { agility, helium, attack, health, overkill, breed };

	function score() {
		let result = 0;
		for (let i in weight)
			if (weight[i] !== 0)
				result += weight[i] * log(stats[i]());
		return result;
	}

	function best_perk() {
		let best;
		let max = 0;
		let baseline = score();

		for (let perk of unlocks) {
			if (level[perk] === cap[perk] || cost(perk) > he_left)
				continue;
			if (level[perk] < must[perk])
				return perk;

			level[perk] += increment[perk] ? pack : 1;
			let gain = score() - baseline;
			level[perk] -= increment[perk] ? pack : 1;

			let efficiency = gain / cost(perk);
			if (efficiency > max) {
				max = efficiency;
				best = perk;
			}
		}

		return best;
	}

	function compare(a, b) {
		let tmp = score();
		++level[a];
		let a_gain = score() - tmp;
		--level[a];
		++level[b];
		let b_gain = score() - tmp;
		--level[b];
		console.log(a, '=', a_gain / b_gain, b);
	}

	let level = {};
	for (let perk of perks)
		level[perk] = 0;

	cap = {Range: 10, Agility: 20, Relentlessness: 10, Meditation: 7, Anticipation: 10, Siphonology: 3, Overkill: 30};
	must = {};

	for (let item of fixed) {
		let [perk, value] = item.split('=');
		cap[perk] = parseInt(value);
		must[perk] = parseInt(value);
	}

	let imp = {};
	for (let name of ['whip', 'magn', 'taunt', 'ven'])
		imp[name] = pow(1.003, zone * 99 * 0.03 * mod[name]);

	let scientist_done = zone > 130;
	let slow = zone > 130;
	let frugal_done = zone > 100 ? 1.28 : 1.2;
	let books = pow(1.25, zone) * pow(frugal_done, max(zone - 59, 0));
	let gigas = min(zone - 60, zone/2 - 25, zone/3 - 12, zone/5, zone/10 + 17, 39);
	let base_housing = pow(1.25, min(zone / 2, 30) + mod.giga * max(0, 0|gigas));
	let mystic = floor(min(zone >= 25 && zone / 5, 9 + zone / 25, 15));
	let tacular = (20 + zone - zone % 5) / 100;
	let base_loot = 20.8 * (zone > 200 ? 1.2 : zone > 100 ? 1 : 0.7);
	let base_income = income();
	let base_helium = run_helium(zone);

	weight.breed = zone < 70 ? weight.health : 0;
	weight.agility = 5;

	// Precompute equipment ratios
	const equip_total = {
		attack: {cost: 0, value: 0, exp: 13},
		health: {cost: 0, value: 0, exp: 14},
	};

	for (let piece in equipment) {
		let [cost, value, stat] = equipment[piece];
		equip_total[stat].cost += cost;
		equip_total[stat].value += value;
		if (piece == climb)
			break;
	}

	for (let stat in equip_total) {
		equip_total[stat].exp /= 0.85;
		equip_total[stat].cost *= 1.069;
		equip_total[stat].value *= pow(1.19, 1 - 0.3 * equip_total[stat].exp);
		equip_total[stat].exp /= (zone < 60 ? 57 : 53) * log(1.069) / log(1.19);
	}

	// Main loop
	let free = he_left / 2000;
	let shitty = {Bait: true, Packrat: true, Trumps: true};

	for (let best = 'Looting'; best; best = best_perk()) {
		let spent = 0;
		while (spent < free) {
			he_left -= cost(best);
			spent += cost(best);
			level[best] += increment[best] ? pack : 1;
			if (level[best] == cap[best] || shitty[best])
				break;
		}
		free = min(he_left / 10, free);
	}

	for (let perk in level)
		console.log(perk + ': ' + level[perk]);

	return level;
}

// When executing from the command-line
if (typeof window === 'undefined') {
	console.log(optimize({
		he_left: parseFloat(process.argv[2]),
		zone: 50,
		weight: {helium: 5, attack: 4, health: 2, overkill: 0},
		climb: 'plate',
		unlocks: perks,
		mod: {
			storage: 0.125,
			whip: true,
			magn: true,
			taunt: true,
			ven: true,
			chronojest: 5,
			breed_timer: 30,
			giga: 1,
			housing: 3,
		}
	}));
}
