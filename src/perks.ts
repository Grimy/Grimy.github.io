/// <reference path="./trimps.ts"/>

class Perk {
	locked = true;
	level = 0;
	min_level = 0;
	cost = 0;
	gain = 0;
	bonus = 1;

	constructor(
		private base_cost: number,
		public cost_increment: number,
		private scaling: (level: number) => number,
		public max_level: number = Infinity,
		private cost_exponent: number = 1.3,
	) {
		this.cost = this.base_cost;
	}

	levellable(he_left: number): boolean {
		return !this.locked &&
			this.level < this.max_level &&
			this.cost * max(1, floor(this.level / 1e12)) <= he_left;
	}

	level_up(amount: number): number {
		this.level += amount;
		this.bonus = this.scaling(this.level);
		if (this.cost_increment) {
			let spent = amount * (this.cost + this.cost_increment * (amount - 1) / 2);
			this.cost += amount * this.cost_increment;
			return spent;
		} else {
			let spent = this.cost;
			this.cost = ceil(this.level / 2 + this.base_cost * pow(this.cost_exponent, this.level));
			return spent;
		}
	}

	spent(log: boolean = false) {
		if (this.cost_increment)
			return this.level * (this.base_cost + this.cost - this.cost_increment) / 2;
		let total = 0;
		for (let x = 0; x < this.level; ++x)
			total += ceil(x / 2 + this.base_cost * pow(this.cost_exponent, x));
		return total;
	}

	log_ratio(): number {
		return this.cost_increment ? (this.scaling(1) - this.scaling(0)) / this.bonus
		                           : log(this.scaling(this.level + 1) / this.bonus);
	}
}

function validate_fixed() {
	try {
		parse_perks($('#fixed').value, 'l');
		$('#fixed').setCustomValidity('');
	} catch (err) {
		$('#fixed').setCustomValidity(err);
	}
}

let presets: {[key: string]: string[]} = {
	early:      [  '5',  '4',  '3'],
	broken:     [  '7',  '3',  '1'],
	mid:        [ '16',  '5',  '1'],
	corruption: [ '25',  '7',  '1'],
	magma:      [ '35',  '4',  '3'],
	z280:       [ '42',  '6',  '1'],
	z400:       [ '88', '10',  '1'],
	z450:       ['500', '50',  '1'],
	spire:      [  '0',  '1',  '1'],
	nerfed:     [  '0',  '4',  '3'],
	tent:       [  '5',  '4',  '3'],
	scientist:  [  '0',  '1',  '3'],
	carp:       [  '0',  '0',  '0'],
	trapper:    [  '0',  '7',  '1'],
	coord:      [  '0', '40',  '1'],
	trimp:      [  '0', '99',  '1'],
	metal:      [  '0',  '7',  '1'],
	c2:         [  '0',  '7',  '1'],
	income:     [  '0',  '0',  '0'],
}

function select_preset(name: string, manually: boolean = true) {
	delete localStorage['weight-he'];
	delete localStorage['weight-atk'];
	delete localStorage['weight-hp'];
	delete localStorage['weight-xp'];
	[$('#weight-he').value, $('#weight-atk').value, $('#weight-hp').value] = presets[name];
	$('#weight-xp').value = floor((+presets[name][0] + +presets[name][1] + +presets[name][2]) / 5).toString();
}

function auto_preset() {
	let [he, atk, hp] = presets[$('#preset').value];
	let xp = floor((+he + +atk + +hp) / 5).toString();
	$('#weight-he').value = localStorage['weight-he'] || he;
	$('#weight-atk').value = localStorage['weight-atk'] || atk;
	$('#weight-hp').value = localStorage['weight-hp'] || hp;
	$('#weight-xp').value = localStorage['weight-xp'] || xp;
}

function handle_respec(respec: boolean) {
	let owned = game ? game.resources.helium.owned : 0;
	$('#helium').value = (input('helium') + owned * (respec ? -1 : 1)).toString();
}

