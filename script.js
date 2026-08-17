const MONTHS = [
  "Januar",
  "Februar",
  "Mart",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "Avgust",
  "Septembar",
  "Oktobar",
  "Novembar",
  "Decembar",
];

const TIMES = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

const API = "/api";

const overlay = document.querySelector("[data-booking-overlay]");
const openBtns = document.querySelectorAll("[data-open-booking]");
const closeBtn = document.querySelector("[data-close-booking]");
const isBookPage = document.body.classList.contains("page-book");
const form = document.querySelector("[data-booking-form]");
const calLabel = document.querySelector("[data-cal-label]");
const calGrid = document.querySelector("[data-cal-grid]");
const dateInput = document.querySelector("[data-date-input]");
const timeGrid = document.querySelector("[data-time-grid]");
const timeInput = document.querySelector("[data-time-input]");
const errorEl = document.querySelector("[data-booking-error]");
const successEl = document.querySelector("[data-booking-success]");
const submitBtn = document.querySelector("[data-submit-booking]");
const galleryGrid = document.querySelector("[data-gallery-grid]");
const inkIntro = document.querySelector("[data-ink-intro]");
const inkText = document.querySelector("[data-ink-text]");
const inkMachine = document.querySelector("[data-ink-machine]");
const inkWrite = document.querySelector("[data-ink-write]");
const inkLine = document.querySelector("[data-ink-line]");
const inkCaret = document.querySelector("[data-ink-caret]");
const inkStage = document.querySelector("[data-ink-stage]");
const inkFlash = document.querySelector("[data-ink-flash]");

const INK_PHRASE = "LET'S GET INKED";

let introRunning = false;
let impact = { x: 50, y: 50 };

const today = new Date();
today.setHours(0, 0, 0, 0);

let viewYear = today.getFullYear();
let viewMonth = today.getMonth();
let selectedDate = null;
let selectedTime = null;
let takenTimes = new Set();

