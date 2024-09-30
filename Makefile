# Makefile for LocalStack and Nitro

# Variables
LOCALSTACK_VERSION := latest
NITRO_VERSION := latest

# Targets
.PHONY: start start-localstack start-app stop stop-localstack stop-app

start: start-localstack start-app
stop: stop-localstack stop-app
deploy-preview: deploy-preview-terraform
deploy-preview-terraform: build-app localstack-deploy-terraform
deploy-preview-cdk: build-app localstack-deploy-cdk

localstack-start:
	@echo "Starting LocalStack..."
	@localstack start -d

localstack-reset:
	@echo "Resetting LocalStack..."
	@localstack state reset

deploy-aws:
	@echo "Deploying apps with Terraform to AWS..."
	@cd ./apps/server/.output/server && zip -r ./lambda.zip . && cd -
	@cp ./apps/server/.output/server/lambda.zip ./.iac/terraform
	@terraform -chdir=./.iac/terraform init
	@terraform -chdir=./.iac/terraform apply --auto-approve

localstack-deploy-terraform:
	@echo "Locally deploying apps with Terraform..."
	@localstack wait
	@cd ./apps/server/.output/server && zip -r ./lambda.zip . && cd -
	@cp ./apps/server/.output/server/lambda.zip ./.iac/terraform
	@tflocal -chdir=./.iac/terraform init
	@tflocal -chdir=./.iac/terraform apply --auto-approve

localstack-deploy-cdk:
	@echo "Locally deploying apps with CDK..."
	@localstack wait
	@pnpm --filter ./.iac/cdk run local-deploy-cdk

build-app:
	@echo "Building apps..."
	@pnpm install
	@pnpm -r build

start-app:
	@echo "Starting apps..."
	@pnpm install
	@pnpm -r dev

start-lambda-debug:
	@echo "stating localstack with lambda debugger..."
	DEBUG=1 \
  LAMBDA_REMOTE_DOCKER=0 \
  LAMBDA_EXECUTOR= \
  LAMBDA_DOCKER_FLAGS="-e NODE_OPTIONS=--inspect-brk=0.0.0.0:9229 -p 9229:9229" \
  LOCALSTACK_VOLUME_DIR=./volume \
  localstack start -d

stop-localstack:
	@echo "Stopping LocalStack..."
	@localstack stop

install:
	@which localstack || brew install localstack
	@which awslocal || pip install awscli-local
	@which tflocal || pip install terraform-local
	@which cdklocal || pnpm install -g aws-cdk-local aws-cdk
