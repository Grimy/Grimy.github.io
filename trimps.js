// trimps.js: some code common to Perky and zFarm

function $(str) { return document.querySelector(str); }

$('#dark').disabled = !localStorage.getItem('dark');
function switch_theme() {
	let light = $('#dark').disabled = !$('#dark').disabled;
	localStorage.setItem('dark', light ? '' : '1');
}

function handle_paste(ev) {
	let save_string = ev.clipboardData.getData("text/plain").replace(/\s/g, '');
	let game = JSON.parse(LZString.decompressFromBase64(save_string));
	$('#load-failed').style.display = game ? 'none' : 'block';
	if (game) {
		$('#bad-version').style.display = game.global.version <= 4.5 ? 'none' : 'block';
		localStorage.setItem('notation', game.options.menu.standardNotation.enabled);
		read_save(game);
		main();
	}
}

const suffixes = [
	'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
	'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Od', 'Nd', 'V',
	'Uv', 'Dv', 'Tv', 'Qav', 'Qiv', 'Sxv', 'Spv', 'Ov', 'Nv', 'Tt',
];

const alphabet = "\u200babcdefghijklmnopqrstuvwxyz";

function prettify(number) {
	if (number < 10000)
		return Math.round(number);

	if (localStorage.getItem('notation') == '0') // scientific
		return number.toExponential(2).replace('+', '');

	let unit = -1;
	while (number >= 999.5) {
		number /= 1000;
		++unit;
	}

	let precision = number == Math.floor(number) ? 0 : (number < 10) + (number < 100);
	number = number.toFixed(precision);

	if (localStorage.getItem('notation') == 3) // alphabetic
		return number + alphabet[Math.floor(unit / 26)] + alphabet[unit % 26 + 1];

	if (localStorage.getItem('notation') == 2 || unit >= suffixes.length) // engineering
		return number + 'e' + (3 * unit + 3);

	// standard
	return number + suffixes[unit];
}

function parse_suffixes(str) {
	for (var i = suffixes.length; i > 0; --i)
		str = str.replace(' ', '').replace(new RegExp(suffixes[i - 1], 'i'), `E${3 * i}`);
	return parseFloat(str);
}

// Base attack (before difficulty and imp modifiers) for an enemy
// at the given position (zone + cell).
function enemy_atk(zone, cell) {
	var amt = 5.5 * Math.sqrt(zone * Math.pow(3.27, zone)) - 1.1;
	amt *= zone < 60 ? (3.1875 + 0.0595 * cell) : (4 + 0.09 * cell) * Math.pow(1.15, zone - 59);
	return amt;
}
