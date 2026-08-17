/**
 * Production-style flow test:
 * public booking → shared DB → admin list
 * gallery seed via API → admin can list
 */
process.env.USE_LOCAL_DATA = "1";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "raso-admin-2026";
process.env.ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || "tetovazeras-dev-secret-change-me";

const fs = require("fs");
const path = require("path");

const login = require("../netlify/functions/admin-login").handler;
const bookings = require("../netlify/functions/bookings").handler;
const gallery = require("../netlify/functions/gallery").handler;

function tomorrowWeekday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function invoke(handler, method, { body, token, query } = {}) {
  const event = {
    httpMethod: method,
    headers: token
      ? { authorization: `Bearer ${token}`, "content-type": "application/json" }
      : { "content-type": "application/json" },
    queryStringParameters: query || {},
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
  };
  const result = await handler(event);
  const parsed = result.body ? JSON.parse(result.body) : {};
  return { status: result.statusCode, data: parsed };
}

function assert( cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

(async () => {
  // Reset gallery index so seed runs cleanly for this test
  const indexFile = path.join(process.cwd(), ".data", "gallery", "index.json");
  if (fs.existsSync(indexFile)) fs.unlinkSync(indexFile);

  console.log("1) Public creates booking…");
  const date = tomorrowWeekday();
  const created = await invoke(bookings, "POST", {
    body: {
      firstName: "Produkcija",
      lastName: "Test",
      phone: "+38766123456",
      date,
      time: "11:00",
    },
  });
  assert(created.status === 201, `create status ${created.status} ${JSON.stringify(created.data)}`);
  console.log("   OK", created.data.booking.id);

  console.log("2) Admin login…");
  const auth = await invoke(login, "POST", {
    body: { password: process.env.ADMIN_PASSWORD },
  });
  assert(auth.status === 200 && auth.data.token, "admin login");
  console.log("   OK token");

  console.log("3) Admin loads bookings from shared DB…");
  const listed = await invoke(bookings, "GET", { token: auth.data.token });
  assert(listed.status === 200, "list bookings");
  const found = (listed.data.bookings || []).find((b) => b.id === created.data.booking.id);
  assert(found, "booking visible in admin");
  console.log("   OK", found.date, found.time, found.firstName, found.lastName);

  console.log("4) Gallery seed + public/admin API list…");
  const gal = await invoke(gallery, "GET");
  assert(gal.status === 200, "gallery get");
  assert((gal.data.items || []).length >= 18, `expected >=18 images, got ${(gal.data.items || []).length}`);
  console.log("   OK items:", gal.data.items.length);

  console.log("5) Admin deletes one gallery item…");
  const victim = gal.data.items[0];
  const deleted = await invoke(gallery, "DELETE", {
    token: auth.data.token,
    query: { id: victim.id },
  });
  assert(deleted.status === 200, "gallery delete");
  const after = await invoke(gallery, "GET");
  assert(
    !(after.data.items || []).some((i) => i.id === victim.id),
    "deleted image gone from API"
  );
  console.log("   OK deleted", victim.id);

  console.log("FLOW PASS — booking + gallery API ready for production");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
