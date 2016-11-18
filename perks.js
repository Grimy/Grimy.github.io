// 2>&-; exec node "$0"

const testing = typeof window === 'undefined' || window.location.protocol == "file:";

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
const increment = {Toughness_II: 2.5, Power_II: 2.5, Motivation_II: 2, Carpentry_II: 10, Looting_II: 10};

// Maximum level, for the perks that have one
const cap = {Range: 10, Agility: 20, Relentlessness: 10, Meditation: 7, Anticipation: 10, Siphonology: 3, Overkill: 30};

const perks = Object.keys(base_cost);

function optimize(params) {
	"use strict";

	var {he_left, zone, unlocks, weight, climb, mod} = params;
	if (he_left > 1e16)
		return;

	// Copy these Math functions in our namespace
	const {min, max, sqrt, pow, log, floor, round, ceil} = Math;

	// Total bonus from an additive perk. `x` is the percentage from each level.
	const add = (perk, x) => 1 + level[perk] * x / 100;

	// Total bonus from a compounding perk. `x` is the percentage from each level.
	const mult = (perk, x) => pow(1 + x / 100, level[perk]);

	function tiers(stat) {
		let {cost, value, exp} = equip_total[stat];
		return pow(income() * trimps() / (cost * mult('Artisanistry', -5)), exp) * value;
	}

	const corruption_start = 181;

	// Amount of Helium awarded at the end of the given zone.
	function zone_helium(z) {
		var level = (z - 19) * 1.35;
		var base = z >= corruption_start ? 10 : z >= 59 ? 5 : 1;
		var reward = round(base * pow(1.23, sqrt(level))) + round(base * level);
		return reward * pow(scientist_done ? 1.005 : 1, z);
	}

	// Total helium from a run up to the given zone
	function run_helium(z) {
		var result = 10 * zone_helium(zone);
		for (var i = 21; i <= z; ++i) {
			let corrupt = floor((i - corruption_start) / 3);
			corrupt = corrupt < 0 ? 0 : min(corrupt + 2, 80);
			result += zone_helium(i) * ((i == 200 ? 20 : 1) + corrupt * 0.15);
		}
		return result;
	}

	// Compute the current cost of a perk, based on its current level.
	function cost(perk) {
		if (increment[perk])
			return base_cost[perk] * add(perk, increment[perk]);
		else
			return ceil(level[perk] / 2 + base_cost[perk] * mult(perk, 30));
	}

	// Max population
	function trimps() {
		var Carpentry = mult('Carpentry', 10) * add('Carpentry_II', 0.25);
		var bonus = mod.housing + log(income() / base_income * Carpentry / mult('Resourceful', -5));
		var territory = add('Trumps', 20) * zone;
		return 10 * (base_housing * bonus + territory) * Carpentry * imp.taunt;
	}

	// Number of ticks it takes to one-shot an enemy.
	function ticks() {
		return 2 + floor(10 * mult('Agility', -5));
	}

	// Number of buildings of a given kind that can be built with the current income.
	// cost: base cost of the buildings
	// exp: cost increase for each new level of the building
	function building(cost, exp) {
		cost *= 4 * mult('Resourceful', -5);
		return log(income() * trimps() * (exp - 1) / cost + 1) / log(exp);
	}

	const moti = () => add('Motivation', 5) * add('Motivation_II', 1);
	const looting = () => add('Looting', 5) * add('Looting_II', 0.25);

	// Total resource gain per second
	function income() {
		var storage = mod.storage * mult('Resourceful', -5) / add('Packrat', 20);
		var prod = moti() * add('Meditation', 1) * (1 + mod.turkimp / 2);
		var lmod = looting() * imp.magn * mod.loot / ticks();
		var loot = base_loot * lmod * (1 + 0.166 * mod.turkimp);
		var chronojest = mod.chronojest * 0.75 * prod * lmod;
		return 1800 * imp.whip * books * (prod + loot + chronojest) * (1 - storage);
	}

	// Breed speed
	function breed() {
		var nurseries = pow(1.01, building(2e6, 1.06));
		var potency = pow(1.1, floor(zone / 5));
		var traps = weight.breed * add('Bait', 100) * 10 * mod.breed_timer / trimps();
		return 0.00085 * nurseries * potency * add('Pheromones', 10) * imp.ven + traps;
	}

	function group_size(ratio) {
		var result = 1;
		for (var i = 0; i < 20; ++i)
			result = ceil(result * ratio);
		return result;
	}

	// Theoretical fighting group size (actual size is lower because of Coordinated) 
	function soldiers() {
		var ratio = 1 + 0.25 * pow(0.98, level.Coordinated);
		var coords = log(trimps() / 3 / group_size(ratio)) / log(ratio);
		return group_size(1.25) * Math.pow(1.25, min(zone - 1, coords));
	}

	// Total attack
	function attack() {
		var power = add('Power', 5) * add('Power_II', 1) * add('Range', 1);
		var crits = add('Relentlessness', 5 * add('Relentlessness', 30));
		var sipho = pow(1 + level.Siphonology, 0.1);
		var anti = add('Anticipation', 2 * mod.breed_timer);
		return soldiers() * tiers('attack') * power * crits * sipho * anti;
	}

	// Block per imp
	// TODO handle shieldblock
	function block() {
		var gyms = building(400, 1.185);
		var trainers = (gyms * log(1.185) - log(gyms)) / log(1.1) + 25 - mystic;
		return 6 * gyms * pow(1 + mystic / 100, gyms) * (1 + tacular * trainers);
	}

	// Total survivability (accounts for health and block)
	function health() {
		var health = tiers('health') * add('Toughness', 5) * mult('Resilience', 10) * add('Toughness_II', 1);
		if (zone >= 70 && weight.breed === 0) {
			var target_speed = pow(6, 0.1 / mod.breed_timer);
			var geneticists = log(breed() / target_speed) / -log(0.98);
			health *= pow(1.01, geneticists);
		}
		return soldiers() * (health + 0 * min(block(), health));
	}

	function helium() {
		return (base_helium * looting() + 45) / mult('Resourceful', testing ? -5 : 0);
	}

	const overkill = () => add('Overkill', 60);

	const stats = { helium, attack, health, overkill, breed };

	// TODO adjust weight of helium based on the current zone
	function score() {
		var result = 0;
		for (var i in weight)
			if (weight[i] !== 0)
				result += weight[i] * log(stats[i]());
		return result / mult('Agility', -0.1);
	}

	function best_perk() {
		var best;
		var max = 0;
		var baseline = score();

		for (var perk of unlocks) {
			if (level[perk] === cap[perk] || cost(perk) > he_left)
				continue;

			++level[perk];
			var gain = score() - baseline;
			--level[perk];

			var efficiency = gain / cost(perk);
			if (efficiency > max) {
				max = efficiency;
				best = perk;
			}
		}

		return best;
	}

	function compare(a, b) {
		var tmp = score();
		++level[a];
		var a_gain = score() - tmp;
		--level[a];
		++level[b];
		var b_gain = score() - tmp;
		--level[b];
		console.log(a, '=', a_gain / b_gain, b);
	}

	var level = {};
	for (let perk of perks)
		level[perk] = 0;

	var imp = {};
	for (let name of ['whip', 'magn', 'taunt', 'ven'])
		imp[name] = pow(1.003, zone * 99 * 0.03 * mod[name]);

	var scientist_done = zone > 130;
	var slow = zone > 130;
	var frugal_done = zone > 100 ? 1.28 : 1.2;
	var books = pow(1.25, zone) * pow(frugal_done, max(zone - 59, 0));
	var gigas = min(zone - 60, zone / 2 - 25, zone / 3 - 12, zone / 5, zone / 10 + 17);
	var base_housing = pow(1.25, min(zone / 2, 30) + mod.giga * max(0, 0|gigas));
	var mystic = floor(min(zone >= 25 && zone / 5, 9 + zone / 25, 15));
	var tacular = (20 + zone - zone % 5) / 100;
	var base_loot = 20.8 * (zone > 200 ? 1.2 : zone > 100 ? 1 : 0.7);
	var base_income = income();
	var base_helium = run_helium(zone);

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
	var free = he_left / 1000;
	var shitty = {Bait: true, Packrat: true, Trumps: true};
	for (let best = 'Looting'; best; best = best_perk()) {
		for (let spent = 0; spent < free; spent += cost(best)) {
			he_left -= cost(best);
			++level[best];
			if (level[best] == cap[best] || shitty[best])
				break;
		}
		free = min(he_left / 10, free);
	}

	// Debug stuff
	var potential_helium = run_helium(zone + 10);
	console.log(equip_total);
	console.log('Suggested looting weight:', log(1024) / log(potential_helium / base_helium));

	console.log('Helium left:', he_left);
	compare('Motivation', 'Power');

	return level;
}

// When executing from the command-line
if (testing) {
	console.log(optimize({
		he_left: 1e12,
		zone: 350,
		weight: {helium: 70, attack: 1, breed: 0, health: 1, overkill: 1},
		climb: 'plate',
		unlocks: Object.keys(base_cost),
		mod: {
			storage: 0.125,
			whip: true,
			magn: true,
			taunt: true,
			ven: true,
			chronojest: 5,
			loot: 1,
			turkimp: 0.5,
			breed_timer: 30,
			giga: 1,
			housing: 3,
		}
	}));
}
