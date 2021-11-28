.PHONY: clean
.DEFAULT_GOAL := build

clean:
	rm -rf build

build:
	mkdir -p build/bin
	curl https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz | tar x
	mv ffmpeg-*-static/ffmpeg build/bin/ffmpeg
	rm -rf ffmpeg-*-static
