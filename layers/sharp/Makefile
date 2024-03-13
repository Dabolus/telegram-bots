.PHONY: clean
.DEFAULT_GOAL := build

clean:
	rm -rf build

build:
	mkdir -p build/nodejs
	cd build/nodejs
	SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install --no-save --prefix build/nodejs --arch=x64 --platform=linux sharp@0.32.6
