import { Product } from "~/models/product";

export default defineHTMLPage(async () => {
  // await Product.create({
  //   name: "hello",
  //   description: "Goodbye",
  //   price: 100,
  //   category: "Shop All",
  //   stock: 10,
  // });
  // const products = await Product.findAll();
  // console.log(products);
  return {
    hello: "world",
  };
});
