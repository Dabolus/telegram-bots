.PHONY: clean
.DEFAULT_GOAL := build

clean:
	rm -rf build

build:
	git clone --depth=1 https://github.com/sparticuz/chromium.git
	cd chromium && make chromium.zip
	unzip chromium/chromium.zip -d build
	rm -rf chromium
