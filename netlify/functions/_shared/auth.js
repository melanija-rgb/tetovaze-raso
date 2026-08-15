const crypto = require("crypto");

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12h

function getSecret() {
  return process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || "dev-secret";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "raso-admin-2026";
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.exp || Date.now() > payload.exp) return null;
    if (payload.role !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}

function createAdminToken() {
  return signToken({
    role: "admin",
    exp: Date.now() + TOKEN_TTL_MS,
  });
}

function getBearerToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function requireAdmin(event) {
  const payload = verifyToken(getBearerToken(event));
  if (!payload) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return payload;
}

module.exports = {
  getAdminPassword,
  createAdminToken,
  requireAdmin,
  verifyToken,
};
