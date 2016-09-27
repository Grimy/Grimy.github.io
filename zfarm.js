var cells = 10000;
var seed;

var biomes = {
	all: [.7, 1.3, 1.3, 1, .7, .8, 1.1],
	gardens: [.95, .95, 1, .8, 1.3, 1.1, 1.4],
	sea: [.9, 1.1, 1.1],
	mountain: [2, 1.4, 1.4],
	forest: [1.2, 1.5],
	depths: [1, .7, 1.4, .8],
};

Array.prototype.max = function() { return Math.max.apply(null, this) };

function rng() {
	seed ^= seed >> 11;
	seed ^= seed << 8;
	seed ^= seed >> 19;
	return seed / 2147483648;
}

/*
function enemy_atk(zone, cell) {
	var amt = 5.5 * Math.sqrt(zone * Math.pow(3.27, zone)) - 1.1;
	amt *= zone < 60 ? (3.1875 + .0595 * cell) : (4 + .09 * cell) * Math.pow(1.15, zone - 59);
	return amt;
}
*/

// Compute the base HP (ignoring difficulty and imp modifiers) for an enemy
// at the given position (zone + cell).
function enemy_hp(zone, cell) {
	var amt = 14.3 * Math.sqrt(zone * Math.pow(3.265, zone)) - 12.1;
	amt *= zone < 60 ? (3 + (3 / 110) * cell) : (5 + .08 * cell) * Math.pow(1.1, zone - 59);
	return amt;
}

// Pick an element at random in the givel array.
function pick(list) {
	return list[Math.floor(rng() * list.length)];
}

// Simulate farming at the given zone, and return the number of ticks it takes.
function simulate(zone, g) {
	var ticks = 0;
	var buff = 0;
	var ok_dmg = 0;
	seed = 1;

	for (var i = 0; i < cells; ++i) {
		var imp = rng();
		var toughness = imp < g.import_chance ? 1 : pick(g.biome);
		var hp = g.difficulty * toughness * enemy_hp(zone, i % g.size);
		var turns = 0;

		hp -= Math.min(ok_dmg, hp);
		if (hp >= 1)
			ticks += Math.ceil(.115 * g.agility) ;

		while (hp >= 1) {
			++turns;
			var crit = rng() < g.cc ? g.cd : 1;
			hp -= g.atk * (1 + g.range * rng()) * crit * (buff ? 2 : 1);
			buff -= buff > 0;
		}

		ok_dmg = -hp * g.overkill;
		ticks += Math.ceil(turns * g.agility) - turns * g.hyperspeed;
		if (g.titimp && imp < .03)
			buff = Math.min(buff + 30, 45);
	}

	return ticks;
}

// Computes informations about 
function stats(g) {
	console.log(g.agility);

	var zone = 6;
	while (g.atk >= g.difficulty * g.biome.max() * enemy_hp(zone + 1, g.size - 1))
		++zone;

	var infos = [0, 1, 2, 3].map((i) => ({
		zone: zone + i,
		ticks: simulate(zone + i, g),
		loot: 100 * Math.pow(1.25, i),
	}));

	// Test for gardens
	infos.max_loot = g.biome.indexOf(.95) > 0 ? 160 : 185;
	return infos;
}

function display(infos) {
	var table = '';

	for (var i = 0; i < 4; ++i) {
		var cps = cells * 10 / infos[i].ticks;
		infos[i].value = cps * infos[i].loot;
		table += '<p>z' + infos[i].zone + ': ' + infos[i].loot.toFixed(1) + '% loot at ' + cps.toFixed(3) + ' cells/s (blah % better/worse).';
	}

	var one_shot = 'The highest zone where you one-shot everything is <b>z' + infos[0].zone + '</b>.' ;

	infos.sort((a, b) => b.value - a.value);

	var best = infos[0].zone;
	var second = infos[1].zone;
	var ratio = infos[0].value / infos[1].value;
	var percent = ((ratio - 1) * 100).toFixed(1);
	var loot_diff = Math.ceil(infos.max_loot * (1 - 1 / ratio));
	var adverbs = ["", "", " probably", " probably", " probably", " probably",
		" probably", "", "", "", " really", " really", " definitely"]

	var result = '<b>You should' + adverbs[Math.min(loot_diff, 12)] + ' farm on z' + best;
	result += 
		loot_diff <= 1 ? ' or z' + second + '.</b> They’re equally efficient.' :
		loot_diff <= 6 ? '.</b> But a z' + second + ' map with ' + loot_diff + '% higher loot is better.' :
		                 '.</b> It’s ' + percent + '% more efficient than z' + second + '.';
	return '<p style="font-size: 1.1em">' + result + '<p>' + one_shot + table;
}

// for (var atk = 1E16; atk < 1E20; atk += 1E16) {
	// display(stats({
		// agility: 10 * Math.pow(.95, 20),
		// atk: atk,
		// biome: biomes.all.concat(biomes['gardens']),
		// cc: .5,
		// cd: 5,
		// difficulty: .84,
		// hyperspeed: false,
		// import_chance: .5,
		// overkill: 0,
		// range: 1.2,
		// size: 30,
		// titimp: true,
	// }))
// }
