// public/js/album.js — versão completa (raridades + modal + fix de páginas)
(function () {
  if (window.__ALBUM_JS_INIT__) return;
  window.__ALBUM_JS_INIT__ = true;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  // ----- DOM -----
  const packsQtyEl = $("#packsQty");
  const btnOpenPack = $("#btnOpenPack");
  const grid = $("#albumGrid");
  const pager = $("#pager");

  // Modal
  const modal = $("#cardModal");
  const btnCloseModal = $("#btnCloseModal");
  const ttlFig = $("#ttlFig");
  const cardImg = $("#cardImg");
  const cardInfo = $("#cardInfo");

  // ----- Estado -----
  let slots = [];
  let totalPages = 6;
  let page = 1;
  let packCount = 0;

  // Auth
  const token = localStorage.getItem("auth_token");
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  // utils
  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };
  const unwrap = (d) => d?.resultados ?? d ?? {};
  const fixImgPath = (p) =>
    !p ? null : p.startsWith("http") ? p : p.startsWith("/") ? p : "/" + p;

  const pageOf = (slot) => Math.ceil(slot / 10);
  const posOf = (slot) => ((slot - 1) % 10) + 1;
  const rarityOf = (slot) =>
    slot <= 35 ? "normal" : slot <= 50 ? "epica" : "lendaria";

  function makeStaticSlots() {
    const arr = [];
    for (let s = 1; s <= 60; s++) {
      arr.push({
        slot: s,
        page: pageOf(s),
        pos: posOf(s),
        raridade: rarityOf(s),
        colada: false,
        nova: false,
        figurinha: null,
      });
    }
    return arr;
  }

  // ======== FETCH ========
  async function fetchPacks() {
    try {
      const r = await fetch("/shop/listar-pacote-fechado", {
        headers: authHeader,
      });
      const j = unwrap(await safeJson(r));
      const arr = j?.pacotes ?? j?.resultados?.pacotes ?? [];
      packCount = Array.isArray(arr) ? arr.length : j?.quantidade ?? 0;
    } catch {
      packCount = 0;
    }
    if (packsQtyEl) packsQtyEl.textContent = packCount;
    if (btnOpenPack) btnOpenPack.disabled = !token || packCount <= 0;
  }

  async function fetchAlbum() {
    if (!token) {
      slots = makeStaticSlots();
      totalPages = 6;
      renderPager();
      renderPage();
      return;
    }
    try {
      const r = await fetch("/album", { headers: authHeader });
      const j = unwrap(await safeJson(r)) || {};

      if (Array.isArray(j?.slots) && j.slots.length) {
        // resposta no formato { slots: [...] }
        slots = j.slots.map((s) => ({
          slot: Number(s.slot ?? 0),
          page: Number(s.page ?? pageOf(Number(s.slot ?? 0))),
          pos: Number(s.pos ?? posOf(Number(s.slot ?? 0))),
          raridade: s.raridade || rarityOf(Number(s.slot)),
          colada: !!s.colada,
          nova: !!s.nova,
          figurinha: s.figurinha
            ? {
                id: Number(s.figurinha.id),
                nome: s.figurinha.nome,
                img: fixImgPath(s.figurinha.img || s.figurinha.imagem),
              }
            : null,
        }));

        // ⚠️ não confia em j.paginas; calcula pelas cartas/slots
        const maxSlot = slots.reduce(
          (m, s) => Math.max(m, Number(s.slot || 0)),
          0
        );
        totalPages = Math.max(6, Math.ceil((maxSlot || 60) / 10));
      } else if (Array.isArray(j?.figurinhas)) {
        // resposta no formato legacy { figurinhas: [...] }
        const figs = j.figurinhas;
        slots = figs
          .map((f, idx) => {
            const slot = Number(f.slot ?? f.ordem ?? idx + 1);
            return {
              slot,
              page: pageOf(slot),
              pos: posOf(slot),
              raridade: f.raridade || rarityOf(slot),
              colada: !!f.possui,
              nova: false,
              figurinha: f.imagem
                ? { id: Number(f.id), nome: f.nome, img: fixImgPath(f.imagem) }
                : null,
            };
          })
          .sort((a, b) => a.slot - b.slot);
        totalPages = Math.max(6, Math.ceil((slots.length || 60) / 10));
      } else {
        slots = makeStaticSlots();
        totalPages = 6;
      }
    } catch (e) {
      console.warn("GET /album falhou, usando placeholders", e);
      slots = makeStaticSlots();
      totalPages = 6;
    }
    renderPager();
    renderPage();
  }

  async function openPackHere() {
    if (!token || packCount <= 0) return;
    btnOpenPack.disabled = true;
    try {
      await fetch("/album/pacotes/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ quantidade: 1 }),
      }).then(safeJson);
    } catch {}
    await Promise.all([fetchPacks(), fetchAlbum()]);
    btnOpenPack.disabled = packCount <= 0;
    btnOpenPack.textContent = "Pacote aberto!";
    setTimeout(() => (btnOpenPack.textContent = "Abrir pacote"), 900);
  }

  // ======== PAGER ========
  function renderPager() {
    $$(".pbtn[data-page]", pager).forEach((el) => el.remove());
    const nextBtn = $('.pbtn[data-act="next"]', pager);
    for (let i = 1; i <= totalPages; i++) {
      const b = document.createElement("button");
      b.className = "pbtn";
      b.dataset.page = String(i);
      b.textContent = String(i);
      if (i === page) b.classList.add("active");
      nextBtn.before(b);
    }
    pager.addEventListener("click", onPagerClick, { once: true });
  }
  function onPagerClick(e) {
    const t = e.target.closest(".pbtn");
    if (!t) return;
    if (t.dataset.act === "prev") return goto(page - 1);
    if (t.dataset.act === "next") return goto(page + 1);
    const p = Number(t.dataset.page || 1);
    if (p && p !== page) goto(p);
  }
  function goto(p) {
    page = Math.max(1, Math.min(totalPages, p));
    renderPager();
    renderPage(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ======== GRID ========
  function renderPage(withSlide = false) {
    grid.innerHTML = "";
    const pageSlots = slots
      .filter((s) => Number(s.page) === page)
      .sort((a, b) => a.pos - b.pos);
    const list = pageSlots.length
      ? pageSlots
      : makeStaticSlots().filter((s) => s.page === page);

    if (withSlide) {
      grid.style.opacity = "0";
      grid.style.transform = "translateX(12px)";
      setTimeout(() => {
        grid.style.transition = "transform .18s ease, opacity .18s ease";
        grid.style.opacity = "1";
        grid.style.transform = "translateX(0)";
        setTimeout(() => (grid.style.transition = ""), 220);
      }, 10);
    }

    for (const s of list) {
      const slotEl = document.createElement("div");
      slotEl.className = `slot ${s.raridade || ""} ${s.nova ? "is-new" : ""}`;
      slotEl.title = s.figurinha?.nome || `Vazio — slot ${s.slot}`;
      slotEl.dataset.slot = s.slot;
      if (s.figurinha?.id) slotEl.dataset.figId = s.figurinha.id;
      if (s.colada) slotEl.classList.add("has");

      const badge = document.createElement("span");
      badge.className = "rarity";
      badge.textContent = s.raridade || "";
      slotEl.appendChild(badge);

      if (s.colada && s.figurinha?.img) {
        const img = document.createElement("img");
        img.src = s.figurinha.img;
        img.alt = s.figurinha.nome || "Figurinha";
        slotEl.appendChild(img);

        ensureHolo(slotEl);
        slotEl.addEventListener("click", () => openModal(s));
      } else {
        slotEl.style.background = "rgba(255,255,255,.06)";
        const info = document.createElement("div");
        info.style.cssText = "font-size:14px;text-align:center;opacity:.8;";
        info.innerHTML = `Figurinha<br>${s.slot}`;
        slotEl.appendChild(info);
      }

      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(s.slot);
      slotEl.appendChild(num);

      if (s.nova && s.figurinha?.id) {
        const id = s.figurinha.id;
        const handler = () => {
          slotEl.classList.remove("is-new");
          s.nova = false;
          ackNovas([id]);
          slotEl.removeEventListener("mouseenter", handler);
          slotEl.removeEventListener("focus", handler);
        };
        slotEl.addEventListener("mouseenter", handler);
        slotEl.addEventListener("focus", handler);
      }
      grid.appendChild(slotEl);
    }
  }

  async function ackNovas(figIds) {
    if (!token || !Array.isArray(figIds) || !figIds.length) return;
    try {
      await fetch("/album/ack-novas", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ figurinhaIds: figIds }),
      });
    } catch {}
  }

  // ======== HOLO EFFECT no GRID ========
  function ensureHolo(slot) {
    if (slot.querySelector(".holo-effect")) return;
    const holo = document.createElement("div");
    holo.className = "holo-effect";
    const reflect = document.createElement("div");
    reflect.className = "holo-reflect";
    holo.appendChild(reflect);
    slot.appendChild(holo);

    slot.addEventListener("mousemove", function (e) {
      const r = this.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      holo.style.setProperty("--mouse-x", `${x}%`);
      holo.style.setProperty("--mouse-y", `${y}%`);
    });
  }

  // ======== MODAL ========
  function openModal(slot) {
    if (!modal) return;
    cardImg.src = slot.figurinha?.img || "";
    cardImg.alt = slot.figurinha?.nome || "Figurinha";

    const rar = String(slot.raridade || "normal").toLowerCase();
    cardInfo.className = "";
    cardInfo.classList.add(rar);
    cardInfo.textContent =
      rar === "lendaria"
        ? "Carta Lendária"
        : rar === "epica"
        ? "Carta Épica"
        : "Carta Normal";

    if (ttlFig)
      ttlFig.textContent =
        rar === "lendaria" ? "Lendária" : rar === "epica" ? "Épica" : "Normal";

    const modalHolo = $(".card-preview .holo-effect");
    if (modalHolo) modalHolo.className = "holo-effect " + rar;

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    const cardPreview = $(".card-preview");
    if (cardPreview && modalHolo) {
      const move = (e) => {
        const rect = cardPreview.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        modalHolo.style.setProperty("--mouse-x", `${x}%`);
        modalHolo.style.setProperty("--mouse-y", `${y}%`);
      };
      cardPreview.onmousemove = move;
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    cardImg.src = "";
  }

  // Eventos do modal/teclas
  btnCloseModal?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("open")) closeModal();
    if (e.key === "ArrowLeft") goto(page - 1);
    if (e.key === "ArrowRight") goto(page + 1);
  });
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Topo
  btnOpenPack?.addEventListener("click", () => {
    if (btnOpenPack.disabled) return;
    window.location.href = "/abrir-pacote-html";
    // ou, para abrir aqui:
    // openPackHere();
  });

  // Init
  (async function init() {
    await fetchPacks().catch(() => {});
    await fetchAlbum().catch(() => {});
  })();
})();
