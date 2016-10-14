
function $(str) { return document.querySelector(str); }

const suffixes = [
	'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
	'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Od', 'Nd', 'V',
	'Uv', 'Dv', 'Tv', 'Qav', 'Qiv', 'Sxv', 'Spv', 'Ov', 'Nv', 'Tt',
];

function prettify(number) {
	if (number < 10000)
		return Math.round(number);
	let unit = -1;
	while (number > 1000)
		number /= 1000, ++unit;
	return number.toFixed((number < 10) + (number < 100)) + suffixes[unit];
}

function parse_suffixes(str) {
	for (var i = suffixes.length; i > 0; --i)
		str = str.replace(' ', '').replace(new RegExp(suffixes[i - 1], 'i'), `E${3 * i}`)
	return parseFloat(str);
}

// Base attack (before difficulty and imp modifiers) for an enemy
// at the given position (zone + cell).
function enemy_atk(zone, cell) {
	var amt = 5.5 * Math.sqrt(zone * Math.pow(3.27, zone)) - 1.1;
	amt *= zone < 60 ? (3.1875 + .0595 * cell) : (4 + .09 * cell) * Math.pow(1.15, zone - 59);
	return amt;
}

// Base HP (before difficulty and imp modifiers) for an enemy
// at the given position (zone + cell).
function enemy_hp(zone, cell) {
	var amt = 14.3 * Math.sqrt(zone * Math.pow(3.265, zone)) - 12.1;
	amt *= zone < 60 ? (3 + (3 / 110) * cell) : (5 + .08 * cell) * Math.pow(1.1, zone - 59);
	return amt;
}
