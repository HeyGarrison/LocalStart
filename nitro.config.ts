//https://nitro.unjs.io/config
export default defineNitroConfig({
  preset: "aws-lambda",
  srcDir: "./",
  serverAssets: [
    {
      baseName: "views",
      dir: "./views",
    },
  ],
  runtimeConfig: {
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  },
});
