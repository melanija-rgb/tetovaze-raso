const { corsHeaders, json, noContent } = require("./_shared/http");
const {
  initBlobs,
  getGalleryIndex,
  getGalleryImage,
  resolveGalleryItemFile,
  ensureGallerySeeded,
} = require("./_shared/store");

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod === "OPTIONS") return noContent();
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const id = event.queryStringParameters?.id;
    if (!id) return json(400, { error: "Nedostaje id." });

    await ensureGallerySeeded();
    const index = await getGalleryIndex();
    const item = index.find((entry) => entry.id === id);

    if (item?.source === "static" && item.staticPath) {
      return {
        statusCode: 302,
        headers: {
          ...corsHeaders,
          Location: `/${item.staticPath.replace(/^\/+/, "")}`,
          "Cache-Control": "public, max-age=86400",
        },
        body: "",
      };
    }

    const fromDisk = resolveGalleryItemFile(item);
    if (fromDisk) {
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": fromDisk.contentType,
          "Cache-Control": "public, max-age=86400",
        },
        body: fromDisk.data.toString("base64"),
        isBase64Encoded: true,
      };
    }

    const image = await getGalleryImage(id);
    if (!image) return json(404, { error: "Slika nije pronađena." });

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": image.contentType,
        "Cache-Control": "public, max-age=86400",
      },
      body: image.data.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    return json(500, { error: error.message || "Server error" });
  }
};
