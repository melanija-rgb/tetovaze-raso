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
const inkFlash = document.querySelector("[data-ink-flash]");
const inkBurst = document.querySelector("[data-ink-burst]");
const inkText = document.querySelector("[data-ink-text]");
const inkMachine = document.querySelector("[data-ink-machine]");
const inkLine = document.querySelector("[data-ink-line]");
const inkCaret = document.querySelector("[data-ink-caret]");

const INK_PHRASE = "LET'S GET INKED";

let introRunning = false;
let burstRaf = 0;

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
  if (burstRaf) {
    cancelAnimationFrame(burstRaf);
    burstRaf = 0;
  }
  inkIntro.classList.remove(
    "is-writing",
    "is-flashing",
    "is-cracking",
    "is-shattering",
    "is-done"
  );
  inkIntro.setAttribute("aria-hidden", "true");
  if (inkText) inkText.textContent = "";
  if (inkMachine) {
    inkMachine.style.transform = "translate3d(-999px, -999px, 0)";
    inkMachine.style.opacity = "0";
  }
  if (inkBurst) {
    const ctx = inkBurst.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, inkBurst.width, inkBurst.height);
  }
}

function placeMachineOnCaret() {
  if (!inkMachine || !inkCaret || !inkLine) return;
  const lineRect = inkLine.getBoundingClientRect();
  const caretRect = inkCaret.getBoundingClientRect();
  if (!lineRect.width || !caretRect.height) return;

  const tipX = caretRect.left + caretRect.width * 0.5 - lineRect.left;
  const tipY = caretRect.top + caretRect.height * 0.72 - lineRect.top;
  const mw = inkMachine.offsetWidth || 34;
  const mh = inkMachine.offsetHeight || 52;

  inkMachine.style.opacity = "1";
  inkMachine.style.transform = `translate3d(${tipX - mw * 0.5}px, ${tipY - mh * 0.88}px, 0)`;
}

async function typeInkPhrase() {
  if (!inkText || !inkIntro) return;
  inkIntro.classList.add("is-writing");
  inkText.textContent = "";
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  placeMachineOnCaret();

  for (let i = 0; i < INK_PHRASE.length; i += 1) {
    inkText.textContent = INK_PHRASE.slice(0, i + 1);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    placeMachineOnCaret();
    const ch = INK_PHRASE[i];
    const delay = ch === " " ? 120 : 70 + Math.random() * 50;
    await wait(delay);
  }

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  placeMachineOnCaret();
  await wait(400);
  inkIntro.classList.remove("is-writing");
}

function shardBudget() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 719px)").matches;
  if (coarse || narrow) return 22;
  return 28;
}

function particleBudget() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 719px)").matches;
  if (coarse || narrow) return 40;
  return 64;
}

function buildCrackBranches(cx, cy, w, h) {
  const branches = [];
  const rays = 12 + Math.floor(Math.random() * 5);
  const maxR = Math.hypot(w, h) * 0.78;

  for (let i = 0; i < rays; i += 1) {
    const base = (i / rays) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
    const pts = [{ x: cx, y: cy }];
    let ang = base;
    let x = cx;
    let y = cy;
    const steps = 7 + (i % 3);
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      ang += (Math.random() - 0.5) * 0.48;
      const dist = maxR * Math.pow(t, 0.82) * (0.75 + Math.random() * 0.35);
      x = cx + Math.cos(ang) * dist + (Math.random() - 0.5) * 16;
      y = cy + Math.sin(ang) * dist + (Math.random() - 0.5) * 16;
      pts.push({ x, y });
      if (s > 1 && Math.random() > 0.38) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const forkLen = 40 + Math.random() * 110;
        const forkAng = ang + side * (0.65 + Math.random() * 0.85);
        branches.push([
          { x, y },
          {
            x: x + Math.cos(forkAng) * forkLen * 0.5,
            y: y + Math.sin(forkAng) * forkLen * 0.5,
          },
          {
            x: x + Math.cos(forkAng) * forkLen,
            y: y + Math.sin(forkAng) * forkLen,
          },
        ]);
      }
    }
    branches.push(pts);
  }
  return branches;
}

