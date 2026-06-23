const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "dist");
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

http
  .createServer((req, res) => {
    const requestPath = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname
    );
    let filePath = path.join(root, requestPath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.stat(filePath, (statError, stat) => {
      if (!statError && stat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      } else if (statError) {
        filePath = path.join(root, "index.html");
      }

      fs.readFile(filePath, (readError, data) => {
        if (readError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        res.writeHead(200, {
          "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
        });
        res.end(data);
      });
    });
  })
  .listen(3000, "127.0.0.1", () => {
    console.log("http://localhost:3000");
  });
