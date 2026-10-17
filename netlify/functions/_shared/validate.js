const NAME_MAX = 60;
const PHONE_ERROR = "Unesi ispravan broj telefona (8–15 cifara).";

const NAME_TOO_LONG = {
  firstName: "Ime može imati najviše 60 karaktera.",
  lastName: "Prezime može imati najviše 60 karaktera.",
};

function validateName(value, which) {
  const name = String(value || "").trim();
  if (!name) return { ok: false, empty: true };
  if (name.length > NAME_MAX) return { ok: false, error: NAME_TOO_LONG[which] || NAME_TOO_LONG.firstName };
  return { ok: true, name };
}

function validatePhone(input) {
  const raw = String(input || "").trim();
  if (!raw || raw.length > 40) return { ok: false, error: PHONE_ERROR };
  const stripped = raw.replace(/[\s()\u2010\u2011\u2012\u2013\u2014-]/g, "");
  if (!/^\+?\d+$/.test(stripped)) return { ok: false, error: PHONE_ERROR };
  const digits = stripped.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15 || /^0+$/.test(digits)) {
    return { ok: false, error: PHONE_ERROR };
  }
  return { ok: true, phone: raw, digits };
}

function cleanRequestId(value) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return "";
  return id;
}

module.exports = {
  NAME_MAX,
  PHONE_ERROR,
  validateName,
  validatePhone,
  cleanRequestId,
};