function jaggedEdge(cx, cy, a0, a1, r, steps, jitter) {
  const pts = [];
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const a = a0 + (a1 - a0) * t;
    const rr = r * (1 + (Math.random() - 0.5) * jitter);
    pts.push({
      x: cx + Math.cos(a) * rr + (Math.random() - 0.5) * 10,
      y: cy + Math.sin(a) * rr + (Math.random() - 0.5) * 10,
    });
  }
  return pts;
}

function buildShards(w, h, count) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const cover = Math.hypot(w, h) * 1.05;
  const rings = [
    { inner: 0, outer: cover * 0.32, share: 0.25 },
    { inner: cover * 0.26, outer: cover * 0.62, share: 0.35 },
    { inner: cover * 0.55, outer: cover * 1.12, share: 0.4 },
  ];

  const shards = [];
  let remaining = count;

  for (let r = 0; r < rings.length; r += 1) {
    const ring = rings[r];
    const n = r === rings.length - 1 ? remaining : Math.max(5, Math.round(count * ring.share));
    remaining -= n;
    const angleBias = Math.random() * Math.PI * 2;

    for (let i = 0; i < n; i += 1) {
      const span = (Math.PI * 2) / n;
      const wobble = span * (0.15 + Math.random() * 0.22);
      const a0 = angleBias + i * span - wobble * 0.55;
      const a1 = angleBias + (i + 1) * span + wobble * 0.55;
      const mid = (a0 + a1) * 0.5;
      const innerR = ring.inner * (0.82 + Math.random() * 0.22);
      const outerR = ring.outer * (0.92 + Math.random() * 0.18);
      const outerSteps = 3 + (i % 3);

      let pts;
      if (innerR < 10) {
        pts = [
          {
            x: cx + (Math.random() - 0.5) * 14,
            y: cy + (Math.random() - 0.5) * 14,
          },
          ...jaggedEdge(cx, cy, a0, a1, outerR, outerSteps, 0.18),
        ];
      } else {
        pts = [
          ...jaggedEdge(cx, cy, a0, a1, outerR, outerSteps, 0.15),
          ...jaggedEdge(cx, cy, a1, a0, innerR, 2 + (i % 2), 0.12),
        ];
      }

      // Break silhouette so pieces never look round
      for (let k = pts.length - 1; k > 0; k -= 1) {
        if (Math.random() > 0.55) {
          const prev = pts[k - 1];
          const cur = pts[k];
          pts.splice(k, 0, {
            x: (prev.x + cur.x) * 0.5 + (Math.random() - 0.5) * 28,
            y: (prev.y + cur.y) * 0.5 + (Math.random() - 0.5) * 28,
          });
        }
      }

      let bx = 0;
      let by = 0;
      for (let p = 0; p < pts.length; p += 1) {
        bx += pts[p].x;
        by += pts[p].y;
      }
      bx /= pts.length;
      by /= pts.length;

      const dist = Math.hypot(bx - cx, by - cy) || 1;
      const nx = (bx - cx) / dist;
      const ny = (by - cy) / dist;
      const speed = 11 + Math.random() * 15 + dist * 0.01;
      const shade = 4 + Math.floor(Math.random() * 14);
      const silver = 190 + Math.floor(Math.random() * 40);

      shards.push({
        pts,
        bx,
        by,
        x: 0,
        y: 0,
        rot: 0,
        vx: nx * speed + (Math.random() - 0.5) * 3.5,
        vy: ny * speed + (Math.random() - 0.5) * 3.5,
        vr: (Math.random() - 0.5) * 0.5,
        fill: `rgb(${shade},${shade},${shade + 4})`,
        edge: `rgba(${silver},${silver + 6},${silver + 12},${0.45 + Math.random() * 0.35})`,
        delay: Math.random() * 0.06,
      });
    }
  }

  return shards;
}

