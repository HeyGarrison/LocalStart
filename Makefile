# Makefile for LocalStack and Nitro

# Variables
LOCALSTACK_VERSION := latest
NITRO_VERSION := latest

# Targets
.PHONY: start start-localstack start-app stop stop-localstack stop-app

start: start-localstack start-app
stop: stop-localstack stop-app

start-localstack:
	@echo "Starting LocalStack..."
	localstack start -d
	localstack wait

start-app:
	@echo "Starting apps..."
	pnpm install
	pnpm run dev:backend & pnpm run dev:react

stop-localstack:
	@echo "Stopping LocalStack..."
	localstack stop

install:
		@which localstack || brew install localstack
		@which awslocal || pip install awscli-local
		# could also add dynamodb table creation here,
		# but I think i'd prefer to do that in the model level