function update_dg() {
	let max_zone = input('zone') / 2 + 115;
	let eff = 500e6 + 50e6 * game.generatorUpgrades.Efficiency.upgrades;
	let capa = 3 + 0.4 * game.generatorUpgrades.Capacity.upgrades;
	let max_fuel = game.permanentGeneratorUpgrades.Storage.owned ? capa * 1.5 : capa;
	let supply = 230 + 2 * game.generatorUpgrades.Supply.upgrades;
	let overclock = game.generatorUpgrades.Overclocker.upgrades;
	overclock = overclock && (1 - 0.5 * pow(0.99, overclock - 1));
	let burn = game.permanentGeneratorUpgrades.Slowburn.owned ? 0.4 : 0.5;
	let cells = mastery('magmaFlow') ? 18 : 16;
	let accel = mastery('quickGen') ? 1.03 : 1.02;
	let hs2 = mastery('hyperspeed2') ? (game.global.highestLevelCleared + 1) / 2 : 0;
	let bs = 0.5*mastery('blacksmith') + 0.25*mastery('blacksmith2') + 0.15*mastery('blacksmith3');
	bs *= game.global.highestLevelCleared + 1;
	let housing = 0;
	let fuel = 0;
	let time = 0;

	function tick(mult: number) {
		housing += mult * eff * sqrt(min(capa, fuel));
		fuel -= burn;
	}

	for (let zone = 230; zone <= max_zone; ++zone) {
		fuel += cells * (0.01 * min(zone, supply) - 2.1);

		let tick_time = ceil(60 / pow(accel, floor((zone - 230) / 3)));
		time += zone > bs ? 28 : zone > hs2 ? 20 : 15;
		while (time >= tick_time) {
			time -= tick_time;
			tick(1);
		}

		while (fuel > max_fuel)
			tick(overclock)

		housing *= 1.009;
	}

	while (fuel >= burn)
		tick(1);

	$("#dg").value = prettify(housing);
}

function read_save() {
	// Auto-fill for the lazy
	if (!localStorage.zone)
		$('#zone').value = game.stats.highestVoidMap.valueTotal || game.global.highestLevelCleared;
	let zone = input('zone');

	if (!localStorage.preset) {
		$$('#preset > *').forEach(function (option: HTMLOptionElement) {
			option.selected = parseInt(option.innerHTML.replace('z', '')) < game.global.highestLevelCleared;
		});
		auto_preset();
	}

	// let xp_ratio = 1 + game.global.bestFluffyExp / game.global.fluffyExp;
	// let he_ratio = 1 + game.global.bestHelium / game.global.totalHeliumEarned;
	// xp_ratio = log(xp_ratio) * input('weight-atk');
	// he_ratio = log(sqrt(he_ratio)) * (input('weight-atk') + input('weight-he')) +
		// log(he_ratio) / log(1.3) * log((1 + 0.25 / (1 + 0.25 * game.portal.Cunning.level)) * (1 + 0.6 / (1 + 0.6 * game.portal.Curious.level))) * input('weight-xp');
	// console.log("suggested XP weight:", input('weight-he') * xp_ratio / he_ratio);

	// He / unlocks
	let helium = game.global.heliumLeftover;
	for (let perk in game.portal)
		helium += game.portal[perk].heliumSpent;

	let unlocks = Object.keys(game.portal).filter(perk => !game.portal[perk].locked);
	if (!game.global.canRespecPerks)
		unlocks = unlocks.map(perk => perk + '>' + game.portal[perk].level);

	// Income
	let tt = mastery('turkimp4') ? 1 :
	         mastery('turkimp3') ? 0.6 :
	         mastery('turkimp2') ? 0.4 :
	         mastery('turkimp') ? 0.3 : 0.25;
	let prod = 1 + tt;
	let loot = 1 + 0.333 * tt;
	let spires = min(floor((zone - 101) / 100), game.global.spiresCompleted);
	loot *= zone < 100 ? 0.7 : 1 + (mastery('stillRowing') ? 0.3 : 0.2) * spires;

	let chronojest = 27 * game.unlocks.imps.Jestimp + 15 * game.unlocks.imps.Chronoimp;
	let cache = zone < 60 ? 0 : zone < 85 ? 7 : zone < 160 ? 10 : zone < 185 ? 14 : 20;
	chronojest += (mastery('mapLoot2') ? 5 : 4) * cache;

	for (let mod of (game.global.StaffEquipped.mods || [])) {
		if (mod[0] === 'MinerSpeed')
			prod *= 1 + 0.01 * mod[1];
		else if (mod[0] === 'metalDrop')
			loot *= 1 + 0.01 * mod[1];
	}

	// Fill the fields
	update_dg();
	$('#helium').value = helium + ($('#respec').checked ? 0 : game.resources.helium.owned);
	$('#unlocks').value = unlocks.join(',');
	$('#whipimp').checked = game.unlocks.imps.Whipimp;
	$('#magnimp').checked = game.unlocks.imps.Magnimp;
	$('#tauntimp').checked = game.unlocks.imps.Tauntimp;
	$('#venimp').checked = game.unlocks.imps.Venimp;
	$('#chronojest').value = prettify(chronojest);
	$('#prod').value = prettify(prod);
	$('#loot').value = prettify(loot);
	$('#breed-timer').value = prettify(mastery('patience') ? 45 : 30);
}