function pad(n) {
  return String(n).padStart(2, "0");
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetInkIntro() {
  if (!inkIntro) return;
  inkIntro.classList.remove(
    "is-writing",
    "is-cracking",
    "is-cracked",
    "is-split",
    "is-done"
  );
  inkIntro.setAttribute("aria-hidden", "true");
  if (inkText) inkText.textContent = "";
  if (inkMachine) {
    inkMachine.style.transform = "translate3d(-999px, -999px, 0)";
    inkMachine.style.opacity = "0";
  }
  inkIntro.style.removeProperty("--impact-x");
  inkIntro.style.removeProperty("--impact-y");
  inkIntro.style.removeProperty("--gap");
}

function placeMachineOnCaret() {
  if (!inkMachine || !inkCaret || !inkLine) return;
  const lineRect = inkLine.getBoundingClientRect();
  const caretRect = inkCaret.getBoundingClientRect();
  const tipX = caretRect.left + caretRect.width * 0.5 - lineRect.left;
  const tipY = caretRect.top + caretRect.height * 0.72 - lineRect.top;

  const mw = inkMachine.offsetWidth || 34;
  const mh = inkMachine.offsetHeight || 52;
  const x = tipX - mw * 0.5;
  const y = tipY - mh * 0.88;

  inkMachine.style.opacity = "1";
  inkMachine.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function captureImpact() {
  if (!inkStage || !inkCaret) return;
  const stage = inkStage.getBoundingClientRect();
  const caret = inkCaret.getBoundingClientRect();
  const rawX = ((caret.left + caret.width * 0.5 - stage.left) / stage.width) * 100;
  const rawY = ((caret.top + caret.height * 0.65 - stage.top) / stage.height) * 100;
  // Pull the seam left so the shatter fills empty left space (text ends on the right)
  const x = rawX * 0.62 + 34 * 0.38;
  impact = {
    x: Math.min(62, Math.max(28, x)),
    y: Math.min(78, Math.max(22, rawY)),
  };
  inkIntro.style.setProperty("--impact-x", `${impact.x}%`);
  inkIntro.style.setProperty("--impact-y", `${impact.y}%`);
  if (inkFlash) {
    inkFlash.style.left = `${impact.x}%`;
    inkFlash.style.top = `${impact.y}%`;
  }
  buildLightningCracks(impact.x, impact.y);
}

function jaggedFromTo(x0, y0, x1, y1, zig = 5) {
  // Endpoints stay exact so every bolt shares the impact point.
  const pts = [`M ${x0.toFixed(2)} ${y0.toFixed(2)}`];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 1; i < zig; i += 1) {
    const t = i / zig;
    // Stronger zig in the middle, zero at the ends → lines converge cleanly
    const flare = Math.sin(t * Math.PI);
    const side = i % 2 === 0 ? 1 : -1;
    const amp = side * flare * (1.4 + Math.random() * 2.1);
    const x = x0 + dx * t + nx * amp;
    const y = y0 + dy * t + ny * amp;
    pts.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  pts.push(`L ${x1.toFixed(2)} ${y1.toFixed(2)}`);
  return pts.join(" ");
}

function buildMainCrack(cx, cy) {
  // Diagonal seam: from upper-left through impact, then down — fills left half
  const topX = Math.max(6, cx - 26);
  const botX = Math.min(90, cx + 6);
  const toImpact = jaggedFromTo(topX, -4, cx, cy, 6);
  const fromImpact = jaggedFromTo(cx, cy, botX, 104, 6).replace(/^M[^L]+/, "").trim();
  return `${toImpact} ${fromImpact}`;
}

function buildLightningCracks(cx, cy) {
  const p1 = document.querySelector("[data-crack-1]");
  const p2 = document.querySelector("[data-crack-2]");
  const p3 = document.querySelector("[data-crack-3]");
  const p4 = document.querySelector("[data-crack-4]");
  const p5 = document.querySelector("[data-crack-5]");
  if (!p1) return;

  // Round once so every path uses the identical impact coordinate
  const x = Number(cx.toFixed(2));
  const y = Number(cy.toFixed(2));

  p1.setAttribute("d", buildMainCrack(x, y));
  // Long bolts into the empty left side + shorter right chips
  p2.setAttribute("d", jaggedFromTo(x, y, -3, y - 36, 7));
  p3.setAttribute("d", jaggedFromTo(x, y, x + 38, y - 24, 5));
  if (p4) p4.setAttribute("d", jaggedFromTo(x, y, -5, y + 22, 7));
  if (p5) p5.setAttribute("d", jaggedFromTo(x, y, x - 42, y + 38, 6));
}

async function playInkIntro() {
  if (!inkIntro) {
    overlay.classList.add("is-ready");
    overlay.classList.remove("is-introing");
    return;
  }

  resetInkIntro();
  overlay.classList.add("is-introing");
  overlay.classList.remove("is-ready");
  await wait(260);
  await typeInkPhrase();
  await playShatter();
}

async function typeInkPhrase() {
  if (!inkText || !inkIntro) return;
  inkIntro.classList.add("is-writing");
  inkText.textContent = "";
  placeMachineOnCaret();

  for (let i = 0; i < INK_PHRASE.length; i += 1) {
    inkText.textContent = INK_PHRASE.slice(0, i + 1);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    placeMachineOnCaret();
    const ch = INK_PHRASE[i];
    const delay = ch === " " ? 160 : 105 + Math.random() * 70;
    await wait(delay);
  }

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  placeMachineOnCaret();
  captureImpact();
  await wait(900);
  inkIntro.classList.remove("is-writing");
}

async function playShatter() {
  captureImpact();
  inkIntro.classList.add("is-cracking");
  await wait(420);
  inkIntro.style.setProperty("--gap", "0.9%");
  inkIntro.classList.add("is-cracked");
  // Hold on the cracked screen before opening like a window
  await wait(1000);
  inkIntro.style.setProperty("--gap", "2.8%");
  await wait(90);
  inkIntro.classList.add("is-split");
  overlay.classList.add("is-ready");
  await wait(1050);
  inkIntro.classList.add("is-done");
  overlay.classList.remove("is-introing");
}

async function openBooking() {
  if (!overlay || introRunning) return;
  document.body.classList.remove("menu-open");
  document.querySelector("[data-menu-panel]")?.setAttribute("hidden", "");
  document.querySelector("[data-menu-backdrop]")?.setAttribute("hidden", "");
  document.querySelector("[data-menu-toggle]")?.classList.remove("is-open");
  introRunning = true;
  overlay.hidden = false;
  document.body.classList.add("is-locked");
  try {
    await playInkIntro();
    closeBtn?.focus?.();
  } finally {
    introRunning = false;
  }
}

function openBookingDirect() {
  if (!overlay) return;
  document.body.classList.remove("menu-open");
  document.querySelector("[data-menu-panel]")?.setAttribute("hidden", "");
  document.querySelector("[data-menu-backdrop]")?.setAttribute("hidden", "");
  document.querySelector("[data-menu-toggle]")?.classList.remove("is-open");
  resetInkIntro();
  if (inkIntro) {
    inkIntro.classList.add("is-done");
    inkIntro.setAttribute("aria-hidden", "true");
  }
  overlay.hidden = false;
  overlay.classList.remove("is-introing");
  overlay.classList.add("is-ready");
  document.body.classList.add("is-locked");
  closeBtn?.focus?.();
}

function closeBooking() {
  if (isBookPage) {
    window.location.href = "/";
    return;
  }
  if (!overlay) return;
  overlay.hidden = true;
  document.body.classList.remove("is-locked");
  overlay.classList.remove("is-ready", "is-introing");
  resetInkIntro();
  openBtns[0]?.focus();
}

function clearMessages() {
  errorEl.hidden = true;
  successEl.hidden = true;
  errorEl.textContent = "";
  successEl.textContent = "";
}

async function loadAvailability(date) {
  takenTimes = new Set();
  if (!date) return;
  try {
    const res = await fetch(`${API}/availability?date=${encodeURIComponent(date)}`);
    const data = await res.json();
    if (res.ok && Array.isArray(data.taken)) {
      takenTimes = new Set(data.taken);
    }
  } catch {
    // keep empty — form still works, server validates conflicts
  }
}

function renderTimes() {
  timeGrid.innerHTML = "";
  TIMES.forEach((time) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "time-slot";
    btn.textContent = time;
    const taken = takenTimes.has(time);
    if (taken) {
      btn.disabled = true;
      btn.classList.add("is-muted");
      btn.title = "Zauzeto";
    }
    if (selectedTime === time) btn.classList.add("is-selected");
    btn.addEventListener("click", () => {
      if (taken) return;
      selectedTime = time;
      timeInput.value = time;
      renderTimes();
      clearMessages();
    });
    timeGrid.appendChild(btn);
  });
}

function renderCalendar() {
  calLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
  calGrid.innerHTML = "";

  const first = new Date(viewYear, viewMonth, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < startOffset; i += 1) {
    const empty = document.createElement("span");
    empty.className = "cal-day is-muted";
    empty.setAttribute("aria-hidden", "true");
    calGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(viewYear, viewMonth, day);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-day";
    btn.textContent = String(day);

    const isPast = date < today;
    const weekday = date.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    if (isPast || isWeekend) {
      btn.disabled = true;
      btn.classList.add("is-muted");
    }

    const iso = toISODate(date);
    if (selectedDate === iso) btn.classList.add("is-selected");

    btn.addEventListener("click", async () => {
      selectedDate = iso;
      dateInput.value = iso;
      selectedTime = null;
      timeInput.value = "";
      renderCalendar();
      clearMessages();
      await loadAvailability(iso);
      renderTimes();
    });

    calGrid.appendChild(btn);
  }
}

async function loadGallery() {
  if (!galleryGrid) return;

  try {
    const res = await fetch(`${API}/gallery`);
    const data = await res.json();
    galleryGrid.innerHTML = "";

    const items = res.ok && Array.isArray(data.items) ? data.items : [];

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "gallery-empty";
      empty.textContent = "Galerija uskoro.";
      galleryGrid.appendChild(empty);
      return;
    }

    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-item";
      button.setAttribute("aria-label", `Otvori: ${item.name || "rad"}`);
      const img = document.createElement("img");
      const staticUrl = item.staticPath
        ? `/${String(item.staticPath).replace(/^\/+/, "")}`
        : "";
      img.src = staticUrl || item.url;
      img.alt = item.name || "Rad iz galerije";
      img.loading = "lazy";
      button.appendChild(img);
      button.addEventListener("click", () => openLightbox(items, index));
      galleryGrid.appendChild(button);
    });
  } catch {
    galleryGrid.innerHTML = '<p class="gallery-empty">Galerija trenutno nije dostupna.</p>';
  }
}

