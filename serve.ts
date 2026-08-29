import { file } from "bun";
import { join } from "path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (pathname === "/") {
      pathname = "/index.html";
    }

    const filePath = join(import.meta.dir, pathname);
    const f = file(filePath);

    if (!(await f.exists())) {
      const notFound = file(join(import.meta.dir, "404.html"));
      if (await notFound.exists()) {
        return new Response(notFound, {
          status: 404,
          headers: { "Content-Type": "text/html" },
        });
      }
      return new Response("Not Found", { status: 404 });
    }

    const ext = pathname.slice(pathname.lastIndexOf("."));
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new Response(f, {
      headers: { "Content-Type": contentType },
    });
  },
});

console.log("Serving at http://localhost:3000");
