/// <reference path="./trimps.ts"/>

let death_stuff = {
	max_hp: 1e300,
	block: 0,
	challenge_attack: 1,
	enemy_cd: 1,
	breed_timer: 300,
	weakness: 0,
	plague: 0,
	bleed: 0,
	explosion: 0,
	nom: false,
	slow: false,
}

function read_save() {
	let imps = 0;
	for (let imp of ['Chronoimp', 'Jestimp', 'Titimp', 'Flutimp', 'Goblimp'])
		imps += game.unlocks.imps[imp];
	let shield = game.heirlooms.Shield;
	let challenge = game.global.challengeActive;
	let attack = game.global.soldierCurrentAttack * (1 + shield.trimpAttack.currentBonus / 100);
	let cc = 5 * game.portal.Relentlessness.level + shield.critChance.currentBonus;
	let cd = 100 + 30 * game.portal.Relentlessness.level + shield.critDamage.currentBonus;
	let megaCD = 5;
	let minFluct = 0.8 + 0.02 * game.portal.Range.level;
	let maxFluct = 1.2;
	let enemyHealth = 1;
	let enemyAttack = 1;
	let zone = game.global.world;
	let perfect = game.global.highestLevelCleared >= 109;
	let nature = game.empowerments[['Poison', 'Wind', 'Ice'][ceil(zone / 5) % 3]];
	let diplomacy = mastery('nature3') ? 5 : 0;
	let speed = 10 * 0.95 ** game.portal.Agility.level - mastery('hyperspeed');

	death_stuff = {
		max_hp: game.global.soldierHealthMax,
		block: game.global.soldierCurrentBlock,
		challenge_attack: 1,
		enemy_cd: 1,
		breed_timer: compute_breed_timer(),
		weakness: 0,
		plague: 0,
		bleed: 0,
		explosion: 0,
		nom: challenge === "Nom",
		slow: challenge === "Slow",
	}

	if (mastery('hyperspeed2') && zone <= ceil(game.global.highestLevelCleared / 2) || jobless)
		--speed;

	attack *= 1 + 0.02 * game.global.antiStacks * game.portal.Anticipation.level;
	attack *= 1 + 0.01 * game.global.achievementBonus;
	attack *= 1 + 0.2 * game.global.roboTrimpLevel;
	attack *= 1 + game.goldenUpgrades.Battle.currentBonus;
	attack *= 1 + 0.01 * game.global.totalSquaredReward;
	attack /= [1, 0.5, 4, 0.5, 0.5][game.global.formation];

	// Fluffy
	let cap = game.portal.Capable.level;
	let prestige = game.global.fluffyPrestige;
	let potential = log(0.003 * game.global.fluffyExp / 5 ** prestige + 1) / log(4);
	let level = min(floor(potential), cap);
	let progress = level == cap ? 0 : (4 ** (potential - level) - 1) / 3;
	let fluffy_ability = prestige + level + mastery('fluffyAbility');
	attack *= 1 + 5 ** prestige * 0.1 * (level / 2 + progress) * (level + 1);

	let ok_spread = 1 + +(fluffy_ability >= 13) + +(fluffy_ability >= 10) + mastery('overkill');

	if (fluffy_ability >= 14)
		cc += 50;

	if (fluffy_ability >= 15)
		megaCD += 2;

	if (game.global.sugarRush > 0)
		attack *= floor(zone / 100);

	if (game.singleRunBonuses.sharpTrimps.owned)
		attack *= 1.5;

	if (mastery('stillRowing2'))
		attack *= 1 + 0.06 * game.global.spireRows;

	if (mastery('magmamancer')) {
		let time = (new Date().getTime() - game.global.zoneStarted) / 60000;
		let bonus = 1.2 ** min(12, floor((time + 5) / 10)) - 1;
		attack *= 1 + 3 * (1 - 0.9999 ** game.jobs.Magmamancer.owned) * bonus;
	}

	if (mastery('healthStrength')) {
		let effective_zone = min(zone, game.global.lastSpireCleared * 100 + 199);
		let cells = effective_zone < 300 ? 0 : floor((effective_zone - 270) / 15);
		attack *= 1 + 0.15 * cells;
	}

	if (mastery('amalg'))
		attack *= 1.5 ** game.jobs.Amalgamator.owned;
	else
		attack *= 1 + 0.5 * game.jobs.Amalgamator.owned;

	if (mastery('crit')) {
		megaCD += 1;
		cc += 0.5 * shield.critChance.currentBonus;
	}

	if (challenge === "Discipline") {
		minFluct = 0.005;
		maxFluct = 1.995;
	} else if (challenge === "Balance") {
		enemyHealth *= 2;
		enemyAttack *= 2.35;
	} else if (challenge === "Meditate") {
		enemyHealth *= 2;
		enemyAttack *= 1.5;
	} else if (challenge === "Electricity") {
		death_stuff.weakness = 0.1;
		death_stuff.plague = 0.1;
	} else if (challenge === "Daily") {
		if (mastery('daily'))
			attack *= 1.5;

		let daily = (mod: string) => game.global.dailyChallenge[mod] ? game.global.dailyChallenge[mod].strength : 0;
		if (zone % 2 == 1)
			attack *= 1 - 0.02 * daily('oddTrimpNerf');
		else
			attack *= 1 + 0.2 * daily('evenTrimpBuff');
		attack *= 1 + 0.1 * ceil(daily('rampage') / 10) * (1 + daily('rampage') % 10);
		cc += 10 * daily('trimpCritChanceUp');
		cc -= 10 * daily('trimpCritChanceDown');
		minFluct -= daily('minDamage') ? 0.09 + 0.01 * daily('minDamage') : 0;
		maxFluct += daily('maxDamage');
		enemyHealth *= 1 + 0.2 * daily('badHealth');
		enemyHealth *= 1 + 0.3 * daily('badMapHealth');
		enemyAttack *= 1 + 0.2 * daily('badStrength');
		enemyAttack *= 1 + 0.3 * daily('badMapStrength');

		death_stuff.plague = 0.01 * daily('plague');
		death_stuff.bleed = 0.01 * daily('bogged');
		death_stuff.weakness = 0.01 * daily('weakness');
		death_stuff.enemy_cd = 1 + 0.5 * daily('crits');
		death_stuff.explosion = daily('explosive');
	} else if (challenge === "Life") {
		enemyHealth *= 11;
		enemyAttack *= 6;
		attack *= 1 + 0.1 * game.challenges.Life.stacks;
		death_stuff.max_hp *= 1 + 0.1 * game.challenges.Life.stacks;
	} else if (challenge === "Crushed") {
		death_stuff.enemy_cd = 5;
	} else if (challenge === "Nom") {
		death_stuff.bleed = 0.05;
	} else if (challenge === "Toxicity") {
		enemyHealth *= 2;
		enemyAttack *= 5;
		death_stuff.bleed = 0.05;
	} else if (challenge === "Lead") {
		if (zone % 2 == 1)
			attack *= 1.5;
		else
			show_alert('warning', 'Are you <b>sure</b> you want to farm on an even Lead zone?');
		enemyHealth *= 1 + 0.04 * game.challenges.Lead.stacks;
		enemyAttack *= 1 + 0.04 * game.challenges.Lead.stacks;
	} else if (challenge === "Corrupted") {
		// Corruption scaling doesn’t apply to normal maps below Corrupted’s endpoint
		enemyAttack *= 3;
	} else if (challenge === "Obliterated") {
		enemyHealth *= 10 ** (12 + floor(zone / 10));
		enemyAttack *= 10 ** (12 + floor(zone / 10));
	}

	// Handle megacrits
	attack *= cc >= 100 ? (1 + cd / 100) * megaCD ** (floor(cc / 100) - 1) : megaCD ** (floor(cc / 100));
	cd = cc >= 100 ? (megaCD - 1) * 100 : cd;
	cc %= 100;

	$('#attack').value = prettify(attack * minFluct);
	$('#cc').value = cc;
	$('#cd').value = cd;
	$('#challenge').value = prettify(enemyHealth);
	$('#coordinate').checked = challenge === "Coordinate";
	$('#difficulty').value = prettify((perfect ? 75 : 80) + (challenge === "Mapocalypse" ? 300 : 0));
	$('#fragments').value = prettify(game.resources.fragments.owned);
	$('#hze').value = prettify(game.global.highestLevelCleared + 1);
	$('#imports').value = prettify(imps);
	$('#nature').value = zone >= 236 ? nature.level + diplomacy : 0;
	$('#ok_spread').value = prettify(ok_spread);
	$('#overkill').value = game.portal.Overkill.level;
	$('#plaguebringer').value = shield.plaguebringer.currentBonus;
	$('#range').value = prettify(maxFluct / minFluct);
	$('#reducer').checked = mastery('mapLoot');
	$('#size').value = prettify(mastery('mapLoot2') ? 20 : perfect ? 25 : 27);
	$('#speed').value = prettify(speed);
	$('#titimp').checked = game.unlocks.imps.Titimp;
	$('#transfer').value = zone >= 236 ? nature.retainLevel + diplomacy : 0;
	$('#zone').value = zone;

	death_stuff.challenge_attack = enemyAttack;
}

