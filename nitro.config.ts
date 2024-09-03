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
});
