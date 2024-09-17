# Configure the AWS provider to use LocalStack
provider "aws" {
  access_key                  = "test"
  secret_key                  = "test"
  region                      = "us-east-1"
  s3_use_path_style           = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
}

# Create a DynamoDB table
resource "aws_dynamodb_table" "example_table" {
  name         = "ExampleTable"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "Id"

  attribute {
    name = "Id"
    type = "S"
  }
}

# Create a Cognito User Pool
resource "aws_cognito_user_pool" "example_pool" {
  name = "example-user-pool"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
}

# Create a Cognito User Pool Client
resource "aws_cognito_user_pool_client" "example_client" {
  name         = "example-client"
  user_pool_id = aws_cognito_user_pool.example_pool.id

  generate_secret = false
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
}

# Output the DynamoDB table name and Cognito User Pool ID
output "dynamodb_table_name" {
  value = aws_dynamodb_table.example_table.name
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.example_pool.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.example_client.id
}
