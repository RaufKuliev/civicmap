import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const outRoot = path.resolve(process.cwd(), "out");
const mount = (process.env.STATIC_BASE_PATH ?? "").replace(/\/$/u, "");
const port = Number(process.env.STATIC_PORT ?? 4173);
const contentTypes: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };

http.createServer((request, response) => {
  const pathname = decodeURI(new URL(request.url ?? "/", "http://localhost").pathname);
  if (mount && pathname !== mount && !pathname.startsWith(`${mount}/`)) { response.writeHead(404); response.end("Not found"); return; }
  const relative = (mount ? pathname.slice(mount.length) : pathname).replace(/^\//u, "");
  let filePath = path.resolve(outRoot, relative || "index.html");
  if (!path.extname(filePath)) filePath = path.join(filePath, "index.html");
  if (!filePath.startsWith(outRoot) || !fs.existsSync(filePath)) {
    console.error(`STATIC_404 ${pathname}`);
    filePath = path.join(outRoot, "404.html");
  }
  response.writeHead(filePath.endsWith("404.html") ? 404 : 200, { "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => console.log(`Static export: http://127.0.0.1:${port}${mount || "/"}`));
