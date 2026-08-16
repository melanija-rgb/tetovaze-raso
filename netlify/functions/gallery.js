const { json, noContent, readJson } = require("./_shared/http");
const { requireAdmin } = require("./_shared/auth");
const {
  initBlobs,
  getGalleryIndex,
  setGalleryIndex,
  saveGalleryImage,
  deleteGalleryImage,
  ensureGallerySeeded,
  publicGalleryItem,
  newId,
} = require("./_shared/store");

const MAX_BYTES = 4.5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod === "OPTIONS") return noContent();

  try {
    if (event.httpMethod === "GET") {
      const index = await ensureGallerySeeded();
      return json(200, {
        items: index.map(publicGalleryItem),
      });
    }

    if (event.httpMethod === "POST") {
      requireAdmin(event);
      await ensureGallerySeeded();

      const body = readJson(event);
      const name = String(body.name || "slika").trim().slice(0, 120);
      const contentType = String(body.contentType || "").toLowerCase();
      const dataUrl = String(body.data || "");

      if (!ALLOWED_TYPES.has(contentType)) {
        return json(400, { error: "Dozvoljeni formati: JPG, PNG, WEBP, GIF." });
      }

      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      if (!base64) return json(400, { error: "Nedostaje slika." });

      const buffer = Buffer.from(base64, "base64");
      if (!buffer.length) return json(400, { error: "Neispravna slika." });
      if (buffer.length > MAX_BYTES) {
        return json(400, { error: "Slika je prevelika (max ~4.5MB)." });
      }

      const id = newId("img");
      await saveGalleryImage(id, buffer, contentType);

      const index = await getGalleryIndex();
      const item = {
        id,
        name,
        contentType,
        createdAt: new Date().toISOString(),
        source: "blob",
      };
      index.unshift(item);
      await setGalleryIndex(index);

      return json(201, { item: publicGalleryItem(item) });
    }

    if (event.httpMethod === "DELETE") {
      requireAdmin(event);
      const id = event.queryStringParameters?.id;
      if (!id) return json(400, { error: "Nedostaje id." });

      const index = await getGalleryIndex();
      const exists = index.some((item) => item.id === id);
      if (!exists) return json(404, { error: "Slika nije pronađena." });

      await deleteGalleryImage(id);
      return json(200, { ok: true });
    }

    return json(405, { error: "Method not allowed" });
  } catch (error) {
    const status = error.statusCode || 500;
    return json(status, { error: error.message || "Server error" });
  }
};
