(function () {
  const $ = (s, c = document) => c.querySelector(s);

  const grid = $("#stickersGrid");
  const pager = $("#pager");
  const capsEl = $("#qtdCapsulas");
  const btnOpenCaps = $("#btnOpenCaps");

  const token = localStorage.getItem("auth_token");
  const auth = token ? { Authorization: `Bearer ${token}` } : {};

  const TOTAL_STICKERS = 24;
  const PER_PAGE = 10;
  const PAGES = Math.ceil(TOTAL_STICKERS / PER_PAGE);

  let page = 1;
  // CORREÇÃO: Usar um Map para associar SLOT => STICKER_DATA
  let ownedStickersMap = new Map();

  const stickerModal = $("#stickerModal");
  const inner3d = $("#sticker3dInner");
  const stickerImg = $("#stickerImg");
  const titleEl = $("#ttlSticker");
  const closeModalBtn = $("#btnCloseStickerModal");

  function openStickerModal(src, name) {
    stickerImg.src = src;
    titleEl.textContent = name || "Sticker";
    stickerModal.classList.add("open");
  }
  function closeStickerModal() {
    stickerModal.classList.remove("open");
  }
  closeModalBtn?.addEventListener("click", closeStickerModal);
  stickerModal?.addEventListener("click", (e) => {
    if (e.target === stickerModal) closeStickerModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeStickerModal();
  });

  (function mountTiltEffect() {
    if (!inner3d) return;
    let rx = 0,
      ry = 0,
      tx = 0,
      ty = 0;
    const loop = () => {
      rx += (tx - rx) * 0.12;
      ry += (ty - ry) * 0.12;
      inner3d.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.05, 1.05, 1.05)`;
      requestAnimationFrame(loop);
    };
    inner3d.addEventListener("mousemove", (e) => {
      const r = inner3d.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      ty = -ny * 15;
      tx = nx * 18;
    });
    inner3d.addEventListener("mouseleave", () => {
      tx = 0;
      ty = 0;
    });
    requestAnimationFrame(loop);
  })();

  grid?.addEventListener("click", (e) => {
    const slot = e.target.closest(".slot");
    const img = slot?.querySelector("img");
    if (!img) return;
    openStickerModal(img.src, img.alt || "Sticker");
  });

  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };
  const unwrap = (d) => d?.resultados ?? d ?? {};

  async function fetchCapsulesCount() {
    try {
      const r = await fetch("/shop/listar-capsulas-fechadas", {
        headers: auth,
      });
      const j = unwrap(await safeJson(r));
      const qtd = Number(
        j?.quantidade ??
          (Array.isArray(j.capsulas) ? j.capsulas.length : 0) ??
          0
      );
      if (capsEl) capsEl.textContent = String(qtd);
      if (btnOpenCaps) btnOpenCaps.disabled = !token || qtd <= 0;
    } catch {
      if (capsEl) capsEl.textContent = "0";
      if (btnOpenCaps) btnOpenCaps.disabled = !token;
    }
  }

  async function fetchOwnedStickers() {
    ownedStickersMap.clear();
    if (!token) return;
    try {
      const r = await fetch("/album/stickers", { headers: auth });
      const j = unwrap(await safeJson(r));
      const stickersList = j.stickers || [];
      for (const sticker of stickersList) {
        if (sticker.possui && typeof sticker.slot === "number") {
          ownedStickersMap.set(sticker.slot, sticker);
        }
      }
    } catch (e) {
      console.error("Erro ao buscar stickers:", e);
    }
  }

  function renderPager() {
    if (!pager) return;
    pager.innerHTML = "";
    const mk = (label, target, extra = "") => {
      const b = document.createElement("button");
      b.className = `pbtn ${extra}`;
      b.textContent = label;
      b.addEventListener("click", () => {
        page = target;
        renderGrid();
        renderPager();
      });
      return b;
    };
    if (page > 1) pager.appendChild(mk("«", page - 1));
    for (let i = 1; i <= PAGES; i++) {
      pager.appendChild(mk(String(i), i, i === page ? "active" : ""));
    }
    if (page < PAGES) pager.appendChild(mk("»", page + 1));
  }

  function renderGrid() {
    if (!grid) return;
    grid.innerHTML = "";
    const startSlot = (page - 1) * PER_PAGE + 1;
    const endSlot = Math.min(page * PER_PAGE, TOTAL_STICKERS);

    for (let slotNumber = startSlot; slotNumber <= endSlot; slotNumber++) {
      const slotElement = document.createElement("div");
      slotElement.className = "slot";
      const numLabel = `<span class="num">${slotNumber}</span>`;
      let innerHTML = "";

      if (ownedStickersMap.has(slotNumber)) {
        const stickerData = ownedStickersMap.get(slotNumber);
        const img = `<div class="sticker-img-container"><img src="${stickerData.imagem}" alt="${stickerData.nome}"></div>`;
        const rarityLabel = `<span class="label">${
          stickerData.raridade || "Normal"
        }</span>`;
        innerHTML = `${rarityLabel}${img}${numLabel}`;
      } else {
        const rarityLabel = `<span class="label">Bloqueado</span>`;
        innerHTML = `${rarityLabel}${numLabel}`;
      }
      slotElement.innerHTML = innerHTML;
      grid.appendChild(slotElement);
    }
  }

  btnOpenCaps?.addEventListener("click", () => {
    window.location.href = "/abrir-capsula-html";
  });

  window.__onStickerDrop = async function (stickerGanha) {
    // Atualiza o mapa localmente para feedback visual instantâneo
    if (stickerGanha && typeof stickerGanha.slot === "number") {
      ownedStickersMap.set(stickerGanha.slot, stickerGanha);
      renderGrid(); // Re-renderiza a grade imediatamente
    }
    // Busca os dados do servidor para garantir consistência total
    await fetchOwnedStickers();
    renderGrid();
    await fetchCapsulesCount();
  };

  (async function init() {
    await fetchOwnedStickers();
    renderGrid();
    renderPager();
    await fetchCapsulesCount();
  })();
})();