const lightbox = document.querySelector("[data-lightbox]");
const lightboxImg = document.querySelector("[data-lightbox-img]");
const lightboxCaption = document.querySelector("[data-lightbox-caption]");
let lightboxItems = [];
let lightboxIndex = 0;

function openLightbox(items, index) {
  if (!lightbox) return;
  lightboxItems = items;
  lightboxIndex = index;
  renderLightbox();
  lightbox.hidden = false;
  document.body.classList.add("is-locked");
}

function closeLightbox() {
  if (!lightbox || lightbox.hidden) return;
  lightbox.hidden = true;
  if (overlay?.hidden) document.body.classList.remove("is-locked");
}

function renderLightbox() {
  const item = lightboxItems[lightboxIndex];
  if (!item || !lightboxImg) return;
  const staticUrl = item.staticPath
    ? `/${String(item.staticPath).replace(/^\/+/, "")}`
    : "";
  lightboxImg.src = staticUrl || item.url;
  lightboxImg.alt = item.name || "";
  if (lightboxCaption) lightboxCaption.textContent = item.name || "";
}

function stepLightbox(delta) {
  if (!lightboxItems.length) return;
  lightboxIndex = (lightboxIndex + delta + lightboxItems.length) % lightboxItems.length;
  renderLightbox();
}

