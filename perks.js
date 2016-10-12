':' //; exec node "$0"

// zxv: 10 numerical inputs, 12 checkboxes, 1 dropdown menu
// Inputs
var helium = 14.7e6;
var zone = 150;
var last_unlock = 'reso';
var weights = {helium: 6, attack: 3, health: 1, overkill: .4, sipho: .1}

// Outputs
var level = {};

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

// Various other constants
const loot_factor = .7;
const turkimp = 1 + (1.5 / 1.166 - 1) * .7;
const magic = (Math.exp(1) - 1) * 100;
const geneticist_exp = Math.log(1.01) / Math.log(1.02);

const add = (perk, x) => 1 + level[perk] * x / 100;
const mult = (perk, x) => Math.pow(1 + x / 100, level[perk]);
const ppp = (perk) => income() * trimps() / mult(perk, -5);

// Computations based on the zone
var imp_ort, magnimp, slow, armors, weapons, books, megabooks, gigas, base_housing, mystic, tacular, base_income;

function precompute_equipment_ratios(cost, value, exp) {
	exp /= 0.85;
	cost *= 1.069;
	value *= Math.pow(1.19, 1 - 0.3 * exp);
	exp /= (zone < 60 ? 57 : 53) * Math.log(1.069) / Math.log(1.19);
	return () => Math.pow(ppp('arti') / cost, exp) * value;
}

function cost(perk) {
	if (increment[perk])
		return base[perk] * add(perk, increment[perk]);
	else
		return Math.ceil(level[perk] / 2 + base[perk] * mult(perk, 30));
}

function trimps() {
	var carp = mult('carp', 10) * add('carp2', 0.25);
	var bonus = 3 + Math.log(income() / base_income * carp / mult('reso', -5));
	var territory = 10 * add('trumps', 20) * (tauntimp * 113 - 112);
	return 10 * (base_housing * bonus + territory) * carp;
}

function income() {
	var storage = mult('reso', -5) / add('packrat', 20) / 8;
	var ticks = Math.floor(10 * mult('agility', -5));
	var prod = add('moti', 5) * add('moti2', 1) * add('medit', 1) * turkimp;
	var lmod = add('loot', 5) * add('loot2', 0.25) * magnimp * loot_factor / ticks;
	var loot = 20.8 * (zone > 100 ? 1 : .7) * lmod;
	var chronojest = 3.75 * prod * lmod;
	return whipimp * books * megabooks * (prod + loot + chronojest) * (1 - storage);
}

function attack() {
	var crits = 1 + (level['relent'] / 20) * add('relent', 30);
	return weapons() * crits * add('power', 5) * add('range', 1) * add('anti', 10) * add('power2', 1);
}

// TODO: account for Slow
// TODO: check final values
function health() {
	var nurseries = Math.log(ppp('reso') * (.06 / 2e6) + 1) / Math.log(1.06);
	var breed = Math.pow(1.01, nurseries) * add('phero', 10) * venimp;
	var genes = Math.pow(breed, geneticist_exp);
	return armors() * add('tough', 5) * mult('resi', 10) * add('tough2', 1) * genes;
}

function block() {
	var gyms = Math.log(ppp('reso') * (.185 / 400) + 1) / Math.log(1.185);
	var trainers = 1.7 * gyms;
	return 6 * gyms * Math.pow(1 + mystic / 100, gyms) * (1 + tacular * trainers);
}

function survivability() {
	var hp = coord() * health(), blk = coord() * block();
	if (zone > 59)
		blk = Math.min(blk, hp / 4);
	return hp + 48 * blk;
}

function coord() {
	var ratio = 1 + .25 * Math.pow(.98, level['coord']);
	var coords = Math.log(trimps()) / Math.log(ratio);
	return Math.pow(1.25, Math.min(zone, coords));
}

var stats = {
	helium:   () => add('loot', 5) * add('loot2', 0.25),
	attack:   () => coord() * attack(),
	health:   () => survivability(),
	overkill: () => add('ok', magic),
	sipho:    () => add('sipho', magic),
}

function score() {
	var result = 0;
	for (var i in weights)
		result += weights[i] * Math.log(stats[i]());
	return result / mult('agility', -5);
}

function best_perk() {
	var best;
	var max = 0;
	var baseline = score();
	var unlocked = false;

	for (perk in base) {
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

function optimize() {
	for (perk in base)
		level[perk] = 0;

	imp_ort = Math.pow(1.003, zone * 99 * .03);
	magnimp = imp_ort, whipimp = imp_ort, tauntimp = imp_ort, venimp = imp_ort;
	slow = zone > 130;
	armors = precompute_equipment_ratios(slow ? 1545 : 1045, slow ? 152 : 92, 14);
	weapons = precompute_equipment_ratios(slow ? 1315 : 865, slow ? 40 : 25, 13);
	books = Math.pow(1.25, Math.min(zone, 59));
	megabooks = Math.pow(zone > 100 ? 1.6 : 1.5, Math.max(zone - 59, 0));
	gigas = Math.min(zone - 60, zone / 2 - 25, zone / 3 - 12, zone / 5, zone / 10 + 17);
	base_housing = Math.pow(1.25, Math.min(zone / 2, 30) + Math.max(0, 0|gigas));
	mystic = Math.floor(Math.min(zone >= 25 && zone / 5, 9 + zone / 25, 15));
	tacular = (20 + zone - zone % 5) / 100;
	base_income = income();

	for (var best = 'loot'; best; best = best_perk()) {
		helium -= cost(best);
		++level[best];
	}
}

/*
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

compare('coord', 'carp');
compare('arti', 'reso');

var ratio = 1 + .25 * Math.pow(.98, level['coord']);
var coords = Math.log(trimps()) / Math.log(ratio);
console.log('coords:', coords);

console.log('health/block =', health() / block());
*/
