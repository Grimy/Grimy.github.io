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

// Copy of the Trimps save data
let game;

function handle_paste(ev) {
	let save_string = ev.clipboardData.getData("text/plain").replace(/\s/g, '');

	try {
		game = JSON.parse(LZString.decompressFromBase64(save_string));
		if (game.global.version > 4.511)
			show_alert('warning', 'Your save is from a version of Trimps more recent than what this calculator supports. Results may be inaccurate.');
	} catch (err) {
		show_alert('ko', 'Your clipboard did not contain a valid Trimps save. Open the game, click “Export” then “Copy to Clipboard”, and try again.');
		return;
	}

	localStorage.notation = game.options.menu.standardNotation.enabled;

	for (let m in game.talents)
		game.talents[m] = game.talents[m].purchased;

	read_save();
	$('button').click();
}

///
// Read/write notations for big numbers
///

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
		return +number.toPrecision(4) + '';

	if (localStorage.notation === '0') // scientific
		return number.toExponential(2).replace('+', '');

	let unit = 0;
	while (number >= 999.5) {
		number /= 1000;
		++unit;
	}

	let suffixes = notations[localStorage.notation || 1];
	let suffix = unit > suffixes.length ? `e${3 * unit}` : suffixes[unit - 1];
	return +number.toPrecision(3) + suffix;
}

function parse_suffixes(str) {
	str = str.replace(/\*.*|[^--9+a-z]/gi, '');

	let suffixes = notations[localStorage.notation === '3' ? 3 : 1];
	for (let i = suffixes.length; i > 0; --i)
		str = str.replace(new RegExp(suffixes[i - 1] + '$', 'i'), `E${3 * i}`);

	return +str;
}

function check_input(field) {
	let ok = isFinite(parse_suffixes(field.value));
	let notation = localStorage.notation === '3' ? 'alphabetic ' : '';
	field.setCustomValidity(ok ? '' : `Invalid ${notation}number: ${field.value}`);
}

///
// Creating/loading share links
///

function create_share(callback) {
	let share_string = localStorage.notation + ':';
	share_string += $$('input').map(field => field.value.replace(':', '')).join(':');
	let long_url = location.href.replace(/[#?].*/, '');
	long_url += '?' + LZString.compressToBase64(share_string);
	let url = 'https://api-ssl.bitly.com/v3/shorten?longUrl=' + encodeURIComponent(long_url);
	url += '&login=grimy&apiKey=R_7ea82c1cec394d1ca5cf4da2a7f7ddd9';

	callback = callback || (url => show_alert('ok', `Your share link is <a href=${url}>${url}`));
	let request = new XMLHttpRequest();
	request.open('GET', url, true);
	request.onload = () => callback(JSON.parse(request.responseText).data.url || long_url);
	request.send();
}

function exit_share() {
	history.pushState({}, '', 'perks.html');
	$('textarea').onclick = null;
	$$('[data-saved]').forEach(field => field.value = localStorage[field.id] || field.value);
}

function try_wrap(main) {
	try {
		main();
	} catch (err) {
		console.log(err);
		create_share(url => show_alert('ko',
		`Oops! It’s not your fault, but something went wrong. You can go pester the dev on
		<a href=https://github.com/Grimy/Grimy.github.io/issues/new>GitHub</a> or
		<a href=https://www.reddit.com/message/compose/?to=Grimy_>Reddit</a>, he’ll fix it.
		If you do, please include the following message:
		<br><tt>${url} l${err.lineNumber || 0}c${err.columnNumber || 0} ${err}</tt>.`));
	}
}

function load_share(str) {
	let values = LZString.decompressFromBase64(str).split(':');
	let notation = localStorage.notation;
	localStorage.notation = values.shift();

	$$('input').forEach(field => field.value = values.shift());
	$('textarea').onclick = exit_share;

	let inputs = parse_inputs();
	localStorage.notation = notation || 1;
	try_wrap(() => display(optimize(inputs)));
}

window.onload = function () {
	version = '2.2';
	$('#dark').disabled = !localStorage.dark;

	if (localStorage.version != version) {
		localStorage.version = version;
		show_alert('ok', `Welcome to Trimps tools ${version}! See what’s new in the <a href=changelog.html>changelog</a>.`);
	}

	if (location.search)
		load_share(location.search.substr(1));

	$$('[data-saved]').forEach(field => {
		if (field.type === 'checkbox') {
			field.checked = localStorage[field.id] === 'true';
			field.addEventListener('change', () => localStorage[field.id] = field.checked);
		} else {
			field.value = localStorage[field.id] || field.value;
			field.addEventListener('change', () => localStorage[field.id] = field.value);
		}
	});
};
