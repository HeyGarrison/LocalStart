import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as path from "path";
import { Construct } from "constructs";

export class LocalstartStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for frontend
    const frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: "localstart-react",
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      // publicReadAccess: true,
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

    // Output
    new cdk.CfnOutput(this, "FrontendUrl", {
      value: frontendBucket.bucketWebsiteUrl,
      description: "URL for the frontend website",
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url + "api",
      description: "URL for the API",
    });
  }
}