const parse_inputs = () => ({
	attack: input('attack'),
	biome: biomes.all.concat(biomes[$('#biome').value]),
	cc: input('cc') / 100,
	cd: 1 + input('cd') / 100,
	challenge_health: input('challenge'),
	coordinate: $('#coordinate').checked,
	difficulty: input('difficulty') / 100,
	fragments: input('fragments'),
	hze: input('hze'),
	import_chance: input('imports') * 0.03,
	ok_spread: input('ok_spread'),
	overkill: input('overkill') * 0.005,
	plaguebringer: input('plaguebringer') * 0.01,
	range: input('range') - 1,
	reducer: $('#reducer').checked,
	size: input('size'),
	speed: input('speed'),
	titimp: $('#titimp').checked,
	transfer: input('transfer') / 100,
	zone: input('zone'),
	poison: 0, wind: 0, ice: 0,
	[['poison', 'wind', 'ice'][ceil(input('zone') / 5) % 3]]: input('nature') / 100,

	...death_stuff
});

// Return info about the best zone for each stance
function get_best(stats: any[], stances: string) {
	let best: any = { overall: "", stance: "", second: "", second_stance: "", ratio: 0 };

	/* jshint loopfunc:true */
	for (let stance of stances) {
		stats.sort((a, b) => b[stance].value - a[stance].value);
		best[stance] = stats[0].zone;
	}

	stats.sort((a, b) => b.value - a.value);
	best.overall = stats[0].zone;
	best.stance = stats[0].stance;
	if (stats[1]) {
		best.second = stats[1].zone;
		best.second_stance = stats[1].stance;
		best.ratio = stats[0].value / stats[1].value;
	}

	return best;
}

