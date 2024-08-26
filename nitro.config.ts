//https://nitro.unjs.io/config
export default defineNitroConfig({
  preset: "aws-lambda",
  srcDir: "./",
  serverAssets: [
    {
      baseName: "app",
      dir: "./app",
    },
  ],
});