function parse_inputs() {
	let preset = $('#preset').value;

	if (preset == 'trapper' && (!game || game.global.challengeActive != 'Trapper'))
		throw 'This preset requires a save currently running Trapper². Start a new run using “Trapper² (initial)”, export, and try again.';

	let result = {
		he_left: input('helium'),
		zone: parseInt($('#zone').value),
		perks: parse_perks($('#fixed').value, $('#unlocks').value),
		weight: {
			helium: input('weight-he'),
			attack: input('weight-atk'),
			health: input('weight-hp'),
			xp: input('weight-xp'),
			trimps: 0,
			income: 0,
		},
		fluffy: {
			xp: game ? game.global.fluffyExp : 0,
			prestige: game ? game.global.fluffyPrestige : 0,
		},
		mod: {
			storage: 0.125,
			soldiers: 0,
			dg: preset == 'nerfed' ? 0 : input('dg'),
			tent_city: preset == 'tent',
			whip: $('#whipimp').checked,
			magn: $('#magnimp').checked,
			taunt: $('#tauntimp').checked,
			ven: $('#venimp').checked,
			chronojest: input('chronojest'),
			prod: input('prod'),
			loot: input('loot'),
			breed_timer: input('breed-timer'),
		}
	};

	if (preset == 'nerfed') {
		result.he_left = 1e8;
		result.zone = 200;
		result.mod.dg = 0;
	}

	if (preset == 'trapper') {
		result.mod.soldiers = game.resources.trimps.owned;
		result.mod.prod = 0;
		result.perks.Pheromones.max_level = 0;
		result.perks.Anticipation.max_level = 0;
	}

	if (preset == 'spire') {
		result.mod.prod = result.mod.loot = 0;
		result.perks.Overkill.max_level = 0;
		if (game)
			result.zone = game.global.world;
	}

	if (preset == 'carp') {
		result.mod.prod = result.mod.loot = 0;
		result.weight.trimps = 1e6;
	}

	if (preset == 'metal')
		result.mod.prod = 0;

	if (preset == 'trimp')
		result.mod.soldiers = 1;

	if (preset == 'nerfed')
		result.perks.Overkill.max_level = 1;
	
	if (preset == 'scientist')
		result.perks.Coordinated.max_level = 0;

	if (preset == 'income')
		result.weight = { income: 3, trimps: 3, attack: 1, helium: 0, health: 0, xp: 0 };

	let max_zone = game ? game.global.highestLevelCleared : 999;

	if (preset.match(/trimp|coord/) && result.zone >= max_zone - 100)
		show_alert('warning', 'Your target zone seems too high for this c², try lowering it.');

	if (preset == 'spire' && game && game.global.world != 100 * (2 + game.global.lastSpireCleared))
		show_alert('warning', 'This preset is meant to be used mid-run, when you’re done farming for the Spire.');

	return result;
}

