// public/js/abrir-pacote.js
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const packArea = $("#packArea");
  const pack = $("#pack");
  const fan = $("#fan");

  const btnOpen = $("#btnOpen"); // Abrir pacote
  const btnReveal = $("#btnReveal"); // Revelar tudo
  const btnReset = $("#btnReset"); // Novo pacote
  const btnBack = $("#btnBack");

  const token = localStorage.getItem("auth_token");
  const auth = token ? { Authorization: `Bearer ${token}` } : {};

  let opened = false; // indica se o pack atual foi aberto (UI)
  let cards = []; // cartas do pack atual
  let packCount = 0; // quantidade de pacotes fechados restantes (servidor)

  /* =================== HELPERS =================== */
  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };
  const unwrap = (data) => data?.resultados ?? data ?? {};
  const getId = (x) =>
    Number(x?.id ?? x?.figurinha_id ?? x?.figurinha?.id ?? NaN);

  const fixImgPath = (p) => {
    if (!p) return null;
    if (p.startsWith("http")) return p;
    return p.startsWith("/") ? p : "/" + p;
  };

  // Normaliza entrada de raridade em "normal" | "epica" | "lendaria"
  function canonRarity(r) {
    if (r == null) return "normal";
    if (typeof r === "object") {
      if ("nome" in r) return canonRarity(r.nome);
      if ("name" in r) return canonRarity(r.name);
      if ("id" in r) return canonRarity(String(r.id));
    }
    const s = String(r).trim().toLowerCase();
    if (s === "3") return "lendaria";
    if (s === "2") return "epica";
    if (s === "1" || s === "0") return "normal";
    if (["normal", "comum", "common"].includes(s)) return "normal";
    if (["épica", "epica", "epic", "rara", "rare"].includes(s)) return "epica";
    if (/(legend|lend[aá]r[io]a)/.test(s)) return "lendaria";
    return "normal";
  }

  // Controla o estado habilitado/disabled dos botões
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

  /* =================== BACKEND =================== */
  // Lê quantos pacotes fechados existem para o usuário
  async function fetchPacks() {
    try {
      const r = await fetch("/shop/listar-pacote-fechado", { headers: auth });
      const j = unwrap(await safeJson(r));
      const arr = j?.pacotes ?? j?.resultados?.pacotes ?? [];
      packCount = Array.isArray(arr) ? arr.length : j?.quantidade ?? 0;
    } catch {
      packCount = 0; // em erro, bloqueia abertura
    }
    updateButtons();
  }

  // Extrai/normaliza raridade
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

  // Normaliza a estrutura de cartas vinda do servidor
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

  // Chama API de abertura e respeita o status HTTP
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

    // Completa imagens que vierem vazias
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

  /* =================== VISUAL =================== */
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

  // Tilt 3D do pack
  (function packTilt() {
    if (!pack) return;
    pack.addEventListener("mousemove", (e) => {
      const r = pack.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const rx = 10 - dy * 14;
      const ry = -8 + dx * 16;
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
      rar === "lendaria" ? "Lendária" : rar === "epica" ? "Épica" : "Normal";

    meta.appendChild(left);
    meta.appendChild(tag);
    front.appendChild(art);
    front.appendChild(meta);
    inner.appendChild(back);
    inner.appendChild(front);
    card.appendChild(inner);

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

    card.addEventListener("click", () => inner.classList.toggle("flip"));
    setTimeout(() => card.classList.add("show"), 60 + index * 120);

    wrap.appendChild(card);

    if (item.isDuplicate) {
      const note = document.createElement("div");
      note.className = "dup-msg";
      note.textContent =
        "Carta repetida — as cartas repetidas são vendidas por gold conforme a sua raridade: normal 2 golds, épica 5 golds e lendária 10 golds.";
      wrap.appendChild(note);
    }

    return wrap;
  }

  /* =================== FLUXOS =================== */
  async function openPackFlow() {
    // Bloqueio: sem pacotes não abre
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
      // Sucesso: um pacote foi consumido
      packCount = Math.max(0, packCount - 1);
      updateButtons();
    } catch (err) {
      alert(err?.message || "Erro ao abrir pacote.");
      resetAll(); // volta UI
      await fetchPacks(); // re-sincroniza do servidor
      return;
    }

    // Sem cartas válidas => volta
    if (!Array.isArray(cards) || cards.length === 0) {
      alert("Não foi possível carregar as cartas deste pacote.");
      resetAll();
      await fetchPacks();
      return;
    }

    // Render
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
    updateButtons(); // respeita packCount atual
  }

  /* =================== EVENTS =================== */
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

  /* =================== INIT =================== */
  (async function init() {
    await fetchPacks();
    updateButtons();
  })();
})();