function runGlassShatter() {
  return new Promise((resolve) => {
    if (!inkBurst) {
      resolve();
      return;
    }

    const host = inkIntro || document.body;
    const rect = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width || window.innerWidth));
    const height = Math.max(1, Math.floor(rect.height || window.innerHeight));
    inkBurst.width = Math.floor(width * dpr);
    inkBurst.height = Math.floor(height * dpr);
    inkBurst.style.width = `${width}px`;
    inkBurst.style.height = `${height}px`;

    const ctx = inkBurst.getContext("2d");
    if (!ctx) {
      resolve();
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = width * 0.5;
    const cy = height * 0.5;
    const cracks = buildCrackBranches(cx, cy, width, height);
    const shards = buildShards(width, height, shardBudget());
    const particles = [];
    const pCount = particleBudget();
    for (let i = 0; i < pCount; i += 1) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 6 + Math.random() * 14;
      const len = 2.5 + Math.random() * 8;
      const thick = 0.4 + Math.random() * 1.15;
      const tone = 150 + Math.floor(Math.random() * 80);
      particles.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 40,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rot: ang + Math.PI * 0.5,
        vr: (Math.random() - 0.5) * 0.25,
        len,
        thick,
        life: 1,
        decay: 0.013 + Math.random() * 0.017,
        fill: `rgba(${tone},${tone + 8},${tone + 14},0.9)`,
      });
    }

    const startTime = performance.now();
    const CRACK_MS = 420;
    const SHATTER_AT = 360;
    const DURATION = 2300;

    const tick = (now) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, width, height);

      if (elapsed < SHATTER_AT) {
        // Solid dark glass pane — no circles
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#050505";
        ctx.fillRect(0, 0, width, height);

        const crackT = Math.min(1, elapsed / CRACK_MS);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 0; i < cracks.length; i += 1) {
          const pts = cracks[i];
          const visible = Math.max(2, Math.floor(pts.length * Math.max(0.1, crackT)));
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let p = 1; p < visible; p += 1) ctx.lineTo(pts[p].x, pts[p].y);
          ctx.strokeStyle = `rgba(160, 170, 180, ${0.15 + crackT * 0.25})`;
          ctx.lineWidth = i % 3 === 0 ? 2.8 : 1.8;
          ctx.stroke();
          ctx.strokeStyle = `rgba(236, 242, 248, ${0.5 + crackT * 0.45})`;
          ctx.lineWidth = i % 3 === 0 ? 1.35 : 0.85;
          ctx.stroke();
        }
      } else {
        const st = (elapsed - SHATTER_AT) / (DURATION - SHATTER_AT);
        const ease = 1 - Math.pow(1 - Math.min(1, st), 2.4);

        for (let i = 0; i < shards.length; i += 1) {
          const s = shards[i];
          const local = Math.max(0, Math.min(1, (ease - s.delay) / Math.max(0.001, 1 - s.delay)));
          const le = 1 - Math.pow(1 - local, 2.05);
          s.x = s.vx * le * 58;
          s.y = s.vy * le * 58 + le * le * 48;
          s.rot = s.vr * le * 10;

          ctx.save();
          ctx.translate(s.bx + s.x, s.by + s.y);
          ctx.rotate(s.rot);
          ctx.translate(-s.bx, -s.by);
          ctx.beginPath();
          ctx.moveTo(s.pts[0].x, s.pts[0].y);
          for (let p = 1; p < s.pts.length; p += 1) ctx.lineTo(s.pts[p].x, s.pts[p].y);
          ctx.closePath();
          ctx.globalAlpha = Math.max(0, 1 - le * 0.95);
          ctx.fillStyle = s.fill;
          ctx.fill();
          ctx.globalAlpha = Math.max(0, 0.8 - le * 0.6);
          ctx.strokeStyle = s.edge;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        }

        for (let i = 0; i < particles.length; i += 1) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy + 0.1;
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.rot += p.vr;
          p.life -= p.decay;
          if (p.life <= 0) continue;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.fill;
          ctx.fillRect(-p.len * 0.5, -p.thick * 0.5, p.len, p.thick);
          ctx.restore();
        }
      }

      ctx.globalAlpha = 1;

      if (elapsed < DURATION) {
        burstRaf = requestAnimationFrame(tick);
      } else {
        burstRaf = 0;
        ctx.clearRect(0, 0, width, height);
        resolve();
      }
    };

    burstRaf = requestAnimationFrame(tick);
  });
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
  inkIntro.setAttribute("aria-hidden", "false");

  await wait(280);
  await typeInkPhrase();

  inkIntro.classList.add("is-flashing", "is-cracking");
  const shatterDone = runGlassShatter();
  await wait(280);
  inkIntro.classList.add("is-shattering");
  await shatterDone;

  // After explosion: open only the existing booking panel
  inkIntro.classList.add("is-done");
  inkIntro.classList.remove("is-writing", "is-flashing", "is-cracking", "is-shattering");
  overlay.classList.add("is-ready");
  overlay.classList.remove("is-introing");
  inkIntro.setAttribute("aria-hidden", "true");
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
