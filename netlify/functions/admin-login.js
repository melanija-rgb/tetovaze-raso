const { json, noContent, readJson } = require("./_shared/http");
const { getAdminPassword, createAdminToken } = require("./_shared/auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = readJson(event);
    const password = String(body.password || "");
    if (!password || password !== getAdminPassword()) {
      return json(401, { error: "Pogrešna lozinka." });
    }

    const token = createAdminToken();
    return json(200, {
      token,
      expiresInHours: 12,
    });
  } catch (error) {
    return json(400, { error: error.message || "Bad request" });
  }
};
