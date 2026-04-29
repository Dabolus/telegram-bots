.PHONY: clean
.DEFAULT_GOAL := build

clean:
	rm -rf build

build:
	git clone --depth=1 --branch=v148.0.0 https://github.com/sparticuz/chromium.git
	cd chromium && mkdir -p bin/arm64/unused/ && make chromium.arm64.zip
	unzip chromium/chromium.arm64.zip -d build
	rm -rf chromium
