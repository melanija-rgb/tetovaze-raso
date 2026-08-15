const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let getStore = null;
try {
  ({ getStore } = require("@netlify/blobs"));
} catch {
  getStore = null;
}

const LOCAL_DIR = path.join(process.cwd(), ".data");

function ensureLocalDir(sub) {
  const dir = path.join(LOCAL_DIR, sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function localPath(sub, key) {
  const safe = String(key).replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(ensureLocalDir(sub), safe);
}

function forceLocal() {
  return process.env.USE_LOCAL_DATA === "1";
}

function getBlobStore() {
  if (forceLocal() || !getStore) return null;
  try {
    return getStore({ name: "tetovazeras-data", consistency: "strong" });
  } catch {
    return null;
  }
}

async function withStore(blobFn, localFn) {
  const store = getBlobStore();
  if (!store) return localFn();
  try {
    return await blobFn(store);
  } catch (error) {
    if (/missing|context|token|blobs/i.test(String(error?.message || error))) {
      return localFn();
    }
    throw error;
  }
}

function findGalleryAssetsDir() {
  const candidates = [
    path.join(process.cwd(), "assets", "gallery"),
    path.join(__dirname, "..", "..", "..", "assets", "gallery"),
    path.join(__dirname, "..", "..", "assets", "gallery"),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, "manifest.json"))) || null;
}

function contentTypeFor(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

async function listBookings() {
  return withStore(
    async (store) => {
      const { blobs } = await store.list({ prefix: "bookings/" });
      const items = await Promise.all(
        blobs.map(async (blob) => store.get(blob.key, { type: "json" }))
      );
      return items
        .filter(Boolean)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    () => {
      const dir = ensureLocalDir("bookings");
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }
  );
}

async function getBooking(id) {
  return withStore(
    (store) => store.get(`bookings/${id}`, { type: "json" }),
    () => {
      const file = localPath("bookings", `${id}.json`);
      if (!fs.existsSync(file)) return null;
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  );
}

async function saveBooking(booking) {
  return withStore(
    async (store) => {
      await store.setJSON(`bookings/${booking.id}`, booking);
      return booking;
    },
    () => {
      fs.writeFileSync(
        localPath("bookings", `${booking.id}.json`),
        JSON.stringify(booking, null, 2)
      );
      return booking;
    }
  );
}

async function deleteBooking(id) {
  return withStore(
    (store) => store.delete(`bookings/${id}`),
    () => {
      const file = localPath("bookings", `${id}.json`);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  );
}

async function findConflict(date, time) {
  const all = await listBookings();
  return all.find((b) => b.date === date && b.time === time && b.status !== "cancelled");
}

async function getGalleryIndex() {
  return withStore(
    async (store) => {
      const index = await store.get("gallery/index", { type: "json" });
      return Array.isArray(index) ? index : [];
    },
    () => {
      const file = localPath("gallery", "index.json");
      if (!fs.existsSync(file)) return [];
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  );
}

async function setGalleryIndex(index) {
  return withStore(
    (store) => store.setJSON("gallery/index", index),
    () => {
      fs.writeFileSync(localPath("gallery", "index.json"), JSON.stringify(index, null, 2));
    }
  );
}

async function saveGalleryImage(id, buffer, contentType) {
  return withStore(
    (store) =>
      store.set(`gallery/files/${id}`, buffer, {
        metadata: { contentType },
      }),
    () => {
      fs.writeFileSync(localPath("gallery", `${id}.meta.json`), JSON.stringify({ contentType }));
      fs.writeFileSync(localPath("gallery", `${id}.bin`), buffer);
    }
  );
}

async function getGalleryImage(id) {
  return withStore(
    async (store) => {
      const result = await store.getWithMetadata(`gallery/files/${id}`, {
        type: "arrayBuffer",
      });
      if (!result?.data) return null;
      return {
        data: Buffer.from(result.data),
        contentType: result.metadata?.contentType || "application/octet-stream",
      };
    },
    () => {
      const metaFile = localPath("gallery", `${id}.meta.json`);
      const binFile = localPath("gallery", `${id}.bin`);
      if (!fs.existsSync(binFile)) return null;
      const meta = fs.existsSync(metaFile)
        ? JSON.parse(fs.readFileSync(metaFile, "utf8"))
        : { contentType: "application/octet-stream" };
      return { data: fs.readFileSync(binFile), contentType: meta.contentType };
    }
  );
}

async function deleteGalleryImage(id) {
  const index = await getGalleryIndex();
  const item = index.find((entry) => entry.id === id);

  if (item?.source !== "static") {
    await withStore(
      (store) => store.delete(`gallery/files/${id}`),
      () => {
        for (const suffix of [".bin", ".meta.json"]) {
          const file = localPath("gallery", `${id}${suffix}`);
          if (fs.existsSync(file)) fs.unlinkSync(file);
        }
      }
    );
  }

  await setGalleryIndex(index.filter((entry) => entry.id !== id));
}

/**
 * First-run seed: register portfolio images into shared DB index.
 * Static files stay on CDN/disk; admin uploads go into Blobs/.data.
 * Admin deletes stay deleted (no re-sync of removed static ids).
 */
async function ensureGallerySeeded() {
  const existing = await getGalleryIndex();
  if (existing.length > 0) return existing;

  const dir = findGalleryAssetsDir();
  if (!dir) return [];

  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return [];

  let manifest = [];
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return [];
  }
  if (!Array.isArray(manifest) || !manifest.length) return [];

  const seeded = [];
  for (let i = 0; i < manifest.length; i += 1) {
    const entry = manifest[i];
    const fileName = path.basename(String(entry.src || ""));
    const filePath = path.join(dir, fileName);
    if (!fileName || !fs.existsSync(filePath)) continue;

    const staticPath = `assets/gallery/${fileName}`.replace(/\\/g, "/");
    seeded.push({
      id: `static_${String(i + 1).padStart(2, "0")}`,
      name: "",
      contentType: contentTypeFor(fileName),
      createdAt: new Date(Date.now() - (manifest.length - i) * 1000).toISOString(),
      source: "static",
      staticPath,
    });
  }

  if (!seeded.length) return [];

  const again = await getGalleryIndex();
  if (again.length > 0) return again;

  await setGalleryIndex(seeded);
  return seeded;
}

function resolveGalleryItemFile(item) {
  if (!item) return null;
  if (item.source === "static" && item.staticPath) {
    const abs = path.join(process.cwd(), item.staticPath);
    if (fs.existsSync(abs)) {
      return {
        data: fs.readFileSync(abs),
        contentType: item.contentType || contentTypeFor(item.staticPath),
      };
    }
    const alt = findGalleryAssetsDir();
    if (alt) {
      const nested = path.join(alt, path.basename(item.staticPath));
      if (fs.existsSync(nested)) {
        return {
          data: fs.readFileSync(nested),
          contentType: item.contentType || contentTypeFor(nested),
        };
      }
    }
  }
  return null;
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function publicGalleryItem(item) {
  if (item.source === "static" && item.staticPath) {
    return {
      ...item,
      url: `/${item.staticPath.replace(/^\/+/, "")}`,
    };
  }
  return {
    ...item,
    url: `/api/gallery-file?id=${encodeURIComponent(item.id)}`,
  };
}

module.exports = {
  listBookings,
  getBooking,
  saveBooking,
  deleteBooking,
  findConflict,
  getGalleryIndex,
  setGalleryIndex,
  saveGalleryImage,
  getGalleryImage,
  deleteGalleryImage,
  ensureGallerySeeded,
  resolveGalleryItemFile,
  publicGalleryItem,
  newId,
};