function display(results: any[]) {
	let [stats, stances] = results;

	if (stats.length === 0)
		throw 'Your attack is too low to farm anywhere.';

	let best = get_best(stats.slice(), stances);
	let show_stance = input('zone') >= 60;
	let html = '';

	if (stances.length > 1)
		html += `<tr><th colspan=2>${stances.replace(/(?!$)/g, '<th colspan=2>')}</tr>`;
	html += '<tr><th>Level<th>Base loot';
	for (let _ of stances)
		html += '<th>Cells/s<th>Total';

	for (let zone_stats of stats) {
		let zone = zone_stats.zone;
		html += '</tr><tr><td class=align-right>';

		for (let stance of stances)
			if (zone === best[stance] && show_stance)
				html += `<b>${stance}</b> `;

		html += zone === best.overall ? `<b>${zone}</b>` : zone;
		html += '<td>' + prettify(zone_stats.loot) + '%';

		for (let stance of stances) {
			let value = prettify(zone_stats[stance].value);
			html += '<td>' + zone_stats[stance].speed.toFixed(3) + '<td>';
			html += zone === best[stance] ? `<b>${value}</b>` : value;
		}
	}

	$('#details').innerHTML = html + '</tr>';
	$('#results').style.opacity = '1';

	if (show_stance) {
		best.overall += ' in ' + best.stance;
		best.second += ' in ' + best.second_stance;
	}

	if (stats.length == 1) {
		if (input('zone') % 100 === 0 && input('zone') > 100) {
			$('#result').textContent = 'You should definitely farm on ' + best.overall;
			$('#comment').textContent = 'Good luck with the Spire!';
		} else {
			$('#result').textContent = 'You should really be pushing rather than farming';
			$('#comment').textContent = '';
		}
		return;
	}

	let percentage = (best.ratio - 1) * 100;
	let adverb = ["", " probably", "", " really", " definitely"][min(floor(percentage / 2), 4)];

	$('#result').textContent = `You should ${adverb} farm on ${best.overall}`;
	if (percentage < 2)
		$('#result').textContent += ` or ${best.second}`;

	$('#comment').textContent = percentage < 2 ? `They’re equally efficient.` :
		percentage < 4 ? `But ${best.second} is almost as good.` :
		`It’s ${percentage.toFixed(1)}% more efficient than ${best.second}.`;
}

function main() {
	display(stats(parse_inputs()));
}

///
// Start back-end stuff
///

const max_ticks = 864000; // One day

let test: number[] = [1, 2];

