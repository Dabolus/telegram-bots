.PHONY: clean
.DEFAULT_GOAL := build

clean:
	rm -rf build

build:
	mkdir -p build/bin
	curl https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz | tar -xJ
	mv ffmpeg-*-static/ffmpeg ffmpeg-*-static/ffprobe build/bin
	rm -rf ffmpeg-*-static
