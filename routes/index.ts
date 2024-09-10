import { Product } from "~/models/product";

export default defineHTMLPage(async () => {
  const products = await Product.findAll();
  console.log(products);
  return {
    hello: "world",
  };
});
