variable "region" {
  type    = string
  default = "us-east-1"
}

# Provider configuration
provider "aws" {
  region                      = var.region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    apigateway = "http://localhost:4566"
    iam        = "http://localhost:4566"
    lambda     = "http://localhost:4566"
    s3         = "http://localhost:4566"
  }
}

# S3 bucket for frontend
resource "aws_s3_bucket" "frontend" {
  bucket = "localstart-react"
}

# S3 bucket website configuration
resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# Build React app
resource "null_resource" "build_frontend" {
  triggers = {
    always_run = "${timestamp()}"
  }

  provisioner "local-exec" {
    command = "echo 'Building React app...' && pnpm --filter react build"
  }
}

# Upload built files to S3
resource "aws_s3_object" "frontend_files" {
  for_each = fileset("${path.module}/../../apps/react/dist", "**/*")

  bucket = aws_s3_bucket.frontend.id
  key    = each.value
  source = "${path.module}/../../apps/react/dist/${each.value}"
  etag   = filemd5("${path.module}/../../apps/react/dist/${each.value}")

  content_type = lookup(local.mime_types, regex("\\.[^.]+$", each.value), null)

  depends_on = [null_resource.build_frontend]
}

locals {
  mime_types = {
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
  }
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Build and zip Lambda function
# resource "null_resource" "build_lambda" {
#   triggers = {
#     always_run = "${timestamp()}"
#   }

#   provisioner "local-exec" {
#     command = <<EOT
#       echo "Building and zipping Lambda function..."
#       pnpm --filter server build && \
#       cd ${path.module}/../../apps/server/.output/server
#       zip -r ../lambda.zip .
#     EOT
#   }
# }

# Lambda function
resource "aws_lambda_function" "server" {
  filename      = "${path.module}/../../apps/server/.output/lambda.zip"
  function_name = "localstart-server"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  # source_code_hash = filebase64sha256("./../../apps/server/.output/lambda.zip")

  # depends_on = [null_resource.build_lambda]
}

# API Gateway
resource "aws_api_gateway_rest_api" "api" {
  name = "localstart-api"
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.proxy.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.server.invoke_arn
}

resource "aws_api_gateway_deployment" "api" {
  depends_on = [aws_api_gateway_integration.lambda]

  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name  = "preview"
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.server.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Output
output "frontend_url" {
  value = "http://${aws_s3_bucket.frontend.id}.s3-website.${var.region}.localhost.localstack.cloud:4566"
}

output "api_url" {
  value = "http://${aws_api_gateway_rest_api.api.id}.execute-api.${var.region}.localhost.localstack.cloud:4566/preview"
}
