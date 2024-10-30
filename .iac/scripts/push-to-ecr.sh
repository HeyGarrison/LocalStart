#!/bin/bash

# Exit on error
set -e

IMAGE_NAME="nextjs-docker"
REGION="us-west-2"
ACCOUNT_ID="000000000000"
CLUSTER_NAME="nextjs-cluster"
SERVICE_NAME="nextjs-service"
TASK_FAMILY="nextjs-task"

echo "Creating ECR repository..."
REPO_URI=$(awslocal ecr create-repository \
    --repository-name $IMAGE_NAME \
    --region $REGION \
    --query 'repository.repositoryUri' \
    --output text)

echo "Building Docker image..."
docker build -t $IMAGE_NAME ./../../apps/nextjs

echo "Tagging image..."
docker tag $IMAGE_NAME:latest $REPO_URI:latest

echo "Pushing image to ECR..."
docker push $REPO_URI:latest

# Create ECS Cluster
echo "Creating ECS cluster..."
awslocal ecs create-cluster \
    --cluster-name $CLUSTER_NAME \
    --region $REGION

# Register Task Definition
echo "Registering task definition..."
awslocal ecs register-task-definition \
    --family $TASK_FAMILY \
    --container-definitions "[
        {
            \"name\": \"$IMAGE_NAME\",
            \"image\": \"$REPO_URI:latest\",
            \"cpu\": 256,
            \"memory\": 512,
            \"portMappings\": [
                {
                    \"containerPort\": 3000,
                    \"hostPort\": 3000,
                    \"protocol\": \"tcp\"
                }
            ],
            \"essential\": true
        }
    ]" \
    --requires-compatibilities "FARGATE" \
    --network-mode "awsvpc" \
    --cpu "256" \
    --memory "512"

# Create VPC
echo "Creating VPC..."
VPC_ID=$(awslocal ec2 create-vpc \
    --cidr-block 10.0.0.0/16 \
    --query 'Vpc.VpcId' \
    --output text)

# Create Subnet
echo "Creating Subnet..."
SUBNET_ID=$(awslocal ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block 10.0.1.0/24 \
    --query 'Subnet.SubnetId' \
    --output text)

# Create Security Group
echo "Creating Security Group..."
SG_ID=$(awslocal ec2 create-security-group \
    --group-name ecs-sg \
    --description "ECS Security Group" \
    --vpc-id $VPC_ID \
    --query 'GroupId' \
    --output text)


# Create ECS Service
echo "Creating ECS service..."
awslocal ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name $SERVICE_NAME \
    --task-definition $TASK_FAMILY \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$SG_ID]}" \
    --region $REGION
