ALL := $(wildcard src/*.pug src/*.styl src/*.ts)
ALL := $(ALL:.pug=.html)
ALL := $(ALL:.styl=.css)
ALL := $(ALL:.ts=.js)

all: $(notdir $(ALL))

%.html: src/%.pug src/index.pug
	pug $^ -o .

%.css: src/%.styl
	stylus -c <$^ >$@

src/%.js: src/%.ts
	tsc -t ES5 --strict --noUnusedLocals --outFile $@ $^

%.js: src/%.js
	uglify -s $^ -o $@
