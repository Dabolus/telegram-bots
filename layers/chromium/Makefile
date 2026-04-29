.PHONY: clean
.DEFAULT_GOAL := build

clean:
	rm -rf build

build:
	git clone --depth=1 --branch=v148.0.0 https://github.com/sparticuz/chromium.git
	cd chromium && mkdir -p bin/x64/unused/ && make chromium.x64.zip
	unzip chromium/chromium.x64.zip -d build
	rm -rf chromium
