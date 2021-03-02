const {abs, ceil, floor, log, max, min, pow, round, sqrt} = Math;
const $ = (selector: string) => <Element & HTMLInputElement> document.querySelector(selector);
const $$ = (selector: string) => [].slice.apply(document.querySelectorAll(selector));

declare var ace: any;

// TODO:
// * Support for multiple I/O
// * Expected output, win condition
// * Display cycle count somewhere

let seed = 42;
function rng() {
	seed ^= seed >> 11;
	seed ^= seed << 8;
	seed ^= seed >> 19;
	return seed & 255;
}

let r = new Uint8Array(4);
let memory = new Uint8Array(256);
let errors = new Uint8Array(256);
let inputs = Array.apply(null, Array(16)).map(rng)
let running = false;

inputs[5]--;
inputs[6] = 0;
inputs[15] = 0;

let line_nums: number[] = [];

let run = {
	cycle: 0,
	input_pos: 0,
	outputs: <number[]> [],
	breakpoint: -1,
}

function input() {
	return inputs[run.input_pos++];
}

function output(n: number) {
	run.outputs.push(n);
}

const ops: { (a: number, b: number): void; } [] = [
	(a, b) => r[a] = r[b],
	(a, b) => [r[a], r[b]] = [r[b], r[a]],
	(a, b) => r[a] = +(r[a] == r[b]),
	(a, b) => r[a] = +!r[a], // free real estate

	(a, b) => r[a] += r[b],
	(a, b) => r[a] = r[a] > r[b] ? r[a] - r[b] : 0,
	(a, b) => r[a] *= r[b],
	(a, b) => r[a] /= r[b],

	(a, b) => r[a] += 1, // free real estate
	(a, b) => r[a] -= 1, // free real estate
	(a, b) => r[a] = (r[2] >> 2*b) & 3,
	(a, b) => {
		r[2] &= ~(3 << 2*b);
		r[2] |= a << 2*b;
	},

	(a, b) => r[a] = memory[r[b]],
	(a, b) => memory[r[b]] = r[a],
	(a, b) => r[a] = input(),
	(a, b) => output(r[a]),
];

const mnemonics = [
	'copy', 'swap', 'cmp',  'not',
	'add',  'sub',  'mul',  'div',
	'inc',  'dec',  'qget', 'qset',
	'load', 'save', 'recv', 'send',
];

const argParser: {[key: string]: number} = {
	'A': 0, 'B': 1, 'Q': 2, 'I': 3,
	'0': 0, '1': 1, '2': 2, '3': 3,
	undefined: 0,
}

function quarts(n: number) {
	return [n >> 6 & 3, n >> 4 & 3, n >> 2 & 3, n & 3];
}

function prettify(n: number) {
	if (n === undefined)
		return "";
	return quarts(n).join('');
}

function redraw() {
	$$('#registers td').forEach((elem: HTMLElement, i: number) => {
		elem.innerText = prettify(r[i]);
	});

	$$('#memory td').forEach((elem: HTMLElement, i: number) => {
		elem.innerText = prettify(memory[i]);
		elem.classList.toggle('highlighted', running && (i == r[3] || i == r[2]));
		elem.classList.toggle('error', errors[i] == 1);
	});

	$$('#inputs td').forEach((elem: HTMLElement, i: number) => {
		elem.innerText = inputs[i];
		elem.classList.toggle('highlighted', running && i == run.input_pos);
	});

	$$('#outputs td').forEach((elem: HTMLElement, i: number) => {
		if (run.outputs[i] !== undefined)
			elem.innerText = run.outputs[i].toString();
		else
			elem.innerText = "";
	});

	if (running && line_nums.indexOf(r[3]) != -1)
		ace.gotoLine(line_nums.indexOf(r[3]) + 1);

	$$('.ace_line').forEach((elem: HTMLElement, i: number) => {
		// elem.classList.toggle('ace_executing', running && line_nums[i] == r[3]);
		// elem.classList.toggle('error', errors[line_nums[i]] == 1);
	});
}

function compile() {
	memory.fill(0);
	errors.fill(0);

	line_nums = [];

	let dp = 0;

	for (let line of ace.getValue().split('\n')) {
		let tokens = line.replace(/;.*/, '').match(/\S+/g);

		if (!tokens) {
			line_nums.push(-1);
		}

		else if (tokens.length == 1 && tokens[0].match(/^@\d+$/)) {
			line_nums.push(-1);
			dp = +tokens[0].replace(/@/, '');
		}

		else if (tokens.length == 1 && tokens[0].match(/^\d+$/)) {
			line_nums.push(dp);
			memory[dp++] = +tokens[0];
		}

		else {
			let opcode = mnemonics.indexOf(tokens[0]);
			let a = argParser[tokens[1]];
			let b = argParser[tokens[2]];

			if (opcode == -1 || a === undefined || b === undefined) {
				errors[dp] = 1;
			}

			line_nums.push(dp);
			memory[dp++] = (opcode << 4) | (a << 2) | b;
		}
	}

	redraw();
}

function reset(e: Event|null) {
	running = false;
	ace.setReadOnly(false);

	r.fill(0);
	run.cycle = 0;
	run.input_pos = 0;
	run.outputs = [];
	run.breakpoint = -1;
	compile();
}

function step(e: Event|null) {
	if (!running) {
		if (!errors.every(x => !x))
			return;

		running = true;
		ace.setReadOnly(true);

		redraw();
		return;
	}

	let instr = memory[r[3]++];

	let opcode = instr >> 4;
	let a = (instr >> 2) & 3;
	let b = instr & 3;

	ops[opcode](a, b);

	++run.cycle;

	if (e)
		redraw();
}

function fast(e: Event|null) {
	if (!e && !running)
		return;

	for (let i = 0; i < 64; ++i) {
		step(null);

		if (r[3] == run.breakpoint) {
			redraw();
			return;
		}
	}
	redraw();

	setTimeout(fast, 0);
}

function keyboard_shortcuts(e: KeyboardEvent)
{
	switch (e.key) {

	case "Tab":
		e.preventDefault();
		e.stopPropagation();
		step(e);
		break;
	
	case "Escape":
		e.preventDefault();
		e.stopPropagation();
		reset(e);
		break;
	
	case "F4":
		e.preventDefault();
		e.stopPropagation();
		fast(e);
		break;
	}
}

function init() {
	$('#step').addEventListener('click', step);
	$('#reset').addEventListener('click', reset);
	$('#fast').addEventListener('click', fast);

	ace = ace.edit('source', {
		mode: 'ace/mode/assembly_x86',
		fontSize: 14,
	});

	ace.setValue(localStorage.code || '');
	ace.selection.clearSelection();

	ace.on('change', () => {
		localStorage.code = ace.getValue();
		compile();
	});

	ace.on('click', (e: any) => {
		if (e.domEvent.ctrlKey) {
			run.breakpoint = line_nums[e.$pos.row];
			fast(e);
		}
	});

	document.addEventListener('keydown', keyboard_shortcuts, true);

	compile();
}

document.addEventListener("DOMContentLoaded", init);
