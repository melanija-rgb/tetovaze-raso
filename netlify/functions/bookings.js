const { json, noContent, readJson } = require("./_shared/http");
const { requireAdmin } = require("./_shared/auth");
const { validateName, validatePhone, cleanRequestId } = require("./_shared/validate");
const {
  initBlobs,
  listBookings,
  saveBooking,
  deleteBooking,
  findConflict,
  getBooking,
  claimSlot,
  getSlot,
  releaseSlot,
  newId,
} = require("./_shared/store");

const ALLOWED_TIMES = new Set([
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
]);

const CONFLICT_ERROR = "Termin je već zauzet. Izaberi drugo vrijeme.";

function isValidDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return false;
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  return true;
}

async function replayOrConflict(date, time, requestId) {
  const conflict = await findConflict(date, time);
  if (conflict) {
    if (requestId && conflict.requestId === requestId) return { replay: conflict };
    return { conflict: true };
  }

  const holder = await getSlot(date, time);
  if (!holder?.id) return {};

  const saved = await getBooking(holder.id);
  if (saved?.status === "cancelled") {
    await releaseSlot(date, time, holder.id);
    return {};
  }

  if (!saved) await saveBooking(holder);
  const booking = saved || holder;
  if (booking.status === "cancelled") return {};
  if (requestId && booking.requestId === requestId) return { replay: booking };
  return { conflict: true };
}

exports.handler = async (event) => {
  initBlobs(event);
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
      const requestId = cleanRequestId(body.requestId);

      if (!firstName || !lastName || !phone || !date || !time) {
        return json(400, { error: "Sva polja su obavezna." });
      }

      const first = validateName(firstName, "firstName");
      const last = validateName(lastName, "lastName");
      if (!first.ok) return json(400, { error: first.error });
      if (!last.ok) return json(400, { error: last.error });

      const phoneResult = validatePhone(phone);
      if (!phoneResult.ok) return json(400, { error: phoneResult.error });

      if (!isValidDate(date)) {
        return json(400, { error: "Datum nije dostupan." });
      }
      if (!ALLOWED_TIMES.has(time)) {
        return json(400, { error: "Vrijeme nije dostupno." });
      }

      const existing = await replayOrConflict(date, time, requestId);
      if (existing.replay) return json(200, { booking: existing.replay });
      if (existing.conflict) return json(409, { error: CONFLICT_ERROR });

      const booking = {
        id: newId("bk"),
        firstName: first.name,
        lastName: last.name,
        phone: phoneResult.phone,
        date,
        time,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      if (requestId) booking.requestId = requestId;

      const claimed = await claimSlot(date, time, booking);
      if (!claimed) {
        const again = await replayOrConflict(date, time, requestId);
        if (again.replay) return json(200, { booking: again.replay });
        return json(409, { error: CONFLICT_ERROR });
      }

      try {
        await saveBooking(booking);
      } catch (error) {
        await releaseSlot(date, time, booking.id);
        throw error;
      }
      return json(201, { booking });
    }

    if (event.httpMethod === "PATCH") {
      requireAdmin(event);
      const body = readJson(event);
      const id = String(body.id || event.queryStringParameters?.id || "").trim();
      const status = String(body.status || "").trim();
      if (!id) return json(400, { error: "Nedostaje id." });
      if (status !== "confirmed" && status !== "cancelled") {
        return json(400, { error: "Status nije podržan." });
      }

      const existing = await getBooking(id);
      if (!existing) return json(404, { error: "Termin nije pronađen." });

      if (status === "confirmed") {
        if (existing.status === "cancelled") {
          return json(400, { error: "Otkazana rezervacija se ne može potvrditi." });
        }
        if (existing.status !== "confirmed") {
          existing.status = "confirmed";
          existing.updatedAt = new Date().toISOString();
          await saveBooking(existing);
        }
        return json(200, { booking: existing });
      }

      if (existing.status !== "cancelled") {
        await releaseSlot(existing.date, existing.time, existing.id);
        existing.status = "cancelled";
        existing.updatedAt = new Date().toISOString();
        await saveBooking(existing);
      } else {
        await releaseSlot(existing.date, existing.time, existing.id);
      }
      return json(200, { booking: existing });
    }

    if (event.httpMethod === "DELETE") {
      requireAdmin(event);
      const id = event.queryStringParameters?.id;
      if (!id) return json(400, { error: "Nedostaje id." });
      const existing = await getBooking(id);
      if (!existing) return json(404, { error: "Termin nije pronađen." });
      await releaseSlot(existing.date, existing.time, existing.id);
      await deleteBooking(id);
      return json(200, { ok: true });
    }

    return json(405, { error: "Method not allowed" });
  } catch (error) {
    const status = error.statusCode || 500;
    return json(status, { error: error.message || "Server error" });
  }
};
