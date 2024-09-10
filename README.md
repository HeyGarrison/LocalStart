# GarrisonStack (WIP)
A modern Typescript framework with a first class AWS integration powered by LocalStack.

### Prerequisites
- Node / npm / pnpm / yarn
- LocalStack
  - `brew install localstack/tap/localstack-cli`
- Run `make start`

### Install

1. Create a dynamo table:
```
awslocal dynamodb create-table \
    --table-name products \
    --key-schema AttributeName=id,KeyType=HASH \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1
```
