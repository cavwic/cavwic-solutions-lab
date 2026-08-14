import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist");
const base = "/cavwic-solutions-lab";
const mime = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".mjs": "text/javascript", ".pdf": "application/pdf", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".zip": "application/zip" };

createServer((request, response) => {
  const rawPath = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  const localPath = rawPath.startsWith(base) ? rawPath.slice(base.length) || "/" : rawPath;
  let filePath = normalize(join(root, localPath));
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
    const type = mime[extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": `${type}${type.startsWith("text/") ? "; charset=utf-8" : ""}` });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}).listen(4332, "127.0.0.1");