if (lightbox) {
  lightbox.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
  lightbox.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => stepLightbox(-1));
  lightbox.querySelector("[data-lightbox-next]")?.addEventListener("click", () => stepLightbox(1));
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
}

openBtns.forEach((btn) => btn.addEventListener("click", openBooking));
if (closeBtn && closeBtn.tagName !== "A") {
  closeBtn.addEventListener("click", closeBooking);
}

overlay?.addEventListener("click", (event) => {
  if (isBookPage) return;
  if (event.target === overlay) closeBooking();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (lightbox && !lightbox.hidden) {
      closeLightbox();
      return;
    }
    if (isBookPage) {
      window.location.href = "/";
      return;
    }
    if (overlay && !overlay.hidden) closeBooking();
  }
  if (lightbox && !lightbox.hidden) {
    if (event.key === "ArrowLeft") stepLightbox(-1);
    if (event.key === "ArrowRight") stepLightbox(1);
  }
});

document.querySelector("[data-cal-prev]").addEventListener("click", () => {
  viewMonth -= 1;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear -= 1;
  }
  renderCalendar();
});

document.querySelector("[data-cal-next]").addEventListener("click", () => {
  viewMonth += 1;
  if (viewMonth > 11) {
    viewMonth = 0;
    viewYear += 1;
  }
  renderCalendar();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessages();

  const data = new FormData(form);
  const payload = {
    firstName: String(data.get("firstName") || "").trim(),
    lastName: String(data.get("lastName") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    date: String(data.get("date") || "").trim(),
    time: String(data.get("time") || "").trim(),
  };

  if (!payload.date || !payload.time || !payload.firstName || !payload.lastName || !payload.phone) {
    errorEl.hidden = false;
    errorEl.textContent = "Popuni datum, vrijeme, ime, prezime i broj telefona.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Šaljem…";

  try {
    const res = await fetch(`${API}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      errorEl.hidden = false;
      errorEl.textContent = result.error || "Rezervacija nije uspjela.";
      if (payload.date) {
        await loadAvailability(payload.date);
        renderTimes();
      }
      return;
    }

    successEl.hidden = false;
    successEl.textContent = `Termin sačuvan: ${payload.date} u ${payload.time} — ${payload.firstName} ${payload.lastName}.`;
    form.reset();
    selectedDate = null;
    selectedTime = null;
    dateInput.value = "";
    timeInput.value = "";
    takenTimes = new Set();
    renderCalendar();
    renderTimes();
  } catch {
    errorEl.hidden = false;
    errorEl.textContent = "Nema veze sa serverom. Pokušaj ponovo.";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Pošalji zahtjev";
  }
});

renderCalendar();
renderTimes();
loadGallery();

if (isBookPage) {
  const skipIntro = new URLSearchParams(window.location.search).has("direct");
  if (skipIntro) {
    openBookingDirect();
  } else {
    openBooking();
  }
}