function display(results: any) {
	let [he_left, perks] = results;
	let perk_size = game ? game.options.menu.smallPerks.enabled : 0;
	let size = $('#perks').clientWidth / (5 + perk_size);
	$('#test-text').innerText = `Level: ${prettify(12345678)} (+${prettify(1234567)})`;
	let level_text = size > $('#test-text').clientWidth ? 'Level: ' : '';

	$('#results').style.opacity = '1';
	$('#info').innerText = localStorage.more ? 'Less info' : 'More info';
	$('#he-left').innerHTML = prettify(he_left) + ' Helium Left Over';
	$('#perks').innerHTML = Object.keys(perks).filter(name => !perks[name].locked).map(name => {
		let {level, max_level} = perks[name];
		let diff = game ? level - game.portal[name].level : 0;
		let diff_text = diff ? ` (${diff > 0 ? '+' : '-'}${prettify(abs(diff))})` : '';
		let style = diff > 0 ? 'adding' : diff < 0 ? 'remove' : level >= max_level ? 'capped' : '';
		style += [' large', ' small', ' tiny'][perk_size];

		return `<div class='perk ${style} ${localStorage.more}'>`
			+ `<b>${name.replace('_', ' ')}</b><br>`
			+ `${level_text}<b>${prettify(level)}${diff_text}</b><br><span class=more>`
			+ `Price: ${level >= max_level ? '∞' : prettify(perks[name].cost)}<br>`
			+ `Spent: ${prettify(perks[name].spent())}</span></div>`;
	}).join('');

	for (let name in perks)
		perks[name] = perks[name].level;

	$('#perkstring').innerText = LZString.compressToBase64(JSON.stringify(perks));
}

document.addEventListener("DOMContentLoaded", validate_fixed, false);
document.addEventListener("DOMContentLoaded", auto_preset, false);

function main() {
	display(optimize(parse_inputs()));
}

function toggle_info() {
	localStorage.more = localStorage.more ? '' : 'more';
	$$('.perk').forEach((elem: HTMLElement) => elem.classList.toggle('more'));
	$('#info').innerText = localStorage.more ? 'Less info' : 'More info';
}

function parse_perks(fixed: string, unlocks: string) {
	const add = (x: number) => (level: number) => 1 + x * 0.01 * level;
	const mult = (x: number) => (level: number) => pow(1 + x * 0.01, level);

	let perks: {[key: string]: Perk} = {
		Looting_II:     new Perk(100e3, 10e3, add(0.25)),
		Carpentry_II:   new Perk(100e3, 10e3, add(0.25)),
		Motivation_II:  new Perk(50e3,  1e3,  add(1)),
		Power_II:       new Perk(20e3,  500,  add(1)),
		Toughness_II:   new Perk(20e3,  500,  add(1)),
		Capable:        new Perk(1e8,   0,    level => 1,    10,   10),
		Cunning:        new Perk(1e11,  0,    add(25)),
		Curious:        new Perk(1e14,  0,    add(60)),
		Overkill:       new Perk(1e6,   0,    add(500),  30),
		Resourceful:    new Perk(50e3,  0,    mult(-5)),
		Coordinated:    new Perk(150e3, 0,    mult(-2)),
		Siphonology:    new Perk(100e3, 0,    l => pow(1 + l, 0.1), 3),
		Anticipation:   new Perk(1000,  0,    add(6),    10),
		Resilience:     new Perk(100,   0,    mult(10)),
		Meditation:     new Perk(75,    0,    add(1),    7),
		Relentlessness: new Perk(75,    0,    l => 1 + 0.05 * l * (1 + 0.3 * l), 10),
		Carpentry:      new Perk(25,    0,    mult(10)),
		Artisanistry:   new Perk(15,    0,    mult(-5)),
		Range:          new Perk(1,     0,    add(1),    10),
		Agility:        new Perk(4,     0,    mult(-5),  20),
		Bait:           new Perk(4,     0,    add(100)),
		Trumps:         new Perk(3,     0,    add(20)),
		Pheromones:     new Perk(3,     0,    add(10)),
		Packrat:        new Perk(3,     0,    add(20)),
		Motivation:     new Perk(2,     0,    add(5)),
		Power:          new Perk(1,     0,    add(5)),
		Toughness:      new Perk(1,     0,    add(5)),
		Looting:        new Perk(1,     0,    add(5)),
	};

	if (!unlocks.match(/>/))
		unlocks = unlocks.replace(/(?=,|$)/g, '>0');

	for (let item of (unlocks + ',' + fixed).split(/,/).filter(x => x)) {
		let m = item.match(/(\S+) *([<=>])=?(.*)/);
		if (!m)
			throw 'Enter a list of perk levels, such as “power=42, toughness=51”.';

		let tier2 = m[1].match(/2$|II$/);
		let name = m[1].replace(/[ _]?(2|II)/i, '').replace(/^OK/i, 'O').replace(/^Looty/i, 'L');
		let regex = new RegExp(`^${name}[a-z]*${tier2 ? '_II' : ''}$`, 'i');
		let matches = Object.keys(perks).filter(p => p.match(regex));

		if (matches.length > 1)
			throw `Ambiguous perk abbreviation: ${m[1]}.`;
		if (matches.length < 1)
			throw `Unknown perk: ${m[1]}.`;

		let level = parse_suffixes(m[3]);
		if (!isFinite(level))
			throw `Invalid number: ${m[3]}.`;

		perks[matches[0]].locked = false;
		if (m[2] != '>')
			perks[matches[0]].max_level = level;
		if (m[2] != '<')
			perks[matches[0]].min_level = level;
	}

	return perks;
}

