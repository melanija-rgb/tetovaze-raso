const { json, noContent, readJson } = require("./_shared/http");
const { requireAdmin } = require("./_shared/auth");
const {
  listBookings,
  saveBooking,
  deleteBooking,
  findConflict,
  getBooking,
  newId,
} = require("./_shared/store");

const ALLOWED_TIMES = new Set([
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
]);

function isValidDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return false;
  if (d.getDay() === 0) return false;
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();

  try {
    if (event.httpMethod === "GET") {
      requireAdmin(event);
      const bookings = await listBookings();
      return json(200, { bookings });
    }

    if (event.httpMethod === "POST") {
      const body = readJson(event);
      const firstName = String(body.firstName || "").trim();
      const lastName = String(body.lastName || "").trim();
      const phone = String(body.phone || "").trim();
      const date = String(body.date || "").trim();
      const time = String(body.time || "").trim();

      if (!firstName || !lastName || !phone || !date || !time) {
        return json(400, { error: "Sva polja su obavezna." });
      }
      if (!isValidDate(date)) {
        return json(400, { error: "Datum nije dostupan." });
      }
      if (!ALLOWED_TIMES.has(time)) {
        return json(400, { error: "Vrijeme nije dostupno." });
      }

      const conflict = await findConflict(date, time);
      if (conflict) {
        return json(409, { error: "Termin je već zauzet. Izaberi drugo vrijeme." });
      }

      const booking = {
        id: newId("bk"),
        firstName,
        lastName,
        phone,
        date,
        time,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      await saveBooking(booking);
      return json(201, { booking });
    }

    if (event.httpMethod === "DELETE") {
      requireAdmin(event);
      const id = event.queryStringParameters?.id;
      if (!id) return json(400, { error: "Nedostaje id." });
      const existing = await getBooking(id);
      if (!existing) return json(404, { error: "Termin nije pronađen." });
      await deleteBooking(id);
      return json(200, { ok: true });
    }

    return json(405, { error: "Method not allowed" });
  } catch (error) {
    const status = error.statusCode || 500;
    return json(status, { error: error.message || "Server error" });
  }
};
