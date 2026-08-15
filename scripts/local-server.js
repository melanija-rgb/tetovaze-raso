/**
 * Local static + API server mirroring Netlify redirects.
 * Uses USE_LOCAL_DATA=1 filesystem store (same as Netlify Blobs shape).
 */
process.env.USE_LOCAL_DATA = process.env.USE_LOCAL_DATA || "1";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "raso-admin-2026";
process.env.ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || "tetovazeras-dev-secret-change-me";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const root = path.join(__dirname, "..");
const port = Number(process.env.PORT || 8888);

const handlers = {
  "admin-login": require("../netlify/functions/admin-login").handler,
  bookings: require("../netlify/functions/bookings").handler,
  availability: require("../netlify/functions/availability").handler,
  gallery: require("../netlify/functions/gallery").handler,
  "gallery-file": require("../netlify/functions/gallery-file").handler,
};

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function handleApi(req, res, pathname) {
  const name = pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  const handler = handlers[name];
  if (!handler) {
    send(res, 404, JSON.stringify({ error: "Not found" }), {
      "Content-Type": "application/json",
    });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const raw = await readBody(req);
  const event = {
    httpMethod: req.method,
    headers: req.headers,
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body: raw.length ? raw.toString("utf8") : null,
    isBase64Encoded: false,
  };

  const result = await handler(event);
  const headers = result.headers || {};
  let body = result.body || "";
  if (result.isBase64Encoded) {
    body = Buffer.from(body, "base64");
  }
  send(res, result.statusCode || 200, body, headers);
}

function handleStatic(req, res, pathname) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  if (filePath.endsWith("/")) filePath += "index.html";
  const abs = path.normalize(path.join(root, filePath));
  if (!abs.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    send(res, 404, "Not found");
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  send(res, 200, fs.readFileSync(abs), {
    "Content-Type": mime[ext] || "application/octet-stream",
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    handleStatic(req, res, url.pathname);
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message || "Server error" }), {
      "Content-Type": "application/json",
    });
  }
});

server.listen(port, () => {
  console.log(`Tetovazeras local server: http://localhost:${port}`);
  console.log(`Admin: http://localhost:${port}/admin/`);
});
