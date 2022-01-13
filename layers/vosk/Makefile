.PHONY: clean
.DEFAULT_GOAL := build

clean:
	rm -rf build

build:
	mkdir -p build/nodejs build/vosk-models

	# Download English model
	curl https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip -o en.zip
	unzip en.zip
	rm en.zip
	mv vosk-model-small-en-us-0.15 build/vosk-models/en

	# Download Italian model
	curl https://alphacephei.com/vosk/models/vosk-model-small-it-0.4.zip -o it.zip
	unzip it.zip
	rm it.zip
	mv vosk-model-small-it-0.4 build/vosk-models/it

	# Install the library
	npm install --no-save --prefix build/nodejs --arch=x64 --platform=linux vosk@^0.3.32
