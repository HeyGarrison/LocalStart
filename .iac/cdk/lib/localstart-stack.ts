import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as path from "path";
import { Construct } from "constructs";

export class LocalstartStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, "MainVPC", {
      maxAzs: 1,
      cidr: "10.0.0.0/16",
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "PublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    // Security Group
    const securityGroup = new ec2.SecurityGroup(this, "ECSSecurityGroup", {
      vpc,
      description: "ECS Security Group",
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3000),
      "Allow inbound traffic on port 3000",
    );

    // ECS Cluster
    const cluster = new ecs.Cluster(this, "NextjsCluster", {
      vpc,
      clusterName: "nextjs-cluster",
    });

    // ECS Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "NextjsTaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 256,
      },
    );

    const container = taskDefinition.addContainer("NextjsContainer", {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, "../../../apps/nextjs")),
      memoryLimitMiB: 512,
      cpu: 256,
      portMappings: [{ containerPort: 3000 }],
    });

    // ECS Service
    const service = new ecs.FargateService(this, "NextjsService", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      securityGroups: [securityGroup],
    });

    // Existing S3 bucket for frontend
    const frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: "localstart-react",
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
    });

    // Deploy frontend files to S3
    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../../apps/react/dist")),
      ],
      destinationBucket: frontendBucket,
    });

    // Lambda function for backend
    const backendFunction = new lambda.Function(this, "BackendFunction", {
      functionName: "localstart-server",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../../apps/server/.output/server"),
      ),
    });

    // API Gateway
    const api = new apigateway.RestApi(this, "LocalstartApi", {
      restApiName: "localstart-api",
      deployOptions: {
        stageName: "preview",
      },
    });

    // API Gateway integration with Lambda
    const lambdaIntegration = new apigateway.LambdaIntegration(backendFunction);
    api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    });

    // Outputs
    new cdk.CfnOutput(this, "FrontendUrl", {
      value: frontendBucket.bucketWebsiteUrl,
      description: "URL for the frontend website",
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url + "api",
      description: "URL for the API",
    });

    new cdk.CfnOutput(this, "EcsClusterName", {
      value: cluster.clusterName,
      description: "ECS Cluster Name",
    });
  }
}
