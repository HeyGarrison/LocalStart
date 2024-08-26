export default defineEventHandler(async (event) => {
  const route = getRouterParam(event, "route") || "index.html";
  const data = await useStorage("assets:app").getItem(
    route.endsWith(".html") ? route : `${route}.html`,
  );
  if (!data) {
    return "404";
  }
  return data;
});
