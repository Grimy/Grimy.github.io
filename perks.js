':' //; exec node "$0"
function optimize(params) {
	"use strict";

	var {helium, zone, last_unlock, weight, mod} = params;

	if (!(helium < 1e12))
		return;

	// Cost of the first level of each perk
	const base = {
		loot2:   100e3,
		carp2:   100e3,
		moti2:   50e3,
		power2:  20e3,
		tough2:  20e3,
		ok:      1e6,
		reso:    50e3,
		coord:   150e3,
		sipho:   100e3,
		anti:    1000,
		resi:    100,
		medit:   75,
		relent:  75,
		carp:    25,
		arti:    15,
		range:   1,
		agility: 4,
		bait:    4,
		trumps:  3,
		phero:   3,
		packrat: 3,
		moti:    2,
		power:   1,
		tough:   1,
		loot:    1,
	};

	// Cost increment, in percentage of the base cost, for tier II perks
	const increment = {tough2: 2.5, power2: 2.5, moti2: 2, carp2: 10, loot2: 10};

	// Maximum level, for the perks that have one
	const cap = {range: 10, agility: 20, relent: 10, medit: 7, anti: 10, sipho: 3, ok: 30};

	// Copy these Math functions in our namespace
	const {min, max, pow, log, floor, ceil} = Math;

	// Total bonus from an additive perk. `x` is the percentage from each level.
	const add = (perk, x) => 1 + level[perk] * x / 100;

	// Total bonus from a compounding perk. `x` is the percentage from each level.
	const mult = (perk, x) => pow(1 + x / 100, level[perk]);

	// Return a function that returns the total bonus granted by equipment for a given stat.
	// cost: total cost of tier I equipments for the stat
	// value: total bonus granted by relevant tier I equipments
	// exp: 13 for attack, 14 for health (defined in game.global.prestige)
	// TODO handle foo-climbing
	function precompute_equipment_ratios(cost, value, exp) {
		exp /= 0.85;
		cost *= 1.069;
		value *= pow(1.19, 1 - 0.3 * exp);
		exp /= (zone < 60 ? 57 : 53) * log(1.069) / log(1.19);
		return () => pow(income() * trimps() / (cost * mult('arti', -5)), exp) * value;
	}

	// Compute the current cost of a perk, based on its current level.
	function cost(perk) {
		if (increment[perk])
			return base[perk] * add(perk, increment[perk]);
		else
			return ceil(level[perk] / 2 + base[perk] * mult(perk, 30));
	}

	// Max population
	function trimps() {
		var carp = mult('carp', 10) * add('carp2', 0.25);
		var bonus = mod.housing + log(income() / base_income * carp / mult('reso', -5));
		var territory = add('trumps', 20) * zone;
		return 10 * (base_housing * bonus + territory) * carp * imp.taunt;
	}

	// Number of ticks it takes to one-shot an enemy.
	function ticks() {
		return 2 + floor(10 * mult('agility', -5));
	}

	// Number of buildings of a given kind that can be built with the current income.
	// cost: base cost of the buildings
	// exp: cost increase for each new level of the building
	function building(cost, exp) {
		cost *= 4 * mult('reso', -5);
		return log(income() * trimps() * (exp - 1) / cost + 1) / log(exp);
	}

	const moti = () => add('moti', 5) * add('moti2', 1);
	const looting = () => add('loot', 5) * add('loot2', 0.25);

	// Total resource gain per second
	function income() {
		var storage = mod.storage * mult('reso', -5) / add('packrat', 20);
		var prod = moti() * add('medit', 1) * (1 + mod.turkimp / 2);
		var lmod = looting() * imp.magn * mod.loot / ticks();
		var loot = base_loot * lmod * (1 + .166 * mod.turkimp);
		var chronojest = mod.chronojest * 0.75 * prod * lmod;
		return 1800 * imp.whip * books * (prod + loot + chronojest) * (1 - storage);
	}

	// Breed speed
	function breed() {
		var nurseries = pow(1.01, building(2e6, 1.06));
		var potency = pow(1.1, floor(zone / 5));
		var bait = weight.breed * add('bait', 100) * 10 * mod.breed_timer / trimps();
		return 0.00085 * nurseries * potency * add('phero', 10) * imp.ven + bait;
	}

	function group_size(ratio) {
		var result = 1;
		for (var i = 0; i < 20; ++i)
			result = ceil(result * ratio);
		return result;
	}

	// Theoretical fighting group size (actual size is lower because of Coordinated) 
	function soldiers() {
		var ratio = 1 + .25 * pow(.98, level['coord']);
		var coords = log(trimps() / 3 / group_size(ratio)) / log(ratio);
		return group_size(1.25) * Math.pow(1.25, min(zone - 1, coords));
	}

	// Total attack
	function attack() {
		var power = add('power', 5) * add('power2', 1) * add('range', 1);
		var crits = add('relent', 5 * add('relent', 30));
		var sipho = pow(1 + level['sipho'], 0.1);
		var anti = add('anti', 2 * mod.breed_timer);
		return soldiers() * weapons() * power * crits * sipho * anti;
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
		var health = armors() * add('tough', 5) * mult('resi', 10) * add('tough2', 1);
		if (zone >= 70 && weight.breed == 0) {
			var target_speed = pow(6, 0.1 / mod.breed_timer);
			var geneticists = log(breed() / target_speed) / log(1.02);
			health *= pow(1.01, geneticists);
		}
		return soldiers() * (health + 4 * min(block(), health));
	}

	const overkill = () => attack() * add('ok', 60);

	const stats = { helium: looting, attack, health, overkill, breed }

	// TODO adjust weight of helium based on the current zone
	function score() {
		var result = 0;
		for (var i in weight)
			if (weight[i] != 0)
				result += weight[i] * log(stats[i]());
		return result / mult('agility', -5);
	}

	// TODO optimize this
	function best_perk() {
		var best;
		var max = 0;
		var baseline = score();
		var unlocked = false;

		for (var perk in base) {
			unlocked |= perk == last_unlock;
			if (!unlocked || level[perk] === cap[perk] || cost(perk) > helium)
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

	// Main
	var level = {};
	for (var perk in base)
		level[perk] = 0;

	var imp = {};
	for (var name of ['whip', 'magn', 'taunt', 'ven'])
		imp[name] = pow(1.003, zone * 99 * .03 * mod[name]);

	var slow = zone > 130;
	var frugal = zone > 100 ? 1.28 : 1.2;
	var armors = precompute_equipment_ratios(slow ? 1545 : 1045, slow ? 152 : 92, 14);
	var weapons = precompute_equipment_ratios(slow ? 1315 : 865, slow ? 40 : 25, 13);
	var books = pow(1.25, zone) * pow(frugal, max(zone - 59, 0));
	var gigas = min(zone - 60, zone / 2 - 25, zone / 3 - 12, zone / 5, zone / 10 + 17);
	var base_housing = pow(1.25, min(zone / 2, 30) + mod.giga * max(0, 0|gigas));
	var mystic = floor(min(zone >= 25 && zone / 5, 9 + zone / 25, 15));
	var tacular = (20 + zone - zone % 5) / 100;
	var base_loot = 20.8 * (zone > 200 ? 1.2 : zone > 100 ? 1 : 0.7);
	var base_income = income();

	for (var best = 'loot'; best; best = best_perk()) {
		helium -= cost(best);
		++level[best];
	}

	compare('coord', 'carp');
	compare('arti', 'reso');
	compare('loot', 'moti');
	console.log('Max trimps', trimps());

	return level;
}

// When executing from the command-line
if (typeof window === 'undefined') {
	console.log(optimize({
		helium: 13e9,
		zone: 245,
		last_unlock: 'loot2',
		weight: {helium: 17, attack: 3, health: 1, breed: 0},
		mod: {
			storage: 0.02,
			whip: true,
			magn: true,
			taunt: true,
			ven: true,
			chronojest: 5,
			loot: 1,
			turkimp: .5,
			breed_timer: 30,
			giga: 1,
			housing: 3,
		}
	}));
}
