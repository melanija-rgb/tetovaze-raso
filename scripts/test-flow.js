/**
 * End-to-end: public booking → store → admin list
 */
process.env.USE_LOCAL_DATA = "1";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "raso-admin-2026";
process.env.ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || "tetovazeras-dev-secret-change-me";

const login = require("../netlify/functions/admin-login").handler;
const bookings = require("../netlify/functions/bookings").handler;

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
    headers: token ? { authorization: `Bearer ${token}` } : {},
    queryStringParameters: query || {},
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
  };
  const result = await handler(event);
  const parsed = result.body ? JSON.parse(result.body) : {};
  return { status: result.statusCode, data: parsed };
}

(async () => {
  const date = tomorrowWeekday();
  const time = "10:00";

  console.log("1) Creating public booking…");
  const created = await invoke(bookings, "POST", {
    body: {
      firstName: "Test",
      lastName: "Korisnik",
      phone: "+38765111222",
      date,
      time,
    },
  });
  if (created.status !== 201) {
    console.error("FAIL create", created);
    process.exit(1);
  }
  console.log("   OK", created.data.booking.id);

  console.log("2) Admin login…");
  const auth = await invoke(login, "POST", {
    body: { password: process.env.ADMIN_PASSWORD },
  });
  if (auth.status !== 200 || !auth.data.token) {
    console.error("FAIL login", auth);
    process.exit(1);
  }
  console.log("   OK token");

  console.log("3) Admin loads bookings…");
  const listed = await invoke(bookings, "GET", { token: auth.data.token });
  if (listed.status !== 200) {
    console.error("FAIL list", listed);
    process.exit(1);
  }
  const found = (listed.data.bookings || []).find((b) => b.id === created.data.booking.id);
  if (!found) {
    console.error("FAIL booking not in admin list", listed.data);
    process.exit(1);
  }
  console.log("   OK found in admin:", found.date, found.time, found.firstName, found.lastName);
  console.log("FLOW PASS");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
