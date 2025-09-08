// public/js/shop.js
(function () {
  if (window.__SHOP_JS_INIT__) return;
  window.__SHOP_JS_INIT__ = true;

  // ===================== ENDPOINTS (iguais aos seus routes) =====================
  const LOGIN_URL = "/login-html";

  const LIST_PACOTE_URL = "/shop/listar-pacote-fechado";
  const LIST_CAPS_URL = "/shop/listar-capsulas-fechadas";

  const BUY_PACOTE_URL = "/shop/comprar"; // body: { quantidade }
  const BUY_CAPS_URL = "/shop/comprar-capsulas"; // body: { quantidade }

  // Gold: tenta plural e singular (evita 404)
  const GOLD_URLS = ["/api/jogadores/gold", "/api/jogador/gold"];

  // ===================== AUTH/STATE =====================
  // Você usa sessão (cookie). Não vamos enviar Authorization Bearer, a menos que exista token salvo.
  const isLogged = () => true;

  // ===================== REFS =====================
  // Pacote
  const btnAbrirComprar = document.getElementById("btnAbrirComprar");
  const btnComprar1 = document.getElementById("btnComprar1");
  const btnComprar5 = document.getElementById("btnComprar5");
  const btnComprar10 = document.getElementById("btnComprar10");
  // Cápsula
  const btnAbrirComprarCaps = document.getElementById("btnAbrirComprarCaps");
  const btnComprarCap1 = document.getElementById("btnComprarCap1");
  const btnComprarCap5 = document.getElementById("btnComprarCap5");
  const btnComprarCap10 = document.getElementById("btnComprarCap10");

  // Modal
  const comprarModal = document.getElementById("comprarModal");
  const btnFecharModal = document.getElementById("btnFecharModal");
  const btnCancelar = document.getElementById("btnCancelar");
  const btnConfirmar = document.getElementById("btnConfirmar");
  const menos = document.getElementById("menos");
  const mais = document.getElementById("mais");
  const qtd = document.getElementById("qtd");
  const ttlComprar = document.getElementById("ttlComprar");

  // Badges/NAV
  const badgePacotes = document.getElementById("badgePacotes");
  const qtdPacotesEl = document.getElementById("qtdPacotes");
  const badgeCaps = document.getElementById("badgeCapsulas");
  const qtdCapsEl = document.getElementById("qtdCapsulas");
  const btnIrAlbum = document.getElementById("btnIrAlbum");
  const btnIrAlbumInline = document.getElementById("btnIrAlbumInline");
  const goldQty = document.getElementById("goldQty");
  const btnIrAlbumStickers = document.getElementById("btnIrAlbumStickers");
  const btnIrAlbumStickersInline = document.getElementById(
    "btnIrAlbumStickersInline"
  );

  const toast = document.getElementById("toast");
  const packHolder = document.getElementById("packHolder");
  const capsHolder = document.getElementById("capsHolder");

  // flip/tilt do pacote
  const pack3d = document.getElementById("pack3d");
  const frontFace = document.querySelector(".packface.front");
  const backFace = document.querySelector(".packface.back");

  // ===================== FX styles (label) =====================
  (function injectFXStyles() {
    const id = "__fx_styles_injected__";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      .fx-label{
        position:fixed; z-index:86; pointer-events:none;
        font-weight:900; padding:6px 10px; border-radius:10px;
        background:rgba(255,215,0,.12); border:1px solid rgba(255,215,0,.4);
        color:#ffd760; text-shadow:0 0 10px rgba(255,210,70,.45);
        transform:translate(-50%,-50%) scale(.9); opacity:0;
        filter:drop-shadow(0 4px 16px rgba(0,0,0,.5));
        animation:fxLabelUp .9s cubic-bezier(.2,.8,.2,1) forwards;
      }
      @keyframes fxLabelUp{
        10%{ opacity:1; transform:translate(-50%,-58%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-85%) scale(1.04); }
      }
    `;
    document.head.appendChild(s);
  })();

  // ===================== TOAST =====================
  function showToast(msg, type = "ok") {
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.add("hide"), 1600);
    setTimeout(() => {
      toast.className = "toast";
      toast.textContent = "";
    }, 2000);
  }

  // ===================== API helper (cookie + token se existir) =====================
  async function api(method, url, body) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const t = localStorage.getItem("auth_token");
    if (t) headers.Authorization = `Bearer ${t}`;

    const res = await fetch(url, {
      method,
      headers,
      credentials: "include", // envia cookie de sessão
      cache: "no-store",
      body: body ? JSON.stringify(body) : undefined,
    });

    let json = null;
    try {
      json = await res.json();
    } catch (_) {}

    if (res.status === 401) throw new Error("Sessão expirada");
    if (!res.ok || (json && json.sucesso === false)) {
      const msg =
        (json && (json.mensagem || json.message)) || `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json ?? {};
  }

  // ===================== GOLD =====================
  function setGoldNow(saldo) {
    const el = document.getElementById("goldQty");
    if (!el) return;
    const v = Number(
      typeof saldo === "number"
        ? saldo
        : saldo?.saldoAtual ?? saldo?.saldo_atual ?? saldo?.gold ?? saldo
    );
    if (Number.isFinite(v))
      el.textContent = new Intl.NumberFormat("pt-BR").format(v);
  }

  async function refreshGoldBadge() {
    for (const url of GOLD_URLS) {
      try {
        const r = await fetch(url, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!r.ok) continue;
        const d = await r.json();
        const gold = d?.resultados?.gold ?? d?.gold;
        if (Number.isFinite(+gold)) {
          goldQty &&
            (goldQty.textContent = new Intl.NumberFormat("pt-BR").format(
              +gold
            ));
          return;
        }
      } catch {}
    }
  }

  // ===================== LISTAGENS =====================
  async function refreshPacotesFechados() {
    try {
      const j = await api("GET", LIST_PACOTE_URL);
      const pacotes =
        j?.resultados?.pacotes ??
        j?.pacotes ??
        (Array.isArray(j?.resultados) ? j.resultados : []);
      const n = Number.isFinite(+j?.quantidade)
        ? +j.quantidade
        : Array.isArray(pacotes)
        ? pacotes.length
        : 0;

      qtdPacotesEl.textContent = n;
      badgePacotes?.removeAttribute("disabled");
      if (n > 0) btnIrAlbum?.removeAttribute("disabled");
      else btnIrAlbum?.setAttribute("disabled", "");
    } catch (e) {
      console.warn("Erro ao listar pacotes fechados:", e?.message || e);
      qtdPacotesEl.textContent = "—";
      badgePacotes?.setAttribute("disabled", "");
      btnIrAlbum?.setAttribute("disabled", "");
    }
  }

  async function refreshCapsulasFechadas() {
    try {
      const j = await api("GET", LIST_CAPS_URL);
      const capsulas =
        j?.resultados?.capsulas ??
        j?.capsulas ??
        (Array.isArray(j?.resultados) ? j.resultados : []);
      const n = Number.isFinite(+j?.quantidade)
        ? +j.quantidade
        : Array.isArray(capsulas)
        ? capsulas.length
        : 0;

      qtdCapsEl.textContent = n;
      badgeCaps?.removeAttribute("disabled");
    } catch (e) {
      console.warn("Erro ao listar cápsulas fechadas:", e?.message || e);
      qtdCapsEl.textContent = "—";
      badgeCaps?.setAttribute("disabled", "");
    }
  }

  // ===================== FX CANVAS =====================
  const fxCanvas = document.getElementById("fxCanvas");
  let fxCtx,
    fxW = 0,
    fxH = 0,
    fxRAF = 0,
    fxParts = [];

  function fxResize() {
    if (!fxCanvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    fxW = fxCanvas.clientWidth;
    fxH = fxCanvas.clientHeight;
    fxCanvas.width = Math.floor(fxW * dpr);
    fxCanvas.height = Math.floor(fxH * dpr);
    fxCtx = fxCanvas.getContext("2d");
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fxResize();
  window.addEventListener("resize", fxResize);

  function addLabel(x, y, text) {
    const el = document.createElement("div");
    el.className = "fx-label";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  function burstAt(x, y, theme = "gold") {
    if (!fxCanvas) return;
    const now = performance.now();
    const palette =
      theme === "caps"
        ? ["#ffd95e", "#ffe7a3", "#7cf9f2", "#a6d1ff", "#ffc0cb"]
        : ["#ffd95e", "#ffefb3", "#ffb84d", "#f7d06b", "#fff1b8"];

    fxParts.push({
      kind: "ring",
      x,
      y,
      r0: 8,
      r: 8,
      max: 120,
      w: 2.8,
      life: 520,
      t0: now,
    });
    for (let i = 0; i < 70; i++) {
      const ang = Math.random() * Math.PI * 2,
        spd = (Math.random() * 2.2 + 0.8) * (theme === "caps" ? 1.2 : 1);
      fxParts.push({
        kind: "dot",
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 0.4,
        g: 0.05,
        size: Math.random() * 2.2 + 1.2,
        color: palette[i % palette.length],
        life: 700 + Math.random() * 400,
        t0: now,
        rot: Math.random() * Math.PI,
      });
    }
    if (theme === "pack") {
      for (let i = 0; i < 4; i++) {
        fxParts.push({
          kind: "card",
          x: x + (i - 1.5) * 8,
          y: y + 4,
          vx: Math.random() * 1.2 - 0.6,
          vy: -(1.8 + Math.random() * 0.6),
          g: 0.05,
          w: 22,
          h: 32,
          rot: (Math.random() - 0.5) * 0.8,
          vr: (Math.random() - 0.5) * 0.06,
          color: "#1a2e45",
          edge: "#ffd95e",
          life: 1000,
          t0: now,
        });
      }
    }
    if (!fxRAF) fxRAF = requestAnimationFrame(fxTick);
  }

  function fxTick() {
    fxRAF = 0;
    if (!fxCtx) fxResize();
    fxCtx.clearRect(0, 0, fxW, fxH);
    const now = performance.now();
    fxParts = fxParts.filter((p) => {
      const dt = now - p.t0,
        k = Math.min(1, dt / p.life);
      if (p.kind === "ring") {
        p.r = p.r0 + (p.max - p.r0) * k;
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        fxCtx.strokeStyle = `rgba(255,217,94,${0.35 * (1 - k)})`;
        fxCtx.lineWidth = 2.8 * (1 - k * 0.6);
        fxCtx.stroke();
      }
      if (p.kind === "dot") {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        fxCtx.save();
        fxCtx.translate(p.x, p.y);
        fxCtx.rotate(p.rot);
        fxCtx.shadowBlur = 10;
        fxCtx.shadowColor = p.color;
        fxCtx.globalAlpha = (1 - k) * 0.9;
        fxCtx.fillStyle = p.color;
        fxCtx.beginPath();
        fxCtx.arc(0, 0, p.size, 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.restore();
      }
      if (p.kind === "card") {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        fxCtx.save();
        fxCtx.translate(p.x, p.y);
        fxCtx.rotate(p.rot);
        fxCtx.globalAlpha = 1 - k;
        fxCtx.fillStyle = p.edge;
        fxCtx.fillRect(-p.w / 2 - 1.5, -p.h / 2 - 1.5, p.w + 3, p.h + 3);
        fxCtx.fillStyle = p.color;
        fxCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        fxCtx.globalAlpha *= 0.18;
        fxCtx.fillStyle = "#fff";
        fxCtx.fillRect(-p.w / 2 + 3, -p.h / 2 + 3, p.w - 6, 6);
        fxCtx.restore();
      }
      return dt < p.life;
    });
    if (fxParts.length) fxRAF = requestAnimationFrame(fxTick);
  }

  function playPurchaseFX(type, anchorEl, label) {
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    const x = r.left + r.width / 2,
      y = r.top + r.height * 0.45;
    burstAt(x, y, type === "capsula" ? "caps" : "gold");
    if (type === "pacote") burstAt(x, y, "pack");
    addLabel(x, y - 20, label);
  }

  // ===================== COMPRAS =====================
  async function comprarPacotes(q) {
    const j = await api("POST", BUY_PACOTE_URL, { quantidade: Number(q) });
    const saldo =
      j?.resultados?.saldoAtual ??
      j?.resultados?.saldo_atual ??
      j?.saldoAtual ??
      j?.saldo_atual;
    setGoldNow(saldo);
    await refreshPacotesFechados();
    showToast(j?.mensagem || `Você comprou ${q} pacote(s)!`, "ok");
    try {
      playPurchaseFX("pacote", packHolder, `+${q} pacote${q > 1 ? "s" : ""}`);
      if (typeof boomConfetti === "function") boomConfetti();
    } catch {}
  }

  async function comprarCapsulas(q) {
    const j = await api("POST", BUY_CAPS_URL, { quantidade: Number(q) });
    const saldo =
      j?.resultados?.saldoAtual ??
      j?.resultados?.saldo_atual ??
      j?.saldoAtual ??
      j?.saldo_atual;
    setGoldNow(saldo);
    await refreshCapsulasFechadas();
    showToast(j?.mensagem || `Você comprou ${q} cápsula(s)!`, "ok");
    try {
      playPurchaseFX("capsula", capsHolder, `+${q} cáps.`);
      if (typeof boomConfetti === "function") boomConfetti();
    } catch {}
  }

  // ===================== MODAL =====================
  let buyMode = "pacote";
  function openModal(mode, initial = 1) {
    buyMode = mode;
    ttlComprar &&
      (ttlComprar.textContent =
        mode === "capsula" ? "Comprar cápsulas" : "Comprar pacotes");
    if (qtd) qtd.value = String(initial);
    comprarModal?.classList.add("open");
    comprarModal?.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    comprarModal?.classList.remove("open");
    comprarModal?.setAttribute("aria-hidden", "true");
  }

  // ===================== Tilt + Flip do PACOTE =====================
  (function enablePack3D() {
    if (!packHolder || !pack3d || !frontFace || !backFace) return;
    let showBack = false,
      targetRX = 0,
      targetRY = 0,
      currRX = 0,
      currRY = 0,
      raf = 0;
    const MAX_TILT_Y = 14,
      MAX_TILT_X = 6,
      lerp = (a, b, t) => a + (b - a) * t;

    function applyFaces() {
      if (showBack) {
        backFace.style.transform = "rotateY(0deg) translateZ(0.2px)";
        frontFace.style.transform = "rotateY(180deg) translateZ(0.1px)";
      } else {
        frontFace.style.transform = "rotateY(0deg) translateZ(0.2px)";
        backFace.style.transform = "rotateY(180deg) translateZ(0.1px)";
      }
    }
    function setTilt(rx, ry) {
      pack3d.style.transform = `rotateY(${ry}deg) rotateX(${rx}deg)`;
    }
    function update() {
      currRX = lerp(currRX, targetRX, 0.18);
      currRY = lerp(currRY, targetRY, 0.18);
      setTilt(currRX, currRY);
      if (
        Math.abs(currRX - targetRX) > 0.1 ||
        Math.abs(currRY - targetRY) > 0.1
      ) {
        raf = requestAnimationFrame(update);
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
    function calcTilt(cx, cy) {
      const r = packHolder.getBoundingClientRect();
      const ox = (cx - (r.left + r.width / 2)) / (r.width / 2);
      const oy = (cy - (r.top + r.height / 2)) / (r.height / 2);
      const nx = Math.max(-1, Math.min(1, ox));
      const ny = Math.max(-1, Math.min(1, oy));
      targetRY = -nx * MAX_TILT_Y;
      targetRX = ny * MAX_TILT_X;
      pack3d.style.setProperty("--mx", (nx / 2 + 0.5).toFixed(3));
      pack3d.style.setProperty("--my", (-ny / 2 + 0.5).toFixed(3));
      if (!raf) raf = requestAnimationFrame(update);
    }

    packHolder.addEventListener("pointermove", (e) =>
      calcTilt(e.clientX, e.clientY)
    );
    packHolder.addEventListener("pointerleave", () => {
      targetRX = 0;
      targetRY = 0;
      if (!raf) raf = requestAnimationFrame(update);
    });
    packHolder.addEventListener("click", () => {
      showBack = !showBack;
      applyFaces();
    });

    applyFaces();
    setTilt(0, 0);
  })();

  // ===================== INIT / EVENTOS =====================
  function init() {
    // Pacote
    btnComprar1?.addEventListener("click", () =>
      isLogged()
        ? comprarPacotes(1).catch((e) => showToast(e.message, "err"))
        : (location.href = LOGIN_URL)
    );
    btnComprar5?.addEventListener("click", () =>
      isLogged()
        ? comprarPacotes(5).catch((e) => showToast(e.message, "err"))
        : (location.href = LOGIN_URL)
    );
    btnComprar10?.addEventListener("click", () =>
      isLogged()
        ? comprarPacotes(10).catch((e) => showToast(e.message, "err"))
        : (location.href = LOGIN_URL)
    );
    btnAbrirComprar?.addEventListener("click", () =>
      isLogged() ? openModal("pacote", 1) : (location.href = LOGIN_URL)
    );

    // Cápsula
    btnComprarCap1?.addEventListener("click", () =>
      isLogged()
        ? comprarCapsulas(1).catch((e) => showToast(e.message, "err"))
        : (location.href = LOGIN_URL)
    );
    btnComprarCap5?.addEventListener("click", () =>
      isLogged()
        ? comprarCapsulas(5).catch((e) => showToast(e.message, "err"))
        : (location.href = LOGIN_URL)
    );
    btnComprarCap10?.addEventListener("click", () =>
      isLogged()
        ? comprarCapsulas(10).catch((e) => showToast(e.message, "err"))
        : (location.href = LOGIN_URL)
    );
    btnAbrirComprarCaps?.addEventListener("click", () =>
      isLogged() ? openModal("capsula", 1) : (location.href = LOGIN_URL)
    );

    // Modal
    btnFecharModal?.addEventListener("click", closeModal);
    btnCancelar?.addEventListener("click", closeModal);
    comprarModal?.addEventListener("click", (e) => {
      if (e.target === comprarModal) closeModal();
    });

    menos?.addEventListener("click", () => {
      const v = Math.max(1, Math.min(50, parseInt(qtd.value || "1", 10) - 1));
      qtd.value = String(v);
    });
    mais?.addEventListener("click", () => {
      const v = Math.max(1, Math.min(50, parseInt(qtd.value || "1", 10) + 1));
      qtd.value = String(v);
    });

    btnConfirmar?.addEventListener("click", async () => {
      const v = Math.max(1, Math.min(50, parseInt(qtd.value || "1", 10)));
      try {
        if (buyMode === "capsula") await comprarCapsulas(v);
        else await comprarPacotes(v);
        closeModal();
      } catch (e) {
        showToast(e.message || "Erro na compra", "err");
      }
    });

    // Links álbum
    const goAlbum = () => (window.location.href = "/album-html");
    btnIrAlbum?.addEventListener("click", goAlbum);
    btnIrAlbumInline?.addEventListener("click", goAlbum);

    const goAlbumStickers = () =>
      (window.location.href = "/album-stickers-html");
    btnIrAlbumStickers?.addEventListener("click", goAlbumStickers);
    btnIrAlbumStickersInline?.addEventListener("click", goAlbumStickers);

    // Inicialização
    refreshPacotesFechados();
    refreshCapsulasFechadas();
    refreshGoldBadge();
  }

  init();
})();
