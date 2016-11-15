all: blue.css violet.css magenta.css

blue.css: HUE=240
violet.css: HUE=270
magenta.css: HUE=300

%.css: husl grim.husl
	HUE=$(HUE) perl $^ >$@