function optimize(params: any) {
	let {he_left, zone, fluffy, perks, weight, mod} = params;
	let {
		Looting_II, Carpentry_II, Motivation_II, Power_II, Toughness_II,
		Capable, Cunning, Curious,
		Overkill, Resourceful, Coordinated, Siphonology, Anticipation,
		Resilience, Meditation, Relentlessness, Carpentry, Artisanistry,
		Range, Agility, Bait, Trumps, Pheromones,
		Packrat, Motivation, Power, Toughness, Looting
	} = perks;

	for (let name in perks)
		if ((<any> name).endsWith('_II'))
			perks[name].pack = pow(10, max(0, floor(log(he_left) / log(100) - 4.2)));

	for (let name of ['whip', 'magn', 'taunt', 'ven'])
		mod[name] = pow(1.003, zone * 99 * 0.03 * mod[name]);

	const books = pow(1.25, zone) * pow(zone > 100 ? 1.28 : 1.2, max(zone - 59, 0));
	const gigas = max(0, min(zone - 60, zone/2 - 25, zone/3 - 12, zone/5, zone/10 + 17, 39));
	const base_housing = pow(1.25, min(zone / 2, 30) + gigas);
	const mystic = zone >= 25 ? floor(min(zone / 5, 9 + zone / 25, 15)) : 0;
	const tacular = (20 + zone - zone % 5) / 100;
	const base_income = 600 * mod.whip * books;
	const base_helium = pow(zone - 19, 2);
	const max_tiers = zone / 5 + +((zone - 1) % 10 < 5);
	const exponents = {
		cost: pow(1.069, 0.85 * (zone < 60 ? 57 : 53)),
		attack: pow(1.19, 13),
		health: pow(1.19, 14),
		block: pow(1.19, 10),
	};
	const equip_cost = {
		attack: 211 * (weight.attack + weight.health) / weight.attack,
		health: 248 * (weight.attack + weight.health) / weight.health,
		block:    5 * (weight.attack + weight.health) / weight.health,
	};

	// Number of ticks it takes to one-shot an enemy.
	function ticks() {
		return 1 + +(Agility.bonus > 0.9) + ceil(10 * Agility.bonus);
	}

	const moti = () => Motivation.bonus * Motivation_II.bonus;
	const looting = () => Looting.bonus * Looting_II.bonus;

	function income(ignore_prod?: boolean) {
		let storage = mod.storage * Resourceful.bonus / Packrat.bonus;
		let loot = looting() * mod.magn / ticks();
		let prod = ignore_prod ? 0 : moti() * Meditation.bonus * mod.prod;
		let chronojest = mod.chronojest * 0.1 * prod * loot;
		return base_income * (prod + loot * mod.loot + chronojest) * (1 - storage);
	}

	// Max population
	const trimps = mod.tent_city ? () => {
		let carp = Carpentry.bonus * Carpentry_II.bonus;
		let territory = Trumps.bonus;
		return 10 * (mod.taunt + territory * (mod.taunt - 1) * 111) * carp;
	} : () => {
		let carp = Carpentry.bonus * Carpentry_II.bonus;
		let bonus = 3 + max(log(income() / base_income * carp / Resourceful.bonus), 0);
		let territory = Trumps.bonus * zone;
		return 10 * (base_housing * bonus + territory) * carp * mod.taunt + mod.dg * carp;
	};

	function equip(stat: "attack" | "health" | "block") {
		let cost = equip_cost[stat] * Artisanistry.bonus;
		let levels = 1.136;
		let tiers = log(1 + income() * trimps() / cost) / log(exponents.cost);

		if (tiers > max_tiers + 0.45) {
			levels = log(1 + pow(exponents.cost, tiers - max_tiers) * 0.2) / log(1.2);
			tiers = max_tiers;
		}
		return levels * pow(exponents[stat], tiers);
	}

	// Number of buildings of a given kind that can be built with the current income.
	// cost: base cost of the buildings
	// exp: cost increase for each new level of the building
	function building(cost: number, exp: number) {
		cost *= 4 * Resourceful.bonus;
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
		let potency = 0.0085 * (zone >= 60 ? 0.1 : 1) * pow(1.1, floor(zone / 5));
		return potency * pow(1.01, nurseries) * Pheromones.bonus * mod.ven;
	}

	// Number of Trimps sent at a time, pre-gators
	let group_size: number[] = [];

	for (let coord = 0; coord <= log(1 + he_left / 500e3) / log(1.3); ++coord) {
		let ratio = 1 + 0.25 * pow(0.98, coord);
		let available_coords = zone - 1 + (magma() ? 100 : 0);
		let result = 1;
		for (let i = 0; i < available_coords; ++i)
			result = ceil(result * ratio);
		group_size[coord] = result;
	}

	// Strength multiplier from coordinations
	function soldiers() {
		let ratio = 1 + 0.25 * Coordinated.bonus;
		let pop = (mod.soldiers || trimps()) / 3;
		if (mod.soldiers > 1)
			pop += 36000 * Bait.bonus;
		let unbought_coords = max(0, log(group_size[Coordinated.level] / pop) / log(ratio));
		return group_size[0] * pow(1.25, -unbought_coords);
	}

	// Fracional number of Amalgamators expected
	function gators() {
		if ((game && game.global.version < 4.8) || zone < 230 || mod.soldiers > 1)
			return 0;

		let ooms = log(trimps() / group_size[Coordinated.level]) / log(10);
		return max(0, (ooms - 7 + floor((zone - 215) / 100)) / 3);
	}

	// Total attack
	function attack() {
		let attack = (0.15 + equip('attack')) * pow(0.8, magma());
		attack *= Power.bonus * Power_II.bonus * Relentlessness.bonus;
		attack *= Siphonology.bonus * Range.bonus * Anticipation.bonus;
		attack *= fluffy.attack[Capable.level];
		attack *= 1 + 0.5 * gators();
		return soldiers() * attack;
	}

	// Total survivability (accounts for health and block)
	function health() {
		let health = (0.6 + equip('health')) * pow(0.8, magma());
		health *= Toughness.bonus * Toughness_II.bonus * Resilience.bonus;

		// block
		let gyms = building(400, 1.185);
		let trainers = (gyms * log(1.185) - log(1 + gyms)) / log(1.1) + 25 - mystic;
		let block = 0.04 * gyms * pow(1 + mystic / 100, gyms) * (1 + tacular * trainers);

		// target number of attacks to survive
		let attacks = 60;

		if (zone < 70) { // no geneticists
			// number of ticks needed to repopulate an army
			let timer = log(1 + soldiers() * breed() / Bait.bonus) / log(1 + breed());
			attacks = timer / ticks();
		}

		else { // geneticists
			let fighting = min(group_size[Coordinated.level] / trimps(), 1 / 3);
			let target_speed = fighting > 1e-9 ?
				(pow(0.5 / (0.5 - fighting), 0.1 / mod.breed_timer) - 1) * 10 :
				fighting / mod.breed_timer;
			let geneticists = log(breed() / target_speed) / -log(0.98);
			health *= pow(1.01, geneticists);
			health *= pow(1.332, gators());
		}

		health /= attacks;
		if (zone < 60)
			block += equip('block');
		else
			block = min(block, 4 * health);

		return soldiers() * (block + health);
	}

	const xp = () => Cunning.bonus * Curious.bonus;
	const agility = () => 1 / Agility.bonus;
	const helium = () => base_helium * looting() + 45;
	const overkill = () => Overkill.bonus;

	const stats: {[key: string]: () => number} = { agility, helium, xp, attack, health, overkill, trimps, income };

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

	function recompute_marginal_efficiencies() {
		let baseline = score();

		for (let name in perks) {
			let perk = perks[name];
			if (perk.cost_increment || !perk.levellable(he_left))
				continue;
			perk.level_up(1);
			perk.gain = score() - baseline;
			perk.level_up(-1);
		}

		for (let name of ['Looting', 'Carpentry', 'Motivation', 'Power', 'Toughness'])
			perks[name + '_II'].gain = perks[name].gain * perks[name + '_II'].log_ratio() / perks[name].log_ratio();
	}

	function solve_quadratic_equation(a: number, b: number, c: number): number {
		let delta = b * b - 4 * a * c;
		return (-b + sqrt(delta)) / (2 * a);
	}

	function spend_he(perk: Perk, budget: number) {
		perk.gain /= perk.log_ratio();

		if (perk.cost_increment) {
			let ratio = (1 + perk.level) / (1 + Looting_II.level + Carpentry_II.level + Motivation_II.level + Power_II.level + Toughness_II.level);
			budget *= 0.5 * ratio ** 2;
			let x = solve_quadratic_equation(perk.cost_increment / 2, perk.cost - perk.cost_increment / 2, -budget);
			he_left -= perk.level_up(floor(max(min(x, perk.max_level - perk.level), 1, perk.level / 1e12)));
		}
		else {
			budget **= 0.5;
			do he_left -= perk.level_up(1);
				while (perk.cost < budget && perk.level < perk.max_level)
		}

		perk.gain *= perk.log_ratio();
	}

	mod.loot *= 20.8; // TODO: check that this is correct
	weight.agility = (weight.helium + weight.attack) / 2;
	weight.overkill = 0.25 * weight.attack * (2 - pow(0.9, weight.helium / weight.attack));

	if (zone > 90 && mod.soldiers <= 1 && Bait.min_level == 0)
		Bait.max_level = 0;

	// Fluffy
	fluffy.attack = [];
	let potential = log(0.003 * fluffy.xp / pow(5, fluffy.prestige) + 1) / log(4);
	for (let cap = 0; cap <= 10; ++cap) {
		let level = min(floor(potential), cap);
		let progress = level == cap ? 0 : (pow(4, potential - level) - 1) / 3;
		fluffy.attack[cap] = 1 + pow(5, fluffy.prestige) * 0.1 * (level / 2 + progress) * (level + 1);
	}

	if (zone > 300 && weight.xp > 0) {
		let ratio = 0.25;
		while (Capable.level < Capable.max_level && Capable.cost < he_left * ratio) {
			he_left -= Capable.level_up(1);
			ratio = Capable.level <= floor(potential) ? 0.25 : 0.01;
		}
	}

	if (zone <= 300 || potential >= Capable.level)
		weight.xp = 0;
	
	// Minimum levels on perks
	for (let name in perks) {
		let perk = perks[name];
		if (perk.cost_increment)
			he_left -= perk.level_up(perk.min_level);
		else while (perk.level < perk.min_level)
			he_left -= perk.level_up(1);
	}

	if (he_left < 0)
		throw (game && game.global.canRespecPerks) ?
			"You don’t have enough Helium to afford your Fixed Perks." :
			"You don’t have a respec available.";

	// Main loop
	let sorted_perks: Perk[] = Object.keys(perks).map(name => perks[name]).filter(perk => perk.levellable(he_left));

	for (let x = 0.999; x; x *= x) {
		let he_target = he_left * x;
		recompute_marginal_efficiencies();
		sorted_perks.sort((a, b) => b.gain / b.cost - a.gain / a.cost);

		while (he_left > he_target && sorted_perks.length) {
			let best = sorted_perks.shift()!;
			if (!best.levellable(he_left))
				continue;

			spend_he(best, he_left - he_target);

			// sorted_perks.splice(sorted_perks.findIndex(p => p.gain / p.cost > best.gain / best.cost), 0, best);
			let i = 0;
			while (sorted_perks[i] && sorted_perks[i].gain / sorted_perks[i].cost > best.gain / best.cost)
				i++;
			sorted_perks.splice(i, 0, best);
		}
	}

	return [he_left, perks];
}
