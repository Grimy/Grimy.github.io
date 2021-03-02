"use strict";
var abs = Math.abs, ceil = Math.ceil, floor = Math.floor, log = Math.log, max = Math.max, min = Math.min, pow = Math.pow, round = Math.round, sqrt = Math.sqrt;
var $ = function (selector) { return document.querySelector(selector); };
var $$ = function (selector) { return [].slice.apply(document.querySelectorAll(selector)); };
// TODO:
// * Support for multiple I/O
// * Expected output, win condition
// * Display cycle count somewhere
var seed = 42;
function rng() {
    seed ^= seed >> 11;
    seed ^= seed << 8;
    seed ^= seed >> 19;
    return seed & 255;
}
var r = new Uint8Array(4);
var memory = new Uint8Array(256);
var errors = new Uint8Array(256);
var inputs = Array.apply(null, Array(16)).map(rng);
var running = false;
inputs[5]--;
inputs[6] = 0;
inputs[15] = 0;
var line_nums = [];
var run = {
    cycle: 0,
    input_pos: 0,
    outputs: [],
    breakpoint: -1,
};
function input() {
    return inputs[run.input_pos++];
}
function output(n) {
    run.outputs.push(n);
}
var ops = [
    function (a, b) { return r[a] = r[b]; },
    function (a, b) {
        return _a = [r[b], r[a]], r[a] = _a[0], r[b] = _a[1], _a;
        var _a;
    },
    function (a, b) { return r[a] = +(r[a] == r[b]); },
    function (a, b) { return r[a] = +!r[a]; },
    function (a, b) { return r[a] += r[b]; },
    function (a, b) { return r[a] = r[a] > r[b] ? r[a] - r[b] : 0; },
    function (a, b) { return r[a] *= r[b]; },
    function (a, b) { return r[a] /= r[b]; },
    function (a, b) { return r[a] += 1; },
    function (a, b) { return r[a] -= 1; },
    function (a, b) { return r[a] = (r[2] >> 2 * b) & 3; },
    function (a, b) {
        r[2] &= ~(3 << 2 * b);
        r[2] |= a << 2 * b;
    },
    function (a, b) { return r[a] = memory[r[b]]; },
    function (a, b) { return memory[r[b]] = r[a]; },
    function (a, b) { return r[a] = input(); },
    function (a, b) { return output(r[a]); },
];
var mnemonics = [
    'copy', 'swap', 'cmp', 'not',
    'add', 'sub', 'mul', 'div',
    'inc', 'dec', 'qget', 'qset',
    'load', 'save', 'recv', 'send',
];
var argParser = {
    'A': 0, 'B': 1, 'Q': 2, 'I': 3,
    '0': 0, '1': 1, '2': 2, '3': 3,
    undefined: 0,
};
function quarts(n) {
    return [n >> 6 & 3, n >> 4 & 3, n >> 2 & 3, n & 3];
}
function prettify(n) {
    if (n === undefined)
        return "";
    return quarts(n).join('');
}
function redraw() {
    $$('#registers td').forEach(function (elem, i) {
        elem.innerText = prettify(r[i]);
    });
    $$('#memory td').forEach(function (elem, i) {
        elem.innerText = prettify(memory[i]);
        elem.classList.toggle('highlighted', running && (i == r[3] || i == r[2]));
        elem.classList.toggle('error', errors[i] == 1);
    });
    $$('#inputs td').forEach(function (elem, i) {
        elem.innerText = inputs[i];
        elem.classList.toggle('highlighted', running && i == run.input_pos);
    });
    $$('#outputs td').forEach(function (elem, i) {
        if (run.outputs[i] !== undefined)
            elem.innerText = run.outputs[i].toString();
        else
            elem.innerText = "";
    });
    if (running && line_nums.indexOf(r[3]) != -1)
        ace.gotoLine(line_nums.indexOf(r[3]) + 1);
    $$('.ace_line').forEach(function (elem, i) {
        // elem.classList.toggle('ace_executing', running && line_nums[i] == r[3]);
        // elem.classList.toggle('error', errors[line_nums[i]] == 1);
    });
}
function compile() {
    memory.fill(0);
    errors.fill(0);
    line_nums = [];
    var dp = 0;
    for (var _i = 0, _a = ace.getValue().split('\n'); _i < _a.length; _i++) {
        var line = _a[_i];
        var tokens = line.replace(/;.*/, '').match(/\S+/g);
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
            var opcode = mnemonics.indexOf(tokens[0]);
            var a = argParser[tokens[1]];
            var b = argParser[tokens[2]];
            if (opcode == -1 || a === undefined || b === undefined) {
                errors[dp] = 1;
            }
            line_nums.push(dp);
            memory[dp++] = (opcode << 4) | (a << 2) | b;
        }
    }
    redraw();
}
function reset(e) {
    running = false;
    ace.setReadOnly(false);
    r.fill(0);
    run.cycle = 0;
    run.input_pos = 0;
    run.outputs = [];
    run.breakpoint = -1;
    compile();
}
function step(e) {
    if (!running) {
        if (!errors.every(function (x) { return !x; }))
            return;
        running = true;
        ace.setReadOnly(true);
        redraw();
        return;
    }
    var instr = memory[r[3]++];
    var opcode = instr >> 4;
    var a = (instr >> 2) & 3;
    var b = instr & 3;
    ops[opcode](a, b);
    ++run.cycle;
    if (e)
        redraw();
}
function fast(e) {
    if (!e && !running)
        return;
    for (var i = 0; i < 64; ++i) {
        step(null);
        if (r[3] == run.breakpoint) {
            redraw();
            return;
        }
    }
    redraw();
    setTimeout(fast, 0);
}
function keyboard_shortcuts(e) {
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
    ace.on('change', function () {
        localStorage.code = ace.getValue();
        compile();
    });
    ace.on('click', function (e) {
        if (e.domEvent.ctrlKey) {
            run.breakpoint = line_nums[e.$pos.row];
            fast(e);
        }
    });
    document.addEventListener('keydown', keyboard_shortcuts, true);
    compile();
}
document.addEventListener("DOMContentLoaded", init);
