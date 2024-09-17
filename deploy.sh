#!/bin/bash

# Exit on error
set -e

# LocalStack endpoint
ENDPOINT_URL="http://localhost:4566"
pnpm install

# Create S3 bucket for frontend
echo "Creating S3 bucket for react..."
awslocal s3 mb s3://localstart-react

# Enable website hosting on the bucket
echo "Enabling website hosting..."
awslocal s3 website s3://localstart-react --index-document index.html --error-document index.html

# Build React app (adjust the command based on your build process)
echo "Building React app..."
pnpm --filter react build

# Sync built files to S3 bucket
echo "Deploying frontend to S3..."
awslocal s3 sync apps/react/dist/ s3://localstart-react

# Create IAM role for Lambda
echo "Creating IAM role for Lambda..."
awslocal iam create-role --role-name lambda-role --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}' > /dev/null 2>&1

# # Create Lambda function
echo "Creating Lambda function..."
pnpm --filter server build
cd apps/server/.output/server
zip -r ./lambda.zip .
cd ../../../../
awslocal lambda create-function \
    --function-name localstart-server \
    --runtime nodejs20.x \
    --zip-file fileb://apps/server/.output/server/lambda.zip \
    --handler index.handler \
    --role arn:aws:iam::000000000000:role/lambda-role > /dev/null 2>&1

# # # Create API Gateway
echo "Creating API Gateway..."
API_ID=$(awslocal apigateway create-rest-api --name localstart-api --query 'id' --output text)
ROOT_RESOURCE_ID=$(awslocal apigateway get-resources --rest-api-id $API_ID --query 'items[0].id' --output text)

# # # Create resource and method
RESOURCE_ID=$(awslocal apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_RESOURCE_ID --path-part "{proxy+}" --query 'id' --output text)
awslocal apigateway put-method --rest-api-id $API_ID --resource-id $RESOURCE_ID --http-method ANY --authorization-type NONE

# # # Set up Lambda integration
REGION="us-east-1"
ACCOUNT_ID="000000000000"
awslocal apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method ANY \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$ACCOUNT_ID:function:localstart-server/invocations

# Deploy API
awslocal apigateway create-deployment --rest-api-id $API_ID --stage-name local

# # Print out the URLs
echo "Deployment complete!"
echo "Frontend URL: http://localstart-react.s3-website.$REGION.localhost.localstack.cloud:4566"
echo "API URL: http://$API_ID.execute-api.$REGION.localhost.localstack.cloud:4566/local"
