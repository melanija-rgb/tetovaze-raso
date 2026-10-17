/**
 * Booking rules: phone validation, atomic slot claim, idempotency,
 * confirmation payload, and admin confirm/cancel.
 */
process.env.USE_LOCAL_DATA = "1";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "raso-admin-2026";
process.env.ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || "tetovazeras-dev-secret-change-me";

const fs = require("fs");
const path = require("path");
const login = require("../netlify/functions/admin-login").handler;
const bookings = require("../netlify/functions/bookings").handler;
const availability = require("../netlify/functions/availability").handler;
const { PHONE_ERROR, validatePhone } = require("../netlify/functions/_shared/validate");
const { saveBooking } = require("../netlify/functions/_shared/store");

const createdIds = [];

function iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekdayFrom(start) {
  const date = new Date(start);
  date.setHours(12, 0, 0, 0);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return iso(date);
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
}

async function invoke(handler, method, { body, token, query } = {}) {
  const event = {
    httpMethod: method,
    headers: token
      ? { authorization: `Bearer ${token}`, "content-type": "application/json" }
      : { "content-type": "application/json" },
    queryStringParameters: query || null,
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
  };
  const result = await handler(event);
  let data = {};
  if (result.body) {
    try {
      data = JSON.parse(result.body);
    } catch {
      data = { raw: result.body };
    }
  }
  return { status: result.statusCode, data };
}

function slotFile(date, time) {
  const safe = `${date}_${time}.json`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(process.cwd(), ".data", "slots", safe);
}

