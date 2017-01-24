var ngrams = new Array(256).fill(0);
var mask = 0;
var pressed = 0;
var guessed = 0;

function main(j) {
	let fprob = 0;
	let jprob = 0;

	for (let i = 2; i < ngrams.length; i <<= 1) {
		let fs = ngrams[mask % i | i];
		let js = ngrams[mask % i | i | 1];
		let total = js + fs;
		if (total) {
			// console.log(`${i}-grams: ${fs} f’s, ${js} j’s`);
			fprob += fs / total;
			jprob += js / total;
		}
	}

	let prediction = jprob > fprob ? 'j' : 'f';
	let correct = (jprob > fprob) == j;
	guessed += correct;
	console.log(`My prediction was \x1b[3${correct ? 2 : 1}m${prediction}\x1b[m`);
	console.log(`Success rate so far: ${(100 * guessed / pressed).toFixed(1)}%`);

	mask |= j;
	for (let i = 2; i < ngrams.length; i <<= 1)
		ngrams[mask % i | i] += Math.pow(1.05, pressed - guessed);
	mask <<= 1;
	mask %= ngrams.length;
}

var stdin = process.stdin;
if (stdin.setRawMode)
	stdin.setRawMode(true);

stdin.on('data', (buffer) => {
	for (let key of buffer) {
		switch (key) {
			case 102:
			case 106:
				++pressed;
				main(key == 106);
				break;
			case 3:
			case 4:
			case 113:
				process.exit();
		}
	}
});
