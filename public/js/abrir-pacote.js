// public/js/abrir-pacote.js
(function () {
  // ---------- helpers DOM ----------
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

  // ---------- util ----------
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
  const fixImgPath = (p) =>
    !p ? null : p.startsWith("http") ? p : p.startsWith("/") ? p : "/" + p;

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
    if (/(god|zeus)/.test(s)) return "god";
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
            raridade: (s.raridade || "normal").toString().toLowerCase(),
            slot: s.slot,
          });
        }
      }
      return map;
    } catch {
      return new Map();
    }
  }

  // ---------- backend ----------
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

  // ---------- estilos injetados ----------
  function ensureCineStyles() {
    if (document.getElementById("cineStyles")) return;
    const css = `
    /* Cena cinematográfica GOD */
    .cine-scene{
      position:fixed; inset:0; z-index:10000; pointer-events:none;
      opacity:0; transition:opacity .35s ease;
      background: radial-gradient(1200px 700px at 50% 38%, rgba(0,0,0,.25), rgba(0,0,0,.85) 65%),
        url('https://static.vecteezy.com/ti/fotos-gratis/p2/27247985-uma-escadaria-conduz-dentro-a-ceu-com-nuvens-gratis-foto.jpg') center/cover no-repeat;
    }
    .cine-scene.on{ opacity:1 }
    .cine-beam{
      position:absolute; inset:0; pointer-events:none;
      background:
        radial-gradient(14% 90% at 50% 0%, rgba(86,193,255,.25), transparent 75%),
        linear-gradient(180deg, rgba(86,193,255,0) 0%, rgba(86,193,255,.35) 22%, rgba(86,193,255,.55) 45%, rgba(86,193,255,.32) 68%, rgba(86,193,255,0) 100%);
      mask: radial-gradient(48% 100% at 50% 20%, black 0%, black 45%, transparent 70%);
      filter: blur(6px);
      mix-blend-mode: screen;
      opacity:.75;
    }
    .cine-star{ position:absolute; width:2px; height:2px; background:#fff; border-radius:50%; opacity:0 }
    .cine-rain{ position:absolute; width:2px; height:140px; background:linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(190,225,255,.95) 40%, rgba(255,255,255,0) 100%);
                filter: blur(.6px); opacity:0.0; transform:translateX(-50%) rotate(10deg); }
    .cine-cam{ position:absolute; left:50%; top:56%; transform:translate(-50%,-50%) rotateX(8deg); perspective:1600px; }
    .cine-card{ width: var(--card-w,260px); height: var(--card-h,360px); position:relative; transform-style:preserve-3d; }
    .cine-card .face{ position:absolute; inset:0; border-radius:16px; backface-visibility:hidden; overflow:hidden }
    .cine-card .back{ transform:rotateY(0deg); }
    .cine-card .front{ transform:rotateY(180deg); }
    @keyframes cineFlyFlip {
      0%   { transform: translateZ(-1400px) rotateY(0deg)    scale(.60) translateY(0px);    }
      30%  { transform: translateZ(-900px)  rotateY(75deg)   scale(.78) translateY(-10px);  }
      55%  { transform: translateZ(-450px)  rotateY(150deg)  scale(.98) translateY(2px);    }
      100% { transform: translateZ(0px)     rotateY(180deg)  scale(1.18) translateY(0px);   }
    }
    @keyframes cineGhost {
      from { opacity:.0; transform: translateZ(-800px) scale(.75) }
      to   { opacity:.35; transform: translateZ(-300px) scale(.95) }
    }
    .cine-ghost{
      position:absolute; inset:0; border-radius:16px; pointer-events:none; opacity:.0; mix-blend-mode:screen; filter:blur(1px);
      background: radial-gradient(circle at 50% 50%, rgba(86,193,255,.25), transparent 65%);
      animation: cineGhost 1400ms ease-out forwards;
    }

    /* Brilho/azul pós-revelação + suporte ao ZeusFX */
    .card.god.reveal-done .front{
      border:2px solid #8fd8ff !important;
      box-shadow: 0 0 32px rgba(120,210,255,.65), inset 0 0 0 2px rgba(255,255,255,.08);
    }
    .card.god.reveal-done::before{
      content:""; position:absolute; inset:-8px; border-radius:22px; pointer-events:none;
      background: conic-gradient(from 0deg, rgba(0,170,255,.35), rgba(0,170,255,0) 10%, rgba(0,170,255,.35) 20%, rgba(0,170,255,0) 30%, rgba(0,170,255,.35) 40%, rgba(0,170,255,0) 100%);
      filter: blur(12px); opacity:.9; animation: spinBlue 7s linear infinite;
    }
    @keyframes spinBlue { to { transform: rotate(1turn) } }

    /* Zeus canvas camadas */
    .zeus-layer,.zeus-clouds,.zeus-flash{
      position:absolute; inset:0; border-radius:12px; pointer-events:none;
    }
    .zeus-layer{ z-index:6; mix-blend-mode:screen; }
    .zeus-clouds{
      z-index:2; opacity:.48; filter: blur(8px) saturate(1.2);
      background:
        radial-gradient(140% 70% at 50% -25%, rgba(14,131,241,.38) 0%, transparent 55%),
        radial-gradient(90% 45% at 15% -15%, rgba(0,150,255,.25) 0%, transparent 60%),
        radial-gradient(90% 45% at 85% -15%, rgba(0,150,255,.25) 0%, transparent 60%);
    }
    .zeus-flash{
      z-index:5; opacity:0; transition:opacity .22s ease;
      background: radial-gradient(65% 45% at 50% 35%, rgba(255,255,255,.55) 0%, rgba(0,180,255,.20) 35%, transparent 70%);
    }
    `;
    const style = document.createElement("style");
    style.id = "cineStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- ZEUS FX (o mesmo do álbum) ----------
  const ZEUS_MAP = new WeakMap();
  function attachZeusFX(host) {
    if (ZEUS_MAP.has(host)) return ZEUS_MAP.get(host);
    const handle = ZeusStorm(host);
    ZEUS_MAP.set(host, handle);
    return handle;
  }

  function ZeusStorm(host) {
    const clouds = document.createElement("div");
    clouds.className = "zeus-clouds";
    const flash = document.createElement("div");
    flash.className = "zeus-flash";
    const cnv = document.createElement("canvas");
    cnv.className = "zeus-layer";
    // preferimos aplicar sobre a FACE DA FRENTE para não vazar no verso
    const face = host.querySelector(".front") || host;
    face.appendChild(clouds);
    face.appendChild(flash);
    face.appendChild(cnv);

    const ctx = cnv.getContext("2d");
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    let w = 0,
      h = 0,
      running = true,
      last = performance.now();
    let bolts = [];
    let spawnAt = 0;

    const ro = new ResizeObserver(resize);
    ro.observe(face);
    resize();

    function resize() {
      const r = face.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      cnv.width = Math.round(w * DPR);
      cnv.height = Math.round(h * DPR);
      cnv.style.width = w + "px";
      cnv.style.height = h + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, w, h);
    }

    const rand = (a, b) => a + Math.random() * (b - a);

    function makeBoltSimple(x0, y0, x1, y1, iters = 3) {
      let pts = [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
      ];
      let offset = Math.hypot(x1 - x0, y1 - y0) * 0.2;
      for (let i = 0; i < iters; i++) {
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

    function makeBolt(x0, y0, x1, y1) {
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
            ny = dx / len;
          const disp = (Math.random() * 2 - 1) * offset;
          next.push({ x: mx + nx * disp, y: my + ny * disp }, b);

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
              pts: makeBoltSimple(bx, by, ex, ey, 2),
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
      flash.style.opacity = ".38";
      setTimeout(() => (flash.style.opacity = "0"), 120);
    }

    function drawBoltPath(pts, baseAlpha, thick) {
      if (!pts || pts.length < 2) return;
      ctx.globalCompositeOperation = "lighter";
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

      ctx.shadowBlur = 10;
      ctx.strokeStyle = `rgba(120,210,255,${0.55 * baseAlpha})`;
      ctx.lineWidth = thick * 4.5;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * baseAlpha})`;
      ctx.lineWidth = thick * 1.6;
      ctx.stroke();
    }

    let raf = 0;
    function tick(ts) {
      if (!running) return;
      const dt = Math.min(60, ts - last);
      last = ts;

      ctx.clearRect(0, 0, w, h);
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        b.age += dt;
        const t = b.age / b.life;
        drawBoltPath(b.pts, Math.max(0, 1 - t), b.thick);
        if (b.age >= b.life) bolts.splice(i, 1);
      }
      if (ts > spawnAt) {
        spawn();
        spawnAt = ts + (300 + Math.random() * 900);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

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

  // ---------- cena cinematográfica GOD ----------
  function playGodCinematic(originalCard) {
    ensureCineStyles();

    // constrói a cena
    const scene = document.createElement("div");
    scene.className = "cine-scene";
    const beam = document.createElement("div");
    beam.className = "cine-beam";
    scene.appendChild(beam);

    // estrelas/brilhos
    for (let i = 0; i < 60; i++) {
      const s = document.createElement("div");
      s.className = "cine-star";
      s.style.left = 40 + Math.random() * 20 + "%";
      s.style.top = Math.random() * 70 + "%";
      scene.appendChild(s);
      const d = 800 + Math.random() * 2800;
      setTimeout(() => {
        s.animate([{ opacity: 0 }, { opacity: 0.8 }, { opacity: 0 }], {
          duration: d,
          iterations: 1,
          easing: "ease-in-out",
        });
      }, Math.random() * 1500);
    }
    // chuvisco de luz (traços finos)
    for (let i = 0; i < 12; i++) {
      const r = document.createElement("div");
      r.className = "cine-rain";
      r.style.left = 46 + Math.random() * 8 + "%";
      r.style.top = "-80px";
      scene.appendChild(r);
      const delay = Math.random() * 800;
      const dur = 3000 + Math.random() * 2600;
      setTimeout(() => {
        r.style.opacity = ".7";
        r.animate(
          [
            { transform: "translate(-50%,-120px) rotate(10deg)" },
            { transform: "translate(-50%, 110vh) rotate(10deg)" },
          ],
          {
            duration: dur,
            easing: "cubic-bezier(.1,.7,.3,1)",
          }
        );
        setTimeout(() => r.remove(), dur + 400);
      }, delay);
    }

    // câmera/card 3D
    const cam = document.createElement("div");
    cam.className = "cine-cam";
    const c3d = document.createElement("div");
    c3d.className = "cine-card";

    // clona faces da carta original
    const inner = originalCard.querySelector(".card-inner");
    const back =
      inner?.querySelector(".back")?.cloneNode(true) ||
      (() => {
        const b = document.createElement("div");
        b.className = "face back";
        b.style.background = "#0e1a2b";
        return b;
      })();
    const front =
      inner?.querySelector(".front")?.cloneNode(true) ||
      (() => {
        const f = document.createElement("div");
        f.className = "face front";
        f.style.background = "#fff";
        return f;
      })();

    c3d.appendChild(back);
    c3d.appendChild(front);

    // fantasma de aura na trajetória
    const ghost = document.createElement("div");
    ghost.className = "cine-ghost";
    c3d.appendChild(ghost);

    cam.appendChild(c3d);
    scene.appendChild(cam);
    document.body.appendChild(scene);

    // aciona cena
    // dimensiona a carta clone para o mesmo tamanho da real
    const r = originalCard.getBoundingClientRect();
    c3d.style.setProperty("--card-w", r.width + "px");
    c3d.style.setProperty("--card-h", r.height + "px");

    // mostra
    requestAnimationFrame(() => scene.classList.add("on"));

    // animação principal (voo + flip)
    const anim = c3d.animate(
      [
        { transform: "translateZ(-1400px) rotateY(0deg) scale(.6)" },
        { transform: "translateZ(-900px) rotateY(75deg) scale(.78)" },
        { transform: "translateZ(-450px) rotateY(150deg) scale(.98)" },
        { transform: "translateZ(0) rotateY(180deg) scale(1.18)" },
      ],
      { duration: 2800, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
    );

    return new Promise((resolve) => {
      anim.onfinish = () => {
        // vira a carta real e aplica pós-efeitos
        const realInner = originalCard.querySelector(".card-inner");
        realInner.classList.add("flip");
        originalCard.classList.add("reveal-done");
        // luz/raios azuis
        attachZeusFX(originalCard);
        // fade out da cena
        const HOLD = 1200; // ← ajuste aqui para segurar mais/menos
        const FADE = 900; // ← fade-out mais lento
        setTimeout(() => {
          scene.style.transition = `opacity ${FADE}ms ease`;
          scene.style.opacity = "0";
          setTimeout(() => {
            try {
              scene.remove();
            } catch {}
            resolve();
          }, FADE + 50);
        }, HOLD);
      };
    });
  }

  // ---------- visual pack ----------
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

  // ---------- criação de carta ----------
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
        : rar === "god"
        ? "God"
        : "Normal";

    meta.appendChild(left);
    meta.appendChild(tag);
    front.appendChild(art);
    front.appendChild(meta);
    inner.appendChild(back);
    inner.appendChild(front);
    card.appendChild(inner);

    // efeitos visuais por raridade (leves enquanto exibindo no leque)
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

    setTimeout(() => card.classList.add("show"), 60 + index * 120);
    wrap.appendChild(card);

    if (item.isDuplicate) {
      const note = document.createElement("div");
      note.className = "dup-msg";
      note.textContent =
        "Carta repetida — vendida automaticamente por gold conforme a raridade (normal 2, épica 5, lendária 10 e mítica 20).";
      wrap.appendChild(note);
    }

    // clique para revelar
    card.addEventListener("click", async function () {
      const inner = this.querySelector(".card-inner");
      const isGod = this.classList.contains("god");

      // se já está virada, permitir alternar normalmente
      if (inner.classList.contains("flip")) {
        inner.classList.remove("flip");
        return;
      }

      if (isGod) {
        // cinema GOD: voo + flip + raios azuis
        await playGodCinematic(this);
        this.classList.add("reveal-done"); // azul
      } else {
        inner.classList.add("flip");
      }
    });

    return wrap;
  }

  // ---------- fluxos ----------
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
    // revela em cascata; cartas GOD usam o cinema (promessa) em sequência
    (async () => {
      for (const card of $$(".card", fan)) {
        if (card.dataset.raridade === "god") {
          if (!card.querySelector(".card-inner").classList.contains("flip")) {
            await playGodCinematic(card);
            card.classList.add("reveal-done");
          }
        } else {
          card.querySelector(".card-inner").classList.add("flip");
          await new Promise((r) => setTimeout(r, 350));
        }
      }
    })();
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

  // ---------- eventos ----------
  pack.addEventListener("click", openPackFlow);
  btnOpen?.addEventListener("click", openPackFlow);
  btnReveal?.addEventListener("click", revealAll);
  btnReset?.addEventListener("click", resetAll);
  btnBack?.addEventListener("click", () => {
    window.location.href = "/album-html";
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      !opened ? openPackFlow() : revealAll();
    }
    if (e.key.toLowerCase() === "r") resetAll();
    if (e.key === "Escape") window.location.href = "/album-html";
  });

  // ---------- init ----------
  (async function init() {
    await fetchPacks();
    updateButtons();
  })();
})();
