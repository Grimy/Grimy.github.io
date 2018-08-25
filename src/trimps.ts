// trimps.js: some code common to Perky and zFarm

declare var LZString: {[key: string]: (str: string) => string};
const {abs, ceil, floor, log, max, min, pow, round, sqrt} = Math;

let jobless = false;

///
// HTML manipulation utilities
///

const $ = (selector: string) => <Element & HTMLInputElement> document.querySelector(selector);
const $$ = (selector: string) => [].slice.apply(document.querySelectorAll(selector));

function remove(elem: HTMLElement) {
	elem.parentNode!.removeChild(elem);
}

function switch_theme() {
	let dark = $('#dark');
	localStorage.dark = (dark.disabled = !dark.disabled) ? '' : '1';
}
$('#dark').disabled = !localStorage.dark;

function show_alert(style: string, message: string) {
	$('#alert').innerHTML +=
		`<p class=${style}>
			<span class=badge onclick='remove(this.parentNode)'>×</span>
			${message}
		</p>`;
}

function create_share(callback: (url: string) => void) {
	let share_string = localStorage.notation + ':';
	share_string += $$('input,select').map((field: HTMLInputElement) => field.value.replace(':', '')).join(':');
	let long_url = location.href.replace(/[#?].*/, '');
	long_url += '?' + LZString.compressToEncodedURIComponent(share_string);
	callback(long_url);
}

function exit_share() {
	history.pushState({}, '', 'perks.html');
	$('textarea').removeEventListener('click', exit_share);
	$$('[data-saved]').forEach((field: HTMLInputElement) => field.value = localStorage[field.id] || field.value);
}

function load_share(str: string) {
	let values = LZString.decompressFromEncodedURIComponent(str).split(':');
	let notation = localStorage.notation;
	localStorage.notation = values.shift();

	$$('input,select').forEach((field: HTMLInputElement) => field.value = values.shift()!);
	$('textarea').addEventListener('click', exit_share);
	(<any> $('form')).submit();

	localStorage.notation = notation || 1;
}

///
// Read/write notations for big numbers
///

const notations = [
	[],
	('KMBTQaQiSxSpOcNoDcUdDdTdQadQidSxdSpdOdNdVUvDvTvQavQivSxvSpvOvNvTgUtgDtgTtgQatg' +
	'QitgSxtgSptgOtgNtgQaaUqaDqaTqaQaqaQiqaSxqaSpqaOqaNqaQiaUqiDqiTqiQaqiQiqiSxqiSpqi' +
	'OqiNqiSxaUsxDsxTsxQasxQisxSxsxSpsxOsxNsxSpaUspDspTspQaspQispSxspSpspOspNspOgUog' +
	'DogTogQaogQiogSxogSpogOogNogNaUnDnTnQanQinSxnSpnOnNnCtUc').split(/(?=[A-Z])/),
	[],
	('a b c d e f g h i j k l m n o p q r s t u v w x y z' +
	' aa ab ac ad ae af ag ah ai aj ak al am an ao ap aq ar as at au av aw ax ay az' +
	' ba bb bc bd be bf bg bh bi bj bk bl bm bn bo bp bq br bs bt bu bv bw bx by bz' +
	' ca cb cc cd ce cf cg ch ci cj ck cl cm cn co cp cq cr cs ct cu cv cw cx').split(' '),
	'KMBTQaQiSxSpOcNoDcUdDdTdQadQidSxdSpdOdNdVUvDvTvQavQivSxvSpvOvNvTg'.split(/(?=[A-Z])/),
];

function prettify(number: number): string {
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

function parse_suffixes(str: string) {
	str = str.replace(/\*.*|[^--9+a-z]/gi, '');

	let suffixes = notations[localStorage.notation === '3' ? 3 : 1];
	for (let i = suffixes.length; i > 0; --i)
		str = str.replace(new RegExp(suffixes[i - 1] + '$', 'i'), `E${3 * i}`);

	return +str;
}

function input(id: string) {
	return parse_suffixes($('#' + id).value);
}

function check_input(field: HTMLInputElement) {
	let ok = isFinite(parse_suffixes(field.value));
	let notation = localStorage.notation === '3' ? 'alphabetic ' : '';
	field.setCustomValidity(ok ? '' : `Invalid ${notation}number: ${field.value}`);
}

window.addEventListener('error', (ev) => {
	if (typeof ev.error == 'string') {
		show_alert('ko', ev.error);
		return;
	}

	if (ev.message == 'Script error.')
		return;

	create_share((url: string) => show_alert('ko',
	`Oops! It’s not your fault, but something went wrong. You can go pester the dev on
	<a href=https://github.com/Grimy/Grimy.github.io/issues/new>GitHub</a> or
	<a href=https://www.reddit.com/message/compose/?to=Grimy_>Reddit</a>, he’ll fix it.
	If you do, please include the following data:<br>
	<tt>${url}<br>${ev.filename} l${ev.lineno || 0}c${ev.colno || 0} ${ev.message}</tt>.`));
});

///
// Handling Trimps save data
///

let game: any;

function mastery(name: string) {
	if (!game.talents[name])
		throw "unknown mastery: " + name;
	return game.talents[name].purchased;
}

function toggle_spoilers() {
	$$('[data-hide]').forEach((elem: HTMLElement) => {
		elem.style.display = +localStorage.hze >= +elem.getAttribute('data-hide')! ? '' : 'none';
	});
}

function set_hze(zone: number) {
	if (!(+localStorage.hze > zone)) {
		localStorage.hze = zone;
		toggle_spoilers();
	}
}

function handle_paste(ev: ClipboardEvent, read_save: () => void, main: () => void) {
	let save_string = ev.clipboardData.getData("text/plain").replace(/\s/g, '');

	try {
		game = JSON.parse(LZString.decompressFromBase64(save_string));
		let min_version = 4.81;
		let max_version = 4.9;
		if (game.global.version > max_version + 0.009)
			show_alert('warning', `This calculator only supports up to v${max_version} of Trimps, but your save is from v${game.global.version}. Results may be inaccurate.`);
		else if (game.global.version < min_version)
			show_alert('warning', `Trimps v${min_version} is out! Your save is still on v${game.global.version}, so you should refresh the game’s page.`);
	} catch {
		throw 'Your clipboard did not contain a valid Trimps save. Open the game, click “Export” then “Copy to Clipboard”, and try again.';
	}

	localStorage.save = save_string;
	localStorage.notation = game.options.menu.standardNotation.enabled;
	jobless = game.global.ShieldEquipped.name == "Job";
	set_hze(game.global.highestLevelCleared + 1);

	read_save();
	main();
}

function get_paste_back() {
	$('#save').value = localStorage.save;
	$('#save').onfocus = null;
	$('#save').focus();
	$('#save').select();
}

document.addEventListener("DOMContentLoaded", toggle_spoilers);
document.addEventListener("DOMContentLoaded", function () {
	let version = '2.4';
	if (version > localStorage.version)
		show_alert('ok', `Welcome to Trimps tools v${version}! See what’s new in the <a href=changelog.html>changelog</a>.`);
	localStorage.version = version;

	if (location.search)
		load_share(location.search.substr(1));

	$$('[data-saved]').forEach((field: HTMLInputElement) => {
		if (field.type === 'checkbox') {
			field.checked = localStorage[field.id] === 'true';
			field.addEventListener('change', () => localStorage[field.id] = field.checked);
		} else {
			field.value = localStorage[field.id] || field.value;
			field.addEventListener('change', () => localStorage[field.id] = field.value);
		}
	});
}, false);
