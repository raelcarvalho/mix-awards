// public/js/album.js
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

  // Progresso
  const cardsOwnedEl = $("#cardsOwned");
  const chipProgress = $("#chipProgress");
  const TOTAL_CARDS = 82;

  // Modal
  const modal = $("#cardModal");
  const btnCloseModal = $("#btnCloseModal");
  const ttlFig = $("#ttlFig");
  const cardImg = $("#cardImg");
  const cardInfo = $("#cardInfo");

  const modalPreview = $(".card-preview"); // usamos como host do FX

  // ----- Estado -----
  let slots = [];
  let totalPages = 9;
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
  // >>> só o slot 82 é GOD <<<
  const rarityOf = (slot) => {
    if (slot <= 50) return "normal";
    if (slot <= 70) return "epica";
    if (slot <= 78) return "lendaria";
    if (slot <= 81) return "mitica";
    return "god";
  };

  function makeStaticSlots() {
    const arr = [];
    for (let s = 1; s <= TOTAL_CARDS; s++) {
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

  function updateProgress() {
    if (!cardsOwnedEl) return;
    const owned = Array.isArray(slots)
      ? slots.filter((s) => s && s.colada && s.figurinha).length
      : 0;
    cardsOwnedEl.textContent = owned;
    const pct = Math.round((owned / TOTAL_CARDS) * 100);
    if (chipProgress) chipProgress.title = `${owned}/${TOTAL_CARDS} (${pct}%)`;
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
      totalPages = 9;
      renderPager();
      renderPage();
      updateProgress();
      return;
    }
    try {
      const r = await fetch("/album", { headers: authHeader });
      const j = unwrap(await safeJson(r)) || {};

      if (Array.isArray(j?.slots) && j.slots.length) {
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
        const maxSlot = slots.reduce(
          (m, s) => Math.max(m, Number(s.slot || 0)),
          0
        );
        totalPages = Math.max(9, Math.ceil((maxSlot || TOTAL_CARDS) / 10));
      } else if (Array.isArray(j?.figurinhas)) {
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
        totalPages = Math.max(9, Math.ceil((slots.length || TOTAL_CARDS) / 10));
      } else {
        slots = makeStaticSlots();
        totalPages = 9;
      }
    } catch {
      slots = makeStaticSlots();
      totalPages = 9;
    }
    renderPager();
    renderPage();
    updateProgress();
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

        if (s.raridade === "god") {
          attachZeusFX(slotEl); // <<< novo efeito Zeus
        }

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

  // HOLO no GRID
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
  let modalZeusHandle = null;

  function openModal(slot) {
    if (!modal) return;
    cardImg.src = slot.figurinha?.img || "";
    cardImg.alt = slot.figurinha?.nome || "Figurinha";

    const rar = String(slot.raridade || "normal").toLowerCase();
    cardInfo.className = "";
    cardInfo.classList.add(rar);
    cardInfo.textContent =
      rar === "god"
        ? "Carta God"
        : rar === "mitica"
        ? "Carta Mítica"
        : rar === "lendaria"
        ? "Carta Lendária"
        : rar === "epica"
        ? "Carta Épica"
        : "Carta Normal";

    if (ttlFig)
      ttlFig.textContent =
        rar === "god"
          ? "God"
          : rar === "mitica"
          ? "Mítica"
          : rar === "lendaria"
          ? "Lendária"
          : rar === "epica"
          ? "Épica"
          : "Normal";

    const modalHolo = $(".card-preview .holo-effect");
    if (modalHolo) modalHolo.className = "holo-effect " + rar;

    // limpa efeito antigo, se houver
    if (modalZeusHandle) {
      modalZeusHandle.stop();
      modalZeusHandle = null;
    }

    if (rar === "god" && modalPreview) {
      modalZeusHandle = ZeusStorm(modalPreview); // <<< mesmo FX no modal
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    if (modalPreview && modalHolo) {
      const move = (e) => {
        const rect = modalPreview.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        modalHolo.style.setProperty("--mouse-x", `${x}%`);
        modalHolo.style.setProperty("--mouse-y", `${y}%`);
      };
      modalPreview.onmousemove = move;
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    cardImg.src = "";
    if (modalZeusHandle) {
      modalZeusHandle.stop();
      modalZeusHandle = null;
    }
  }

  // Eventos
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
    // ou, para abrir aqui sem sair da página: openPackHere();
  });

  // ---------- ZEUS FX (procedural canvas) ----------
  const ZEUS_MAP = new WeakMap();

  function attachZeusFX(host) {
    if (ZEUS_MAP.has(host)) return;
    const handle = ZeusStorm(host);
    ZEUS_MAP.set(host, handle);
  }

  function ZeusStorm(host) {
    // hosts múltiplos: criamos três camadas para profundidade
    const clouds = document.createElement("div");
    clouds.className = "zeus-clouds";
    const flash = document.createElement("div");
    flash.className = "zeus-flash";
    const cnv = document.createElement("canvas");
    cnv.className = "zeus-layer";
    host.appendChild(clouds);
    host.appendChild(flash);
    host.appendChild(cnv);

    const ctx = cnv.getContext("2d");
    const DPR = Math.min(2, window.devicePixelRatio || 1); // segura consumo

    let w = 0,
      h = 0,
      running = true,
      last = performance.now();
    let bolts = []; // {pts:[{x,y}], life, age, thick}
    let spawnAt = 0;

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    function resize() {
      const r = host.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      cnv.width = Math.round(w * DPR);
      cnv.height = Math.round(h * DPR);
      cnv.style.width = w + "px";
      cnv.style.height = h + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      // limpar quando redimensionar
      ctx.clearRect(0, 0, w, h);
    }

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function makeBolt(x0, y0, x1, y1) {
      // fractal midpoint displacement
      let pts = [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
      ];
      let offset = Math.hypot(x1 - x0, y1 - y0) * 0.18;
      for (let i = 0; i < 6; i++) {
        const next = [pts[0]];
        for (let j = 0; j < pts.length - 1; j++) {
          const a = pts[j],
            b = pts[j + 1];
          const mx = (a.x + b.x) / 2,
            my = (a.y + b.y) / 2;
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len,
            ny = dx / len; // normal
          const disp = (Math.random() * 2 - 1) * offset;
          next.push({ x: mx + nx * disp, y: my + ny * disp }, b);

          // pequenos ramos
          if (Math.random() < 0.35 && offset > 2.2) {
            const bx = mx + nx * disp * 0.6,
              by = my + ny * disp * 0.6;
            const ang =
              Math.atan2(dy, dx) +
              (Math.random() < 0.5 ? 1 : -1) * rand(Math.PI / 6, Math.PI / 3);
            const blen = rand(len * 0.18, len * 0.33);
            const ex = bx + Math.cos(ang) * blen;
            const ey = by + Math.sin(ang) * blen;
            bolts.push({
              pts: makeBoltSimple(bx, by, ex, ey),
              life: rand(120, 220),
              age: 0,
              thick: rand(0.6, 1.2),
              branch: true,
            });
          }
        }
        pts = next;
        offset *= 0.55;
      }
      return pts;
    }

    function makeBoltSimple(x0, y0, x1, y1) {
      // 2-3 iterações rápidas para ramos
      let pts = [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
      ];
      let offset = Math.hypot(x1 - x0, y1 - y0) * 0.2;
      for (let i = 0; i < 3; i++) {
        const next = [pts[0]];
        for (let j = 0; j < pts.length - 1; j++) {
          const a = pts[j],
            b = pts[j + 1];
          const mx = (a.x + b.x) / 2,
            my = (a.y + b.y) / 2;
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len,
            ny = dx / len;
          const disp = (Math.random() * 2 - 1) * offset;
          next.push({ x: mx + nx * disp, y: my + ny * disp }, b);
        }
        pts = next;
        offset *= 0.55;
      }
      return pts;
    }

    function spawn() {
      const startX = rand(w * 0.15, w * 0.85);
      const endX = startX + rand(-w * 0.2, w * 0.2);
      const pts = makeBolt(startX, -w * 0.05, endX, h * rand(0.6, 0.95));
      bolts.push({
        pts,
        life: rand(240, 360),
        age: 0,
        thick: rand(1.2, 2.2),
        branch: false,
      });

      // lampejo rápido
      flash.style.opacity = ".38";
      setTimeout(() => (flash.style.opacity = "0"), 120);
    }

    function drawBoltPath(pts, baseAlpha, thick) {
      if (!pts || pts.length < 2) return;
      ctx.globalCompositeOperation = "lighter";

      // glow externo azul
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(0,160,255,.8)";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = `rgba(0,160,255,${0.28 * baseAlpha})`;
      ctx.lineWidth = thick * 8;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      // halo médio ciano
      ctx.shadowBlur = 10;
      ctx.strokeStyle = `rgba(120,210,255,${0.55 * baseAlpha})`;
      ctx.lineWidth = thick * 4.5;
      ctx.stroke();

      // núcleo branco
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * baseAlpha})`;
      ctx.lineWidth = thick * 1.6;
      ctx.stroke();
    }

    function tick(ts) {
      if (!running) return;
      const dt = Math.min(60, ts - last);
      last = ts;

      ctx.clearRect(0, 0, w, h);

      // desenha & envelhece
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        b.age += dt;
        const t = b.age / b.life;
        const alpha = Math.max(0, 1 - t); // fade out
        drawBoltPath(b.pts, alpha, b.thick);
        if (b.age >= b.life) bolts.splice(i, 1);
      }

      // spawn controlado
      if (ts > spawnAt) {
        spawn();
        spawnAt = ts + (300 + Math.random() * 900); // entre 0.3s e 1.2s
      }

      raf = requestAnimationFrame(tick);
    }

    let raf = requestAnimationFrame(tick);

    return {
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        ro.disconnect();
        try {
          cnv.remove();
          flash.remove();
          clouds.remove();
        } catch {}
      },
    };
  }

  // --------------------------------------------------

  // Init
  (async function init() {
    await fetchPacks().catch(() => {});
    await fetchAlbum().catch(() => {});
  })();
})();
