// trimps.js: some code common to Perky and zFarm

// Copy these Math functions in our namespace
const {abs, ceil, floor, log, max, min, pow, round, sqrt} = Math;

const $ = selector => document.querySelector(selector);
const $$ = selector => [].slice.apply(document.querySelectorAll(selector));

function remove(elem) {
	elem.parentNode.removeChild(elem);
}

function switch_theme() {
	let light = $('#dark').disabled = !$('#dark').disabled;
	localStorage.dark = light ? '' : '1';
}

function show_alert(style, message) {
	$('#alert').innerHTML +=
		`<p class=${style}>
			<span class=badge onclick='remove(this.parentNode)'>×</span>
			${message}
		</p>`;
}

(function init(version) {
	$('#dark').disabled = !localStorage.dark;

	if (localStorage.version != version) {
		localStorage.version = version;
		show_alert('ok', `Welcome to Trimps ${version}! See what’s new in the <a href=changelog.html>changelog</a>.`);
	}

	$$('[data-saved]').forEach(field => {
		if (field.type === 'checkbox') {
			field.checked = localStorage[field.id] === 'true';
			field.onchange = () => localStorage[field.id] = field.checked;
		} else {
			field.value = localStorage[field.id] || field.value;
			field.onchange = () => localStorage[field.id] = field.value;
		}
	});
})('2.1');

function try_wrap(main) {
	try {
		main();
	} catch (err) {
		console.log(err);
		show_alert('ko', `Oops! It’s not your fault, but something went wrong.
		You can go pester the dev on
		<a href=https://github.com/Grimy/Grimy.github.io/issues/new>GitHub</a> or
		<a href=https://www.reddit.com/message/compose/?to=Grimy_>Reddit</a>, he’ll fix it.
		If you do, please include your save file and the following message:
		<br><b>l${err.lineNumber}c${err.columnNumber} ${err}</b>.`);
	}
}

function handle_paste(ev) {
	let save_string = ev.clipboardData.getData("text/plain").replace(/\s/g, '');
	let game;

	try {
		game = JSON.parse(LZString.decompressFromBase64(save_string));
	} catch (err) {}

	if (!game) {
		show_alert('ko', 'Your clipboard did not contain a valid Trimps save. Open the game, click “Export” then “Copy to Clipboard”, and try again.');
		return;
	}

	if (game.global.version > 4.5)
		show_alert('ko', 'Your save is from a version of Trimps more recent than what this calculator supports. Results may be inaccurate.');

	localStorage.notation = game.options.menu.standardNotation.enabled;

	for (let m in game.talents)
		game.talents[m] = game.talents[m].purchased;
	read_save(game);

	$('button').click();
}

const notations = [
	[],
	'KMBTQaQiSxSpOcNoDcUdDdTdQadQidSxdSpdOdNdVUvDvTvQavQivSxvSpvOvNvTt'.split(/(?=[A-Z])/),
	[],
	("a b c d e f g h i j k l m n o p q r s t u v w x y z" +
	" aa ab ac ad ae af ag ah ai aj ak al am an ao ap aq ar as at au av aw ax ay az" +
	" ba bb bc bd be bf bg bh bi bj bk bl bm bn bo bp bq br bs bt bu bv bw bx by bz" +
	" ca cb cc cd ce cf cg ch ci cj ck cl cm cn co cp cq cr cs ct cu cv cw cx").split(' ')
];

function prettify(number) {
	if (number < 0)
		return '-' + prettify(-number);

	if (number < 10000)
		return round(number);

	if (localStorage.notation === '0') // scientific
		return number.toExponential(2).replace('+', '');

	let unit = 0;
	while (number >= 999.5) {
		number /= 1000;
		++unit;
	}

	let suffixes = notations[localStorage.notation || 1];
	let suffix = unit > suffixes.length ? `e${3 * unit}` : suffixes[unit - 1];
	let precision = number === floor(number) ? 0 : (number < 10) + (number < 100);
	return number.toFixed(precision) + suffix;
}

function parse_suffixes(str) {
	str = str.replace(/[^\w.]/g, '');

	let suffixes = notations[localStorage.notation === '3' ? 3 : 1];
	for (let i = suffixes.length; i > 0; --i)
		str = str.replace(new RegExp(suffixes[i - 1] + '$', 'i'), `E${3 * i}`);

	return isFinite(str) ? parseFloat(str) : null;
}

function check_input(field) {
	let ok = parse_suffixes(field.value) !== null;
	let notation = localStorage.notation === '3' ? 'alphabetic ' : '';
	field.setCustomValidity(ok ? '' : `Invalid ${notation}number: ${field.value}`);
}
