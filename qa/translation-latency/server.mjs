import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const portArgumentIndex = process.argv.indexOf("--port");
const port = Number(
  portArgumentIndex === -1 ? 4177 : process.argv[portArgumentIndex + 1]
);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname === "/" ? "/static.html" : url.pathname;
    const filePath = resolve(root, `.${pathname}`);
    if (!filePath.startsWith(root)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500).end(
      error.code === "ENOENT" ? "Not found" : String(error)
    );
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`TWP latency fixtures: http://127.0.0.1:${port}/`);
});
