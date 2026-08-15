const API = "/api";
const galleryGrid = document.querySelector("[data-gallery-grid]");
const lightbox = document.querySelector("[data-lightbox]");
const lightboxImg = document.querySelector("[data-lightbox-img]");
const lightboxCaption = document.querySelector("[data-lightbox-caption]");

let lightboxItems = [];
let lightboxIndex = 0;

function itemSrc(item) {
  if (item.staticPath) return `/${String(item.staticPath).replace(/^\/+/, "")}`;
  return item.url;
}

async function loadGallery() {
  if (!galleryGrid) return;
  try {
    const res = await fetch(`${API}/gallery`);
    const data = await res.json();
    galleryGrid.innerHTML = "";
    const items = res.ok && Array.isArray(data.items) ? data.items : [];

    if (!items.length) {
      galleryGrid.innerHTML = '<p class="gallery-empty">Galerija uskoro.</p>';
      return;
    }

    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-item";
      button.setAttribute("aria-label", `Otvori: ${item.name || "rad"}`);
      const img = document.createElement("img");
      img.src = itemSrc(item);
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

function openLightbox(items, index) {
  lightboxItems = items;
  lightboxIndex = index;
  renderLightbox();
  lightbox.hidden = false;
  document.body.classList.add("is-locked");
}

function closeLightbox() {
  if (!lightbox || lightbox.hidden) return;
  lightbox.hidden = true;
  document.body.classList.remove("is-locked");
}

function renderLightbox() {
  const item = lightboxItems[lightboxIndex];
  if (!item) return;
  lightboxImg.src = itemSrc(item);
  lightboxImg.alt = "Tetovaža";
  if (lightboxCaption) {
    lightboxCaption.textContent = "";
    lightboxCaption.hidden = true;
  }
}

function stepLightbox(delta) {
  if (!lightboxItems.length) return;
  lightboxIndex = (lightboxIndex + delta + lightboxItems.length) % lightboxItems.length;
  renderLightbox();
}

lightbox?.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
lightbox?.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => stepLightbox(-1));
lightbox?.querySelector("[data-lightbox-next]")?.addEventListener("click", () => stepLightbox(1));
lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", (event) => {
  if (!lightbox || lightbox.hidden) return;
  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") stepLightbox(-1);
  if (event.key === "ArrowRight") stepLightbox(1);
});

loadGallery();
