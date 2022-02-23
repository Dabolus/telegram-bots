.PHONY: clean
.DEFAULT_GOAL := build

clean:
	rm -rf build

build:
	git clone --depth=1 https://github.com/alixaxel/chrome-aws-lambda.git
	cd chrome-aws-lambda && make chrome_aws_lambda.zip
	unzip chrome-aws-lambda/chrome_aws_lambda.zip -d build
	rm -rf chrome-aws-lambda
