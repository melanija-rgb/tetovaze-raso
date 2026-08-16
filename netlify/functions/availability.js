const { json, noContent } = require("./_shared/http");
const { initBlobs, listBookings } = require("./_shared/store");

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod === "OPTIONS") return noContent();
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const date = String(event.queryStringParameters?.date || "").trim();
    if (!date) return json(400, { error: "Nedostaje date." });

    const bookings = await listBookings();
    const taken = bookings
      .filter((b) => b.date === date && b.status !== "cancelled")
      .map((b) => b.time);

    return json(200, { date, taken });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || "Server error" });
  }
};
