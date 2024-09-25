import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LocalstartStack } from "../lib/localstart-stack";

const app = new cdk.App();
new LocalstartStack(app, "LocalstartStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
});
