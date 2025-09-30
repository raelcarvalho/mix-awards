// public/js/shop.js — versão com resumo e saldo corrigido + BÔNUS +10
(function () {
  if (window.__SHOP_JS_INIT__) return;
  window.__SHOP_JS_INIT__ = true;

  // ===== ENDPOINTS =====
  const LOGIN_URL = "/login-html";
  const LIST_PACOTE_URL = "/shop/listar-pacote-fechado";
  const LIST_CAPS_URL = "/shop/listar-capsulas-fechadas";
  const BUY_PACOTE_URL = "/shop/comprar";
  const BUY_CAPS_URL = "/shop/comprar-capsulas";
  const BUY_BONUS_URL = "/shop/comprar-bonus-pontos"; // <— NOVO
  const GOLD_URLS = ["/api/jogadores/gold", "/api/jogador/gold"];

  // ===== DOM =====
  const btnAbrirComprar = document.getElementById("btnAbrirComprar");
  const btnComprar1 = document.getElementById("btnComprar1");
  const btnComprar5 = document.getElementById("btnComprar5");
  const btnComprar10 = document.getElementById("btnComprar10");

  const btnAbrirComprarCaps = document.getElementById("btnAbrirComprarCaps");
  const btnComprarCap1 = document.getElementById("btnComprarCap1");
  const btnComprarCap5 = document.getElementById("btnComprarCap5");
  const btnComprarCap10 = document.getElementById("btnComprarCap10");

  // Bônus +10 pontos
  const btnComprarBonus10 = document.getElementById("btnComprarBonus10"); // <— NOVO
  const bonusHolder = document.getElementById("bonusHolder"); // <— NOVO (use este id no thumb do bônus)

  const comprarModal = document.getElementById("comprarModal");
  const btnFecharModal = document.getElementById("btnFecharModal");
  const btnCancelar = document.getElementById("btnCancelar");
  const btnConfirmar = document.getElementById("btnConfirmar");
  const menos = document.getElementById("menos");
  const mais = document.getElementById("mais");
  const qtd = document.getElementById("qtd");
  const ttlComprar = document.getElementById("ttlComprar");

  // Resumo
  const unitPriceEl = document.getElementById("unitPrice");
  const goldNowEl = document.getElementById("goldNow");
  const totalPriceEl = document.getElementById("totalPrice");
  const diffLabelEl = document.getElementById("diffLabel");
  const diffValueEl = document.getElementById("diffValue");

  // Preço base no DOM
  const precoPacoteEl = document.getElementById("precoPacote");
  const precoCapsulaEl = document.getElementById("precoCapsula");

  // Badges
  const qtdPacotesEl = document.getElementById("qtdPacotes");
  const qtdCapsEl = document.getElementById("qtdCapsulas");
  const badgePacotes = document.getElementById("badgePacotes");
  const badgeCaps = document.getElementById("badgeCapsulas");
  const btnIrAlbum = document.getElementById("btnIrAlbum");
  const goldQty = document.getElementById("goldQty");

  // FX
  const toast = document.getElementById("toast");
  const packHolder = document.getElementById("packHolder");
  const pack3d = document.getElementById("pack3d");
  const frontFace = document.querySelector(".packface.front");
  const backFace = document.querySelector(".packface.back");
  const capsHolder = document.getElementById("capsHolder");

  // ===== ESTADO =====
  const isLogged = () => true;
  let buyMode = "pacote"; // "pacote" | "capsula"
  let currentGold = 0;

  // ===== Helpers =====
  function toIntGold(v) {
    if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
    if (v == null) return NaN;
    const s = String(v).replace(/[^\d]/g, "");
    return s ? parseInt(s, 10) : NaN;
  }
  function numberBR(v) {
    return new Intl.NumberFormat("pt-BR").format(v);
  }

  function showToast(msg, type = "ok") {
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.add("hide"), 1600);
    setTimeout(() => {
      toast.className = "toast";
      toast.textContent = "";
    }, 2000);
  }

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
      credentials: "include",
      cache: "no-store",
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {}
    if (res.status === 401) throw new Error("Sessão expirada");
    if (!res.ok || (json && json.sucesso === false)) {
      const msg =
        (json && (json.mensagem || json.message)) || `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json ?? {};
  }

  // ===== GOLD =====
  function setGoldNow(saldo) {
    const v = toIntGold(
      typeof saldo === "number"
        ? saldo
        : saldo?.saldoAtual ?? saldo?.saldo_atual ?? saldo?.gold ?? saldo
    );
    if (Number.isFinite(v)) {
      currentGold = v;
      if (goldQty) goldQty.textContent = numberBR(v);
      renderTotals();
    }
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
        const raw =
          d?.resultados?.gold ?? d?.gold ?? d?.saldoAtual ?? d?.saldo_atual;
        const val = toIntGold(raw);
        if (Number.isFinite(val)) {
          setGoldNow(val);
          return;
        }
      } catch {}
    }
    const domVal = toIntGold(goldQty?.textContent);
    if (Number.isFinite(domVal)) setGoldNow(domVal);
  }

  // ===== Listagens =====
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
      if (qtdPacotesEl) qtdPacotesEl.textContent = n;
      badgePacotes?.removeAttribute("disabled");
      if (n > 0) btnIrAlbum?.removeAttribute("disabled");
      else btnIrAlbum?.setAttribute("disabled", "");
    } catch {
      if (qtdPacotesEl) qtdPacotesEl.textContent = "—";
      badgePacotes?.setAttribute("disabled", "");
      btnIrAlbum?.setAttribute("disabled", "");
    }
  }
  async function refreshCapsulasFechadas() {
    try {
      const j = await api("GET", LIST_CAPS_URL);
      const caps =
        j?.resultados?.capsulas ??
        j?.capsulas ??
        (Array.isArray(j?.resultados) ? j.resultados : []);
      const n = Number.isFinite(+j?.quantidade)
        ? +j.quantidade
        : Array.isArray(caps)
        ? caps.length
        : 0;
      if (qtdCapsEl) qtdCapsEl.textContent = n;
      badgeCaps?.removeAttribute("disabled");
    } catch {
      if (qtdCapsEl) qtdCapsEl.textContent = "—";
      badgeCaps?.setAttribute("disabled", "");
    }
  }

  // ===== FX Canvas light =====
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
  function playPurchaseFX(type, el, label) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2,
      y = r.top + r.height * 0.45;
    burstAt(x, y, type === "capsula" ? "caps" : "gold");
    if (type === "pacote") burstAt(x, y, "pack");
    addLabel(x, y - 20, label);
  }

  // ===== Preços & Totais =====
  function getUnitPrice(mode) {
    const raw =
      mode === "capsula"
        ? precoCapsulaEl
          ? precoCapsulaEl.textContent
          : "10"
        : precoPacoteEl
        ? precoPacoteEl.textContent
        : "20";
    const val = toIntGold(raw);
    return Number.isFinite(val) && val > 0 ? val : mode === "capsula" ? 10 : 20;
  }

  function renderTotals() {
    if (!comprarModal || comprarModal.getAttribute("aria-hidden") === "true")
      return;
    const q = Math.max(1, Math.min(50, parseInt(qtd?.value || "1", 10)));
    const unit = getUnitPrice(buyMode);
    const total = unit * q;
    const diff = currentGold - total;

    if (unitPriceEl) unitPriceEl.textContent = numberBR(unit);
    if (goldNowEl) goldNowEl.textContent = numberBR(currentGold);
    if (totalPriceEl) totalPriceEl.textContent = numberBR(total);

    if (diffLabelEl && diffValueEl) {
      if (diff >= 0) {
        diffLabelEl.textContent = "Vai sobrar:";
        diffValueEl.textContent = numberBR(diff);
        diffValueEl.classList.remove("bad");
        diffValueEl.classList.add("ok");
        btnConfirmar?.removeAttribute("disabled");
      } else {
        diffLabelEl.textContent = "Faltam:";
        diffValueEl.textContent = numberBR(Math.abs(diff));
        diffValueEl.classList.remove("ok");
        diffValueEl.classList.add("bad");
        btnConfirmar?.setAttribute("disabled", "true");
      }
    }
    if (btnConfirmar)
      btnConfirmar.textContent = `Comprar agora (${numberBR(total)} gold)`;
  }

  // ===== Compras =====
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
  // Compra do BÔNUS +10
  async function comprarBonus10() {
    // <— NOVO
    const j = await api("POST", BUY_BONUS_URL, {});
    const saldo =
      j?.resultados?.saldoAtual ??
      j?.resultados?.saldo_atual ??
      j?.saldoAtual ??
      j?.saldo_atual;
    setGoldNow(saldo);
    showToast(
      j?.mensagem || "Bônus aplicado! +10 pontos na última partida.",
      "ok"
    );
    try {
      playPurchaseFX("gold", bonusHolder || packHolder, "+10 pontos");
      if (typeof boomConfetti === "function") boomConfetti();
    } catch {}
  }

  // ===== Modal =====
  function openModal(mode, initial = 1) {
    buyMode = mode;
    if (ttlComprar)
      ttlComprar.textContent =
        mode === "capsula" ? "Comprar cápsulas" : "Comprar pacotes";
    if (qtd) qtd.value = String(initial);

    if (!currentGold || currentGold <= 0) {
      const domVal = toIntGold(goldQty?.textContent);
      if (Number.isFinite(domVal)) currentGold = domVal;
      refreshGoldBadge();
    }

    renderTotals();
    comprarModal?.classList.add("open");
    comprarModal?.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    comprarModal?.classList.remove("open");
    comprarModal?.setAttribute("aria-hidden", "true");
    if (btnConfirmar) btnConfirmar.textContent = "Comprar agora";
  }

  // ===== Tilt/Flip pacote =====
  (function enablePack3D() {
    if (!packHolder || !pack3d || !frontFace || !backFace) return;
    let showBack = false,
      tRX = 0,
      tRY = 0,
      cRX = 0,
      cRY = 0,
      raf = 0;
    const MAXY = 14,
      MAXX = 6,
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
    function upd() {
      cRX = lerp(cRX, tRX, 0.18);
      cRY = lerp(cRY, tRY, 0.18);
      setTilt(cRX, cRY);
      if (Math.abs(cRX - tRX) > 0.1 || Math.abs(cRY - tRY) > 0.1)
        raf = requestAnimationFrame(upd);
      else cancelAnimationFrame(raf), (raf = 0);
    }
    function calc(e) {
      const r = packHolder.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      tRY = -Math.max(-1, Math.min(1, nx)) * MAXY;
      tRX = Math.max(-1, Math.min(1, ny)) * MAXX;
      pack3d.style.setProperty("--mx", (nx / 2 + 0.5).toFixed(3));
      pack3d.style.setProperty("--my", (-ny / 2 + 0.5).toFixed(3));
      if (!raf) raf = requestAnimationFrame(upd);
    }
    packHolder.addEventListener("pointermove", calc);
    packHolder.addEventListener("pointerleave", () => {
      tRX = 0;
      tRY = 0;
      if (!raf) raf = requestAnimationFrame(upd);
    });
    packHolder.addEventListener("click", () => {
      showBack = !showBack;
      applyFaces();
    });
    applyFaces();
    setTilt(0, 0);
  })();

  // ===== Init =====
  function clampQty(v) {
    return Math.max(1, Math.min(50, parseInt(v || "1", 10)));
  }

  function init() {
    // Botões pacote
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

    // Botões cápsula (se usar)
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

    // Botão Bônus +10 (novo)
    btnComprarBonus10?.addEventListener("click", () =>
      isLogged()
        ? comprarBonus10().catch((e) => showToast(e.message, "err"))
        : (location.href = LOGIN_URL)
    );

    // Modal
    btnFecharModal?.addEventListener("click", closeModal);
    btnCancelar?.addEventListener("click", closeModal);
    comprarModal?.addEventListener("click", (e) => {
      if (e.target === comprarModal) closeModal();
    });

    menos?.addEventListener("click", () => {
      qtd.value = String(clampQty(qtd.value) - 1);
      renderTotals();
    });
    mais?.addEventListener("click", () => {
      qtd.value = String(clampQty(qtd.value) + 1);
      renderTotals();
    });
    qtd?.addEventListener("input", () => {
      qtd.value = String(clampQty(qtd.value));
      renderTotals();
    });

    btnConfirmar?.addEventListener("click", async () => {
      const v = clampQty(qtd.value);
      try {
        if (buyMode === "capsula") await comprarCapsulas(v);
        else await comprarPacotes(v);
        closeModal();
      } catch (e) {
        showToast(e.message || "Erro na compra", "err");
      }
    });

    // Cargas iniciais
    refreshPacotesFechados();
    refreshCapsulasFechadas();
    refreshGoldBadge();
  }
  init();
})();
