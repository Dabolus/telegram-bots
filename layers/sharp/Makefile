.PHONY: clean
.DEFAULT_GOAL := build

clean:
	rm -rf build

build:
	mkdir -p build/nodejs
	cd build/nodejs
	SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install --no-save --prefix build/nodejs --os=linux --cpu=x64 --libc=glibc sharp@0.34.1
