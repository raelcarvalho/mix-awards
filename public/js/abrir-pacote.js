// public/js/abrir-pacote.js
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const packArea = $("#packArea");
  const pack = $("#pack");
  const fan = $("#fan");

  const btnOpen = $("#btnOpen");
  const btnReveal = $("#btnReveal");
  const btnReset = $("#btnReset");
  const btnBack = $("#btnBack");
  const packBadge = $("#packBadge");

  const token = localStorage.getItem("auth_token");
  const auth = token ? { Authorization: `Bearer ${token}` } : {};

  let opened = false;
  let cards = [];
  let packCount = 0;

  /* ===== helpers ===== */
  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };
  const unwrap = (d) => d?.resultados ?? d ?? {};
  const getId = (x) =>
    Number(x?.id ?? x?.figurinha_id ?? x?.figurinha?.id ?? NaN);

  const fixImgPath = (p) => {
    if (!p) return null;
    if (p.startsWith("http")) return p;
    return p.startsWith("/") ? p : "/" + p;
  };

  function setPackBadge(n) {
    if (!packBadge) return;
    const strong = packBadge.querySelector("strong");
    if (strong) strong.textContent = String(n);
    packBadge.classList.toggle("empty", n <= 0);
    packBadge.title =
      n > 0
        ? `${n} pacote${n > 1 ? "s" : ""} disponível${n > 1 ? "eis" : ""}`
        : "Sem pacotes disponíveis";
  }

  function canonRarity(r) {
    if (r == null) return "normal";
    if (typeof r === "object") {
      if ("nome" in r) return canonRarity(r.nome);
      if ("name" in r) return canonRarity(r.name);
      if ("id" in r) return canonRarity(String(r.id));
    }
    const s = String(r).trim().toLowerCase();
    if (s === "4") return "mitica";
    if (s === "3") return "lendaria";
    if (s === "2") return "epica";
    if (s === "1" || s === "0") return "normal";
    if (["normal", "comum", "common"].includes(s)) return "normal";
    if (["épica", "epica", "epic", "rara", "rare"].includes(s)) return "epica";
    if (/(legend|lend[aá]r[io]a)/.test(s)) return "lendaria";
    if (/(mythic|mitic[ao])/i.test(s)) return "mitica";
    return "normal";
  }

  function updateButtons() {
    if (btnOpen) btnOpen.disabled = !token || packCount <= 0 || opened;
    if (btnReveal) btnReveal.disabled = !opened;
    if (btnReset) btnReset.disabled = !(opened && packCount > 0);
  }

  async function fetchAlbumMap() {
    try {
      const r = await fetch("/album", { headers: auth });
      const j = unwrap(await safeJson(r));
      const arr = Array.isArray(j?.slots) ? j.slots : [];
      const map = new Map();
      for (const s of arr) {
        if (s?.figurinha?.id) {
          map.set(Number(s.figurinha.id), {
            img: fixImgPath(s.figurinha.img || s.figurinha.imagem || ""),
            nome: s.figurinha.nome || "",
            raridade: s.raridade || s.figurinha.raridade || "normal",
            slot: s.slot,
          });
        }
      }
      return map;
    } catch {
      return new Map();
    }
  }

  /* ===== backend ===== */
  async function fetchPacks() {
    try {
      const r = await fetch("/shop/listar-pacote-fechado", { headers: auth });
      const j = unwrap(await safeJson(r));
      const arr = j?.pacotes ?? j?.resultados?.pacotes ?? [];
      packCount = Array.isArray(arr) ? arr.length : j?.quantidade ?? 0;
    } catch {
      packCount = 0;
    }
    setPackBadge(packCount);
    updateButtons();
  }

  function extractRarity(it) {
    const f = it?.figurinha || it;
    const candidate =
      f?.raridade ??
      it?.raridade ??
      f?.raridade_id ??
      f?.raridadeId ??
      it?.raridade_id ??
      it?.raridadeId ??
      f?.rarity ??
      it?.rarity ??
      it?.r ??
      it?.tier ??
      null;
    return canonRarity(candidate);
  }

  function normalizeCards(payload) {
    let bag =
      payload?.cartas ??
      payload?.figurinhas ??
      payload?.items ??
      payload?.cards ??
      payload?.pacote?.figurinhas ??
      payload?.abertura?.figurinhas ??
      null;

    if (!Array.isArray(bag)) {
      const tmp = [];
      if (Array.isArray(payload?.novas)) tmp.push(...payload.novas);
      if (Array.isArray(payload?.duplicadas)) tmp.push(...payload.duplicadas);
      bag = tmp;
    }
    if (!Array.isArray(bag)) bag = [];

    return bag.map((it, i) => {
      const f = it?.figurinha || it;
      const rar = extractRarity(it);
      return {
        id: f?.id ?? i + 1,
        nome: f?.nome ?? it?.nome ?? it?.title ?? `Carta #${i + 1}`,
        raridade: rar,
        img: fixImgPath(f?.imagem ?? f?.img ?? it?.imagem ?? it?.img ?? null),
        slot: f?.slot ?? it?.slot ?? null,
      };
    });
  }

  async function openPackOnServer() {
    const r = await fetch("/album/pacotes/abrir", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ quantidade: 1 }),
    });
    const data = unwrap(await safeJson(r));
    if (!r.ok) {
      const msg = data?.mensagem || data?.message || "Sem pacotes para abrir.";
      const err = new Error(msg);
      err.name = "NoPacks";
      throw err;
    }

    const dupIds = new Set((data?.duplicadas || []).map(getId).filter(Boolean));
    const newIds = new Set((data?.novas || []).map(getId).filter(Boolean));

    let list = normalizeCards(data);
    if (list.some((c) => !c.img)) {
      const albumMap = await fetchAlbumMap();
      list = list.map((c) => {
        const rar = canonRarity(c.raridade);
        if (!c.img) {
          const a = albumMap.get(Number(c.id));
          if (a?.img) {
            return {
              ...c,
              img: a.img,
              nome: c.nome || a.nome,
              raridade: rar || canonRarity(a.raridade),
              slot: c.slot ?? a.slot,
            };
          }
        }
        return { ...c, raridade: rar };
      });
    }

    return list.map((c) => ({
      ...c,
      raridade: canonRarity(c.raridade),
      isDuplicate: dupIds.has(Number(c.id)),
      isNew: newIds.has(Number(c.id)),
    }));
  }

  /* ===== HOLO "MITICA" – overlay independente ===== */
  function ensureHoloStyles() {
    if (document.getElementById("holoStyles-pack")) return;
    const css = `
    .card { position: relative; }
    .card .holo-layer{
      position:absolute; inset:0; border-radius: 12px;
      pointer-events:none; z-index: 99; /* acima de .front/.meta */
      mix-blend-mode: color-dodge; opacity:.85;
      background-blend-mode: overlay;
      background-repeat: no-repeat;
      /* 1) sparkles (gif)  2) textura holo  3) gradiente arco-íris */
      background-image:
        url("https://assets.codepen.io/13471/sparkles.gif"),
        url("https://assets.codepen.io/13471/holo.png"),
        linear-gradient(125deg,
          #ff00cc55 15%, #a14dff44 28%, #00f0ff33 42%,
          #00ff8a28 58%, #00cfff44 70%, #cc4cfa55 85%);
      background-size: 160%;
      background-position: var(--spx,50%) var(--spy,50%);
      filter: brightness(1) contrast(1.1);
      transition: opacity .2s ease, filter .2s ease;
    }
    /* faixa de luz por cima (segundo layer) */
    .card .holo-gradient{
      position:absolute; inset:0; border-radius:12px;
      pointer-events:none; z-index: 98; mix-blend-mode: color-dodge;
      opacity:.6; filter: brightness(.7) contrast(1.05);
      background: linear-gradient(115deg,
        transparent 0%,
        var(--c1,#efb2fb) 25%,
        transparent 47%,
        transparent 53%,
        var(--c2,#acc6f8) 75%,
        transparent 100%);
      background-size: 280% 280%;
      background-position: var(--lp,50%) var(--tp,50%);
      transition: opacity .2s ease, filter .2s ease;
    }
    /* moldura glow sutil */
    .card.mitica{
      box-shadow:
        -12px -12px 24px -18px #efb2fb,
         12px 12px 24px -18px #acc6f8,
         0 0 18px 0 rgba(255,255,255,.08);
      transition: box-shadow .15s ease;
    }
    .card.mitica:hover{
      box-shadow:
        -24px -24px 36px -26px #efb2fb,
         24px 24px 36px -26px #acc6f8,
         0 0 22px 6px rgba(255,255,255,.22);
    }
    `;
    const style = document.createElement("style");
    style.id = "holoStyles-pack";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function attachHolo(cardEl) {
    ensureHoloStyles();

    // cria os layers de efeito (dentro da carta para evitar stacking 3D)
    const gradient = document.createElement("div");
    gradient.className = "holo-gradient";
    const layer = document.createElement("div");
    layer.className = "holo-layer";

    // joga por cima de tudo (após meta/arte)
    cardEl.appendChild(gradient);
    cardEl.appendChild(layer);

    // paleta rosa/azul (pode customizar aqui)
    cardEl.style.setProperty("--c1", "#efb2fb");
    cardEl.style.setProperty("--c2", "#acc6f8");

    const onMove = (e) => {
      const r = cardEl.getBoundingClientRect();
      const isTouch = e.touches && e.touches.length;
      const cx = isTouch ? e.touches[0].clientX : e.clientX;
      const cy = isTouch ? e.touches[0].clientY : e.clientY;

      const l = Math.max(0, Math.min(1, (cx - r.left) / r.width));
      const t = Math.max(0, Math.min(1, (cy - r.top) / r.height));

      const px = Math.abs(100 - Math.floor(100 * l));
      const py = Math.abs(100 - Math.floor(100 * t));
      const pa = 50 - px + (50 - py);

      const lp = 50 + (px - 50) / 1.5;
      const tp = 50 + (py - 50) / 1.5;
      const spx = 50 + (px - 50) / 7;
      const spy = 50 + (py - 50) / 7;
      const opc = (20 + Math.abs(pa) * 1.5) / 100;

      cardEl.style.setProperty("--lp", lp + "%");
      cardEl.style.setProperty("--tp", tp + "%");
      cardEl.style.setProperty("--spx", spx + "%");
      cardEl.style.setProperty("--spy", spy + "%");

      layer.style.opacity = String(Math.min(1, Math.max(0.45, opc)));
    };

    const onLeave = () => {
      cardEl.style.setProperty("--lp", "50%");
      cardEl.style.setProperty("--tp", "50%");
      cardEl.style.setProperty("--spx", "50%");
      cardEl.style.setProperty("--spy", "50%");
      layer.style.opacity = ".85";
    };

    cardEl.addEventListener("mousemove", onMove, { passive: true });
    cardEl.addEventListener("touchmove", onMove, { passive: true });
    cardEl.addEventListener("mouseleave", onLeave);
    cardEl.addEventListener("touchend", onLeave);
  }

  /* ===== visual ===== */
  function burst() {
    pack.animate(
      [
        { filter: "brightness(1)" },
        { filter: "brightness(1.7)" },
        { filter: "brightness(1)" },
      ],
      { duration: 420, easing: "ease-out" }
    );
  }

  (function packTilt() {
    if (!pack) return;
    pack.addEventListener("mousemove", (e) => {
      const r = pack.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const rx = 10 - dy * 14,
        ry = -8 + dx * 16;
      pack.style.transform = `translate(-50%,-55%) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    pack.addEventListener("mouseleave", () => {
      pack.style.transform = `translate(-50%,-55%) rotateX(10deg) rotateY(-8deg)`;
    });
  })();

  function createCard(index, item, total) {
    const rar = canonRarity(item.raridade);
    const wrap = document.createElement("div");
    wrap.className = "card-wrap";
    const card = document.createElement("div");
    card.className = `card ${rar}${item.isDuplicate ? " duplicate" : ""}`;
    card.dataset.raridade = rar;

    const rots = total === 4 ? [-8, -2, 2, 8] : [-10, -3, 3, 10];
    card.style.setProperty("--rot", `${rots[index] || 0}deg`);

    const inner = document.createElement("div");
    inner.className = "card-inner";
    const back = document.createElement("div");
    back.className = "face back";
    const front = document.createElement("div");
    front.className = "face front";

    const art = document.createElement("div");
    art.className = "art";
    if (item.img) {
      const img = document.createElement("img");
      img.src = item.img;
      img.alt = item.nome || "Figurinha";
      art.appendChild(img);
    }

    const meta = document.createElement("div");
    meta.className = "meta";
    const left = document.createElement("strong");
    left.textContent = item.nome || `Carta #${index + 1}`;
    const tag = document.createElement("span");
    tag.className = `tag ${rar}`;
    tag.textContent =
      rar === "lendaria"
        ? "Lendária"
        : rar === "epica"
        ? "Épica"
        : rar === "mitica"
        ? "Mítica"
        : "Normal";

    meta.appendChild(left);
    meta.appendChild(tag);
    front.appendChild(art);
    front.appendChild(meta);
    inner.appendChild(back);
    inner.appendChild(front);
    card.appendChild(inner);

    // estrelas extras só na lendária (mantive teu efeito antigo)
    if (rar === "lendaria") {
      const tw = document.createElement("div");
      tw.className = "twinkle";
      for (let i = 0; i < 10; i++) {
        const s = document.createElement("i");
        s.style.left = 8 + Math.random() * 84 + "%";
        s.style.top = 6 + Math.random() * 86 + "%";
        s.style.animationDelay = (Math.random() * 1.6).toFixed(2) + "s";
        tw.appendChild(s);
      }
      card.appendChild(tw);
    }

    if (rar === "mitica") {
      attachHolo(card);
    }

    card.addEventListener("click", () => inner.classList.toggle("flip"));
    setTimeout(() => card.classList.add("show"), 60 + index * 120);

    wrap.appendChild(card);

    if (item.isDuplicate) {
      const note = document.createElement("div");
      note.className = "dup-msg";
      note.textContent =
        "Carta repetida — vendida automaticamente por gold conforme a raridade (normal 2, épica 5, lendária 10 e mítica 20).";
      wrap.appendChild(note);
    }
    return wrap;
  }

  /* ===== fluxos ===== */
  async function openPackFlow() {
    if (packCount <= 0) {
      alert("Você não possui pacotes fechados para abrir.");
      updateButtons();
      return;
    }
    if (opened) return;

    opened = true;
    updateButtons();

    pack.animate(
      [
        { transform: "translate(-50%,-55%) rotateX(10deg) rotateY(-8deg)" },
        {
          transform:
            "translate(-50%,-55%) rotateX(10deg) rotateY(-2deg) translateZ(6px)",
        },
        {
          transform:
            "translate(-50%,-55%) rotateX(12deg) rotateY(8deg)  translateZ(10px)",
        },
        { transform: "translate(-50%,-55%) rotateX(8deg)  rotateY(-4deg)" },
      ],
      { duration: 700, iterations: 2, easing: "ease-in-out" }
    );
    setTimeout(burst, 420);

    packArea.classList.add("opened");
    pack.style.zIndex = "0";
    const foil = pack.querySelector(".foil");
    if (foil) {
      foil.style.opacity = "0";
      foil.style.animation = "none";
    }

    fan.classList.remove("ready");
    fan.innerHTML = "";

    try {
      cards = token ? await openPackOnServer() : [];
      packCount = Math.max(0, packCount - 1);
      setPackBadge(packCount);
      updateButtons();
    } catch (err) {
      alert(err?.message || "Erro ao abrir pacote.");
      resetAll();
      await fetchPacks();
      return;
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      alert("Não foi possível carregar as cartas deste pacote.");
      resetAll();
      await fetchPacks();
      return;
    }

    const list = cards.map((c) => ({
      ...c,
      raridade: canonRarity(c.raridade),
    }));
    fan.style.setProperty("--n", String(list.length));
    const hasHalo = (r) => ["epica", "lendaria"].includes(r);
    fan.classList.toggle("padL", hasHalo(list[0]?.raridade));
    fan.classList.toggle("padR", hasHalo(list[list.length - 1]?.raridade));
    list.forEach((c, i) => fan.appendChild(createCard(i, c, list.length)));
  }

  function revealAll() {
    $$(".card-inner").forEach((inner, i) =>
      setTimeout(() => inner.classList.add("flip"), i * 120)
    );
  }

  function resetAll() {
    opened = false;
    fan.classList.add("ready");
    fan.innerHTML = "";
    fan.style.removeProperty("--n");
    fan.classList.remove("padL", "padR");
    packArea.classList.remove("opened");
    updateButtons();
  }

  /* ===== events ===== */
  pack.addEventListener("click", openPackFlow);
  if (btnOpen) btnOpen.addEventListener("click", openPackFlow);
  if (btnReveal) btnReveal.addEventListener("click", revealAll);
  if (btnReset) btnReset.addEventListener("click", resetAll);
  if (btnBack)
    btnBack.addEventListener("click", () => {
      window.location.href = "/album-html";
    });

  window.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!opened) openPackFlow();
      else revealAll();
    }
    if (e.key.toLowerCase() === "r") resetAll();
    if (e.key === "Escape") window.location.href = "/album-html";
  });

  /* ===== init ===== */
  (async function init() {
    await fetchPacks();
    updateButtons();
  })();
})();
