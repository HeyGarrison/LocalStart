import Handlebars from "handlebars";
import { defineEventHandler, createError } from "h3";
import type { EventHandler } from "h3";

interface PageData {
  [key: string]: any;
}

export default function defineHTMLPage(
  callback: () => Promise<PageData> | PageData,
): EventHandler {
  return defineEventHandler(async (event) => {
    try {
      // Execute the callback to get page data
      const data = (await Promise.resolve(callback())) || {};

      let route = event.path;

      // Remove trailing slash if present (except for root path)
      if (route !== "/" && route.endsWith("/")) {
        route = route.slice(0, -1);
      }

      // Determine the view path
      let viewPath: string;
      if (route === "/" || route.endsWith("/index")) {
        viewPath = "/index.html";
      } else if (route.endsWith(".html")) {
        viewPath = route;
      } else {
        viewPath = `${route}.html`;
      }

      // Fetch the view template
      const view = await useStorage("assets:views").getItem(viewPath);

      if (!view) {
        console.log("View not found:", viewPath);
        throw createError({
          statusCode: 404,
          statusMessage: "Page not found",
        });
      }

      // Compile and render the Handlebars template
      const template = Handlebars.compile(view);
      const renderedContent = template(data);

      return renderedContent;
    } catch (error) {
      // Handle errors gracefully
      console.error("Error in definePage:", error);
      throw createError({
        statusCode: error.statusCode || 500,
        statusMessage: error.message || "Internal Server Error",
      });
    }
  });
}