const biomes: {[key: string]: [number, number, boolean][]} = {
	all: [
		[0.8,  0.7,  true],
		[0.9,  1.3,  false],
		[0.9,  1.3,  false],
		[1,    1,    false],
		[1.1,  0.7,  false],
		[1.05, 0.8,  true],
		[0.9,  1.1,  true],
	],
	gardens: [
		[1.3,  0.95, false],
		[0.95, 0.95, true],
		[0.8,  1,    false],
		[1.05, 0.8,  false],
		[0.6,  1.3,  true],
		[1,    1.1,  false],
		[0.8,  1.4,  false],
	],
	sea: [
		[0.8,  0.9,  true],
		[0.8,  1.1,  true],
		[1.4,  1.1,  false],
	],
	mountain: [
		[0.5,  2,    false],
		[0.8,  1.4,  false],
		[1.15, 1.4,  false],
		[1,    0.85, true],
	],
	forest: [
		[0.75, 1.2,  true],
		[1,    0.85, true],
		[1.1,  1.5,  false],
	],
	depths: [
		[1.2,  1.4,  false],
		[0.9,  1,    true],
		[1.2,  0.7,  false],
		[1,    0.8,  true],
	],
};

let seed = 42;
const rand_mult = 2 ** -31;
function rng() {
	seed ^= seed >> 11;
	seed ^= seed << 8;
	seed ^= seed >> 19;
	return seed * rand_mult;
}


// Simulate farming at the given zone for a fixed time, and return the number cells cleared.
function simulate(g: any, zone: number) {
	let trimp_hp = g.max_hp;
	let debuff_stacks = 0;
	let titimp = 0;
	let cell = 0;
	let loot = 0;
	let last_group_sent = 0;
	let ticks = 0;
	let plague_damage = 0;
	let ok_damage = 0, ok_spread = 0;
	let poison = 0, wind = 0, ice = 0;

	let hp_array = [], atk_array = [];

	for (let i = 0; i < g.size; ++i) {
		let hp = 14.3 * sqrt(zone * 3.265 ** zone) - 12.1;
		hp *= zone < 60 ? (3 + (3 / 110) * cell) : (5 + 0.08 * cell) * 1.1 ** (zone - 59);
		if (g.zone >= 230)
			hp *= round(50 * 1.05 ** floor((g.zone - 150) / 6)) / 10;

		// hackish implementation of BM 2, TODO a better one
		if (game && mastery('bionic2') && zone > g.zone)
			hp /= 1.5;

		hp_array.push(g.difficulty * g.challenge_health * hp);

		let atk = 5.5 * sqrt(zone * 3.27 ** zone) - 1.1;
		atk *= zone < 60 ? (3.1875 + 0.0595 * cell) : (4 + 0.09 * cell) * 1.15 ** (zone - 59);
		if (g.zone >= 230)
			atk *= round(15 * 1.05 ** floor((g.zone - 150) / 6)) / 10;
		atk_array.push(g.difficulty * g.challenge_attack * atk);
	}

	function enemy_hit(atk: number) {
		let damage = atk * (0.8 + 0.4 * rng());
		damage *= rng() < 0.25 ? g.enemy_cd : 1;
		damage *= 0.366 ** (ice * g.ice);
		trimp_hp -= max(0, damage - g.block);
		++debuff_stacks;
	}

	while (ticks < max_ticks) {
		let imp = rng();
		let imp_stats = imp < g.import_chance ? [1, 1, false] : g.biome[floor(rng() * g.biome.length)];
		let atk = imp_stats[0] * atk_array[cell];
		let hp = imp_stats[1] * hp_array[cell];
		let enemy_max_hp = hp;
		let fast = g.slow || (imp_stats[2] && !g.nom);

		if (ok_spread !== 0) {
			hp -= ok_damage;
			--ok_spread;
		}
		hp = min(hp, max(enemy_max_hp * 0.05, hp - plague_damage));
		plague_damage = 0;

		let turns = 0;
		while (hp >= 1 && ticks < max_ticks) {
			++turns;

			// Fast enemy attack
			if (fast)
				enemy_hit(atk);

			// Trimp attack
			if (trimp_hp >= 1) {
				ok_spread = g.ok_spread;
				let damage = g.atk * (1 + g.range * rng());
				damage *= rng() < g.cc ? g.cd : 1;
				damage *= titimp > ticks ? 2 : 1;
				damage *= 2 - 0.366 ** (ice * g.ice);
				damage *= 1 - g.weakness * min(debuff_stacks, 9);
				hp -= damage + poison * g.poison;
				poison += damage;
				++ice;
				if (hp >= 1)
					plague_damage += damage * g.plaguebringer;
			}

			// Bleeds
			trimp_hp -= g.bleed * g.max_hp;
			trimp_hp -= debuff_stacks * g.plague * g.max_hp;

			// Slow enemy attack
			if (!fast && hp >= 1 && trimp_hp >= 1)
				enemy_hit(atk);

			// Trimp death
			if (trimp_hp < 1) {
				ticks += ceil(turns * g.speed);
				ticks = max(ticks, last_group_sent + g.breed_timer);
				last_group_sent = ticks;
				trimp_hp = g.max_hp;
				ticks += 1;
				turns = 1;
				debuff_stacks = 0;

				if (g.nom)
					hp = min(hp + 0.05 * enemy_max_hp, enemy_max_hp);
			}
		}

		if (g.explosion && (g.explosion <= 15 || g.block >= g.max_hp))
			trimp_hp -= max(0, g.explosion * atk - g.block);

		wind = min(wind + turns, 200);
		loot += 1 + wind * g.wind;
		ok_damage = -hp * g.overkill;
		ticks += +(turns > 0) + +(g.speed > 9) + ceil(turns * g.speed);
		if (g.titimp && imp < 0.03)
			titimp = min(max(ticks, titimp) + 300, ticks + 450);

		poison = ceil(g.transfer * poison + plague_damage) + 1;
		wind = ceil(g.transfer * wind) + 1 + ceil((turns - 1) * g.plaguebringer);
		ice = ceil(g.transfer * ice) + 1 + ceil((turns - 1) * g.plaguebringer);

		++cell;
		if (cell == g.size) {
			cell = 0;
			plague_damage = 0;
			ok_damage = 0;
		}
	}

	return loot * 10 / max_ticks;
}

