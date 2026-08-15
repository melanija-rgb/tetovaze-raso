(function () {
  const toggle = document.querySelector("[data-menu-toggle]");
  const panel = document.querySelector("[data-menu-panel]");
  const backdrop = document.querySelector("[data-menu-backdrop]");
  if (!toggle || !panel) return;

  function setOpen(open) {
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Zatvori meni" : "Otvori meni");
    panel.hidden = !open;
    if (backdrop) backdrop.hidden = !open;
    document.body.classList.toggle("menu-open", open);
  }

  function closeMenu() {
    setOpen(false);
  }

  toggle.addEventListener("click", () => {
    setOpen(panel.hidden);
  });

  backdrop?.addEventListener("click", closeMenu);

  panel.querySelectorAll("[data-menu-close]").forEach((el) => {
    el.addEventListener("click", () => {
      // Let navigation / booking handlers run; close after
      closeMenu();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) closeMenu();
  });
})();