(async () => {
  const anchor = new Date();
  anchor.setDate(anchor.getDate() + 21);
  const date = weekdayFrom(anchor);
  const later = new Date(anchor);
  later.setDate(later.getDate() + 7);
  const dateB = weekdayFrom(later);
  const phone = "061 123 456";

  console.log("1) Invalid phones are rejected with the same message");
  const invalidPhones = [
    "000000000",
    "00000000",
    "000 000 000",
    "abcdef",
    "06123abc456",
    "1234567",
    "1234567890123456",
    "++38761123456",
    "061 123 456a",
    "+",
  ];
  for (const value of invalidPhones) {
    const direct = validatePhone(value);
    assert(!direct.ok && direct.error === PHONE_ERROR, `validatePhone ${value}`);
    const res = await invoke(bookings, "POST", {
      body: { firstName: "Test", lastName: "Pravila", phone: value, date, time: "10:00" },
    });
    assert(res.status === 400 && res.data.error === PHONE_ERROR, `POST phone ${value} → ${res.status} ${res.data.error}`);
  }
  assert(!fs.existsSync(slotFile(date, "10:00")), "invalid phone must not claim a slot");

  console.log("2) Regional and international phones are accepted");
  const validPhones = [
    ["10:00", "061 123 456"],
    ["11:00", "+387 61 123 456"],
    ["12:00", "0038761123456"],
    ["13:00", "(065) 123-456"],
    ["14:00", "+1 (202) 555-0123"],
    ["15:00", "065123456"],
    ["16:00", "061–123–456"],
  ];
  for (const [time, value] of validPhones) {
    const res = await invoke(bookings, "POST", {
      body: { firstName: "Šaćir", lastName: "Đukić", phone: value, date, time },
    });
    assert(res.status === 201 && res.data.booking?.status === "pending", `valid ${value} → ${res.status} ${JSON.stringify(res.data)}`);
    assert(res.data.booking.phone === value, "store the typed phone");
    createdIds.push(res.data.booking.id);
    assert(fs.existsSync(slotFile(date, time)), `slot claimed for ${time}`);
  }

  console.log("3) Existing date/time/name checks stay strict");
  const past = await invoke(bookings, "POST", {
    body: { firstName: "Test", lastName: "Pravila", phone, date: "2020-01-06", time: "10:00" },
  });
  assert(past.status === 400 && past.data.error === "Datum nije dostupan.", past.data.error);

  const saturday = new Date(anchor);
  saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7));
  const weekend = await invoke(bookings, "POST", {
    body: { firstName: "Test", lastName: "Pravila", phone, date: iso(saturday), time: "10:00" },
  });
  assert(weekend.status === 400 && weekend.data.error === "Datum nije dostupan.", weekend.data.error);

  const badTime = await invoke(bookings, "POST", {
    body: { firstName: "Test", lastName: "Pravila", phone, date, time: "18:00" },
  });
  assert(badTime.status === 400 && badTime.data.error === "Vrijeme nije dostupno.", badTime.data.error);

  const missing = await invoke(bookings, "POST", {
    body: { firstName: "Test", lastName: "Pravila", phone: "", date, time: "17:00" },
  });
  assert(missing.status === 400 && missing.data.error === "Sva polja su obavezna.", missing.data.error);

  const longName = "A".repeat(61);
  const long = await invoke(bookings, "POST", {
    body: { firstName: longName, lastName: "Pravila", phone, date, time: "17:00" },
  });
  assert(long.status === 400 && long.data.error === "Ime može imati najviše 60 karaktera.", long.data.error);
  const longLast = await invoke(bookings, "POST", {
    body: { firstName: "Test", lastName: "B".repeat(61), phone, date, time: "17:00" },
  });
  assert(longLast.status === 400 && longLast.data.error === "Prezime može imati najviše 60 karaktera.", longLast.data.error);
  const maxName = await invoke(bookings, "POST", {
    body: { firstName: "A".repeat(60), lastName: "Pravila", phone, date, time: "17:00" },
  });
  assert(maxName.status === 201, `60-char name ${maxName.status}`);
  createdIds.push(maxName.data.booking.id);

  console.log("4) Sequential duplicate is 409; same request id replays");
  const seq = await invoke(bookings, "POST", {
    body: { firstName: "Test", lastName: "Pravila", phone, date: dateB, time: "10:00", requestId: "idem-key-sequential-01" },
  });
  assert(seq.status === 201, `first sequential ${seq.status}`);
  createdIds.push(seq.data.booking.id);
  const again = await invoke(bookings, "POST", {
    body: { firstName: "Test", lastName: "Pravila", phone, date: dateB, time: "10:00", requestId: "idem-key-sequential-01" },
  });
  assert(again.status === 200 && again.data.booking.id === seq.data.booking.id, `replay ${again.status} ${again.data.booking?.id}`);
  const other = await invoke(bookings, "POST", {
    body: { firstName: "Drugi", lastName: "Pravila", phone: "+38761123456", date: dateB, time: "10:00" },
  });
  assert(other.status === 409 && other.data.error === "Termin je već zauzet. Izaberi drugo vrijeme.", other.data.error);

  console.log("5) Concurrent posts yield one 201 and the rest 409");
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      invoke(bookings, "POST", {
        body: {
          firstName: "Istovremeno",
          lastName: `Pravila${i}`,
          phone: "065 111 222",
          date: dateB,
          time: "11:00",
          requestId: `race-key-${i}-xxxxxxxx`,
        },
      })
    )
  );
  const created = concurrent.filter((r) => r.status === 201);
  const conflicts = concurrent.filter((r) => r.status === 409);
  assert(created.length === 1, `expected one 201, got ${concurrent.map((r) => r.status).join(",")}`);
  assert(conflicts.length === 7, `expected seven 409, got ${conflicts.length}`);
  createdIds.push(created[0].data.booking.id);

  const sameKey = "same-request-race-key-01";
  const raced = await Promise.all([
    invoke(bookings, "POST", {
      body: { firstName: "Isti", lastName: "Zahtjev", phone: "066123456", date: dateB, time: "12:00", requestId: sameKey },
    }),
    invoke(bookings, "POST", {
      body: { firstName: "Isti", lastName: "Zahtjev", phone: "066123456", date: dateB, time: "12:00", requestId: sameKey },
    }),
  ]);
  const okRace = raced.filter((r) => r.status === 200 || r.status === 201);
  assert(okRace.length === 2, `idempotent race statuses ${raced.map((r) => r.status).join(",")}`);
  assert(okRace[0].data.booking.id === okRace[1].data.booking.id, "idempotent race returns one id");
  assert(raced.filter((r) => r.status === 201).length === 1, "idempotent race still creates once");
  createdIds.push(okRace[0].data.booking.id);

  console.log("6) Admin confirm keeps the slot; cancel frees it; no token is 401");
  const auth = await invoke(login, "POST", { body: { password: process.env.ADMIN_PASSWORD } });
  assert(auth.status === 200 && auth.data.token, "admin login");
  const token = auth.data.token;

  const unauth = await invoke(bookings, "PATCH", {
    body: { id: created[0].data.booking.id, status: "confirmed" },
  });
  assert(unauth.status === 401, `patch without token ${unauth.status}`);

  const listed = await invoke(bookings, "GET", { token });
  assert(listed.status === 200, "admin list");
  assert(listed.data.bookings.some((b) => b.id === created[0].data.booking.id), "new booking is listed");

  const confirmed = await invoke(bookings, "PATCH", {
    token,
    body: { id: created[0].data.booking.id, status: "confirmed" },
  });
  assert(confirmed.status === 200 && confirmed.data.booking.status === "confirmed", `confirm ${confirmed.status} ${confirmed.data.booking?.status}`);

  const blocked = await invoke(bookings, "POST", {
    body: { firstName: "Poslije", lastName: "Potvrde", phone, date: dateB, time: "11:00" },
  });
  assert(blocked.status === 409, `confirmed slot stays taken ${blocked.status}`);
  const taken = await invoke(availability, "GET", { query: { date: dateB } });
  assert(taken.status === 200 && taken.data.taken.includes("11:00"), `availability ${JSON.stringify(taken.data)}`);

  const cancelled = await invoke(bookings, "PATCH", {
    token,
    body: { id: created[0].data.booking.id, status: "cancelled" },
  });
  assert(cancelled.status === 200 && cancelled.data.booking.status === "cancelled", `cancel ${cancelled.status}`);
  assert(!fs.existsSync(slotFile(dateB, "11:00")), "cancel releases the slot lock");
  const free = await invoke(availability, "GET", { query: { date: dateB } });
  assert(free.status === 200 && !free.data.taken.includes("11:00"), `freed availability ${JSON.stringify(free.data.taken)}`);

  const rebooked = await invoke(bookings, "POST", {
    body: { firstName: "Ponovo", lastName: "Slobodno", phone: "+387 65 798 135", date: dateB, time: "11:00" },
  });
  assert(rebooked.status === 201 && rebooked.data.booking.status === "pending", `rebook ${rebooked.status}`);
  createdIds.push(rebooked.data.booking.id);

  const noReconfirm = await invoke(bookings, "PATCH", {
    token,
    body: { id: created[0].data.booking.id, status: "confirmed" },
  });
  assert(noReconfirm.status === 400, `cannot confirm cancelled ${noReconfirm.status}`);

  console.log("7) Legacy booking without a slot lock still blocks; cancelled legacy does not");
  const legacyDate = weekdayFrom(new Date(anchor.getTime() + 14 * 86400000));
  const legacy = {
    id: `bk_legacy_${Date.now().toString(36)}`,
    firstName: "Stari",
    lastName: "Zapis",
    phone: "061123456",
    date: legacyDate,
    time: "14:00",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await saveBooking(legacy);
  createdIds.push(legacy.id);
  const legacyHit = await invoke(bookings, "POST", {
    body: { firstName: "Novi", lastName: "Pokusaj", phone, date: legacyDate, time: "14:00" },
  });
  assert(legacyHit.status === 409, `legacy conflict ${legacyHit.status}`);
  legacy.status = "cancelled";
  await saveBooking(legacy);
  const legacyFree = await invoke(bookings, "POST", {
    body: { firstName: "Novi", lastName: "Pokusaj", phone, date: legacyDate, time: "14:00" },
  });
  assert(legacyFree.status === 201, `cancelled legacy frees the time ${legacyFree.status} ${JSON.stringify(legacyFree.data)}`);
  createdIds.push(legacyFree.data.booking.id);

  console.log("8) Client copy uses the same phone message and shows the reference");
  const client = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
  const admin = fs.readFileSync(path.join(__dirname, "..", "admin", "admin.js"), "utf8");
  assert(client.includes(PHONE_ERROR), "client phone message matches server");
  assert(client.includes("Broj rezervacije:"), "confirmation includes the reference");
  assert(client.includes("tetovazeras_booking_receipt"), "receipt is stored locally");
  assert(client.includes("data-error-for"), "per-field errors");
  assert(admin.includes("Potvrdi") && admin.includes("Otkaži"), "admin actions");
  assert(admin.includes('method: "PATCH"'), "admin patch");

  console.log("RULES PASS");
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const auth = await invoke(login, "POST", { body: { password: process.env.ADMIN_PASSWORD } });
    const token = auth.data.token;
    for (const id of createdIds) {
      if (!token) break;
      await invoke(bookings, "DELETE", { token, query: { id } });
    }
    if (process.exitCode) process.exit(process.exitCode);
  });