// Return efficiency stats for the given zone
function zone_stats(zone: number, stances: string, g: any) {
	let result: any = {
		zone: 'z' + zone,
		value: 0,
		stance: '',
		loot: 100 * (zone < g.zone ? 0.8 ** (g.zone - g.reducer - zone) : 1.1 ** (zone - g.zone)),
	};

	for (let stance of stances) {
		g.atk = g.attack * (stance == 'D' ? 4 : stance == 'X' ? 1 : 0.5);
		let speed = simulate(g, zone);
		let value = speed * result.loot * (stance == 'S' ? 2 : 1);
		result[stance] = { speed, value };

		if (value > result.value) {
			result.value = value;
			result.stance = stance;
		}
	}

	return result;
}

function map_cost(mods: number, level: number) {
	mods += level;
	return mods * 1.14 ** mods * level * (1.03 + level / 50000) ** level / 42.75;
}

function compute_breed_timer(): number {
	let potency = game.resources.trimps.potency * 0.1;
	potency *= 1.1 ** game.upgrades.Potency.done;
	potency *= 1.01 ** game.buildings.Nursery.owned;
	potency *= 0.98 ** game.jobs.Geneticist.owned;
	potency *= 1.003 ** game.unlocks.impCount.Venimp;
	potency *= 1 + 0.1 * game.portal.Pheromones.level;
	if (game.global.brokenPlanet)
		potency *= 0.1;
	if (game.singleRunBonuses.quickTrimps.owned)
		potency *= 2;

	let army_size = 1;
	for (let i = 0; i < game.upgrades.Coordination.done; ++i)
		army_size = ceil(army_size * (1 + 0.25 * 0.98 ** game.portal.Coordinated.level));
	army_size *= 1000 ** game.jobs.Amalgamator.owned;

	let breeders = game.resources.trimps.max * game.resources.trimps.maxMod;
	breeders *= 1.1 ** game.portal.Carpentry.level;
	breeders *= 1 + 0.0025 * game.portal.Carpentry_II.level;
	for (let job of game.jobs)
		breeders -= game.jobs[job].owned;

	return ceil(log(breeders / (breeders - army_size)) / log(1 + potency));
}

// Return a list of efficiency stats for all sensible zones
function stats(g: any) {
	let stats = [];
	let stances = (g.zone < 70 ? 'X' : 'D') + (g.hze >= 181 && g.zone >= 60 ? 'S' : '');

	console.time();

	let extra = 0;
	if (g.hze >= 210)
		while (extra < 10 && g.fragments > map_cost(53.98 + 10 * extra, g.zone))
			++extra;
	extra = extra || -g.reducer;

	for (let zone = g.zone + extra; zone >= 6; --zone) {
		if (g.coordinate) {
			let coords = 1;
			for (let z = 1; z < zone; ++z)
				coords = ceil(1.25 * coords);
			g.challenge_health = coords;
			g.challenge_attack = coords;
		}
		let tmp = zone_stats(zone, stances, g);
		if (tmp.value < 1 && zone >= g.zone)
			continue;
		if (stats.length && tmp.value < 0.804 * stats[0].value)
			break;
		stats.unshift(tmp);
	}

	console.timeEnd();

	return [stats, stances];
}
