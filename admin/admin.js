const API = "/api";
const TOKEN_KEY = "tetovazeras_admin_token";

const loginView = document.querySelector("[data-login-view]");
const dashboard = document.querySelector("[data-dashboard]");
const loginForm = document.querySelector("[data-login-form]");
const loginError = document.querySelector("[data-login-error]");
const bookingsBody = document.querySelector("[data-bookings-body]");
const bookingsError = document.querySelector("[data-bookings-error]");
const adminGallery = document.querySelector("[data-admin-gallery]");
const uploadForm = document.querySelector("[data-upload-form]");
const uploadError = document.querySelector("[data-upload-error]");
const uploadOk = document.querySelector("[data-upload-ok]");
const uploadBtn = document.querySelector("[data-upload-btn]");

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
}

function showDashboard(show) {
  loginView.hidden = show;
  dashboard.hidden = !show;
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearToken();
    showDashboard(false);
  }
  return { res, data };
}

function switchTab(name) {
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === name);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === name);
  });
}

async function loadBookings() {
  bookingsError.hidden = true;
  bookingsBody.innerHTML = `<tr><td colspan="6">Učitavanje…</td></tr>`;

  const { res, data } = await api("/bookings", { headers: authHeaders() });
  if (!res.ok) {
    bookingsError.hidden = false;
    bookingsError.textContent = data.error || "Ne mogu učitati termine.";
    bookingsBody.innerHTML = `<tr><td colspan="6">Greška</td></tr>`;
    return;
  }

  const bookings = data.bookings || [];
  if (!bookings.length) {
    bookingsBody.innerHTML = `<tr><td colspan="6">Nema rezervacija.</td></tr>`;
    return;
  }

  bookingsBody.innerHTML = "";
  bookings.forEach((b) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.date}</td>
      <td>${b.time}</td>
      <td>${escapeHtml(`${b.firstName} ${b.lastName}`)}</td>
      <td>${escapeHtml(b.phone)}</td>
      <td>${escapeHtml(b.status || "pending")}</td>
      <td></td>
    `;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Obriši";
    del.addEventListener("click", async () => {
      if (!confirm("Obrisati ovaj termin?")) return;
      const result = await api(`/bookings?id=${encodeURIComponent(b.id)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!result.res.ok) {
        alert(result.data.error || "Brisanje nije uspjelo.");
        return;
      }
      loadBookings();
    });
    tr.lastElementChild.appendChild(del);
    bookingsBody.appendChild(tr);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function gallerySrc(item) {
  if (item?.staticPath) {
    return `/${String(item.staticPath).replace(/^\/+/, "")}`;
  }
  return item?.url || "";
}

async function loadAdminGallery() {
  const { res, data } = await api("/gallery");
  adminGallery.innerHTML = "";
  if (!res.ok) {
    adminGallery.innerHTML = `<p class="msg error">Galerija nije dostupna.</p>`;
    return;
  }

  const items = data.items || [];
  if (!items.length) {
    adminGallery.innerHTML = `<p class="msg">Nema slika. Dodaj prvu.</p>`;
    return;
  }

  const count = document.querySelector("[data-gallery-count]");
  if (count) count.textContent = `${items.length} slika`;

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-card";

    const img = document.createElement("img");
    img.src = gallerySrc(item);
    img.alt = "Tetovaža";
    img.loading = "lazy";

    const meta = document.createElement("div");
    meta.className = "meta";

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Obriši";
    del.addEventListener("click", async () => {
      if (!confirm("Obrisati ovu sliku?")) return;
      del.disabled = true;
      del.textContent = "Brišem…";
      const result = await api(`/gallery?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!result.res.ok) {
        alert(result.data.error || "Brisanje nije uspjelo.");
        del.disabled = false;
        del.textContent = "Obriši";
        return;
      }
      loadAdminGallery();
    });
    meta.appendChild(del);

    card.appendChild(img);
    card.appendChild(meta);
    adminGallery.appendChild(card);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const password = new FormData(loginForm).get("password");

  const { res, data } = await api("/admin-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    loginError.hidden = false;
    loginError.textContent = data.error || "Prijava nije uspjela.";
    return;
  }

  setToken(data.token);
  showDashboard(true);
  switchTab("gallery");
  loadBookings();
  loadAdminGallery();
});

document.querySelector("[data-logout]").addEventListener("click", () => {
  clearToken();
  showDashboard(false);
});

document.querySelector("[data-refresh-bookings]").addEventListener("click", loadBookings);
document.querySelector("[data-refresh-gallery]")?.addEventListener("click", loadAdminGallery);

document.querySelectorAll("[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchTab(btn.dataset.tab);
    if (btn.dataset.tab === "bookings") loadBookings();
    if (btn.dataset.tab === "gallery") loadAdminGallery();
  });
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  uploadError.hidden = true;
  uploadOk.hidden = true;

  const formData = new FormData(uploadForm);
  const file = formData.get("file");
  const name = "";

  if (!(file instanceof File) || !file.size) {
    uploadError.hidden = false;
    uploadError.textContent = "Izaberi sliku.";
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Upload…";

  try {
    const dataUrl = await fileToDataUrl(file);
    const { res, data } = await api("/gallery", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name,
        contentType: file.type,
        data: dataUrl,
      }),
    });

    if (!res.ok) {
      uploadError.hidden = false;
      uploadError.textContent = data.error || "Upload nije uspio.";
      return;
    }

    uploadOk.hidden = false;
    uploadOk.textContent = "Slika dodata.";
    uploadForm.reset();
    loadAdminGallery();
  } catch {
    uploadError.hidden = false;
    uploadError.textContent = "Greška pri čitanju fajla.";
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Dodaj sliku";
  }
});

(async function boot() {
  if (!getToken()) {
    showDashboard(false);
    return;
  }
  const { res } = await api("/bookings", { headers: authHeaders() });
  if (!res.ok) {
    showDashboard(false);
    return;
  }
  showDashboard(true);
  loadBookings();
  loadAdminGallery();
})();
