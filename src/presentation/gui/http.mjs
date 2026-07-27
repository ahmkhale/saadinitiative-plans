import fs from "node:fs";
import path from "node:path";

export function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}

export function text(res, status, value, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(value);
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) reject(new Error("Request body is too large."));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

export function serveFile(res, filePath, type) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return text(res, 404, "Not found");
  }
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  fs.createReadStream(filePath).pipe(res);
}

export function safeFile(root, relative) {
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return target;
}

export function distUrl(filePath, root) {
  const relative = path.relative(root, filePath).split(path.sep).map(encodeURIComponent).join("/");
  return `/dist/${relative}`;
}

export function contentType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".json": "application/json; charset=utf-8",
    ".ttf": "font/ttf",
  }[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
