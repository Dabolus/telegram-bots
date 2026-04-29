.PHONY: clean
.DEFAULT_GOAL := build

clean:
	rm -rf build

build:
	mkdir -p build
	cd build && \
	wget https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-layer.arm64.zip && \
	unzip chromium-v148.0.0-layer.arm64.zip && \
	rm chromium-v148.0.0-layer.arm64.zip
