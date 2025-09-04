(function () {
  const $ = (s, c = document) => c.querySelector(s);

  const SPIN_MS = 7000;
  const SPIN_EASING = "cubic-bezier(.12,.82,.14,1)";
  const REPEATS = 10;

  const capsCountEl = $("#capsCount");
  const btnOpen = $("#btnOpen");
  const itemsDiv = $("#items");
  const resultDiv = $("#result");
  const overlay = $("#overlay");
  const rouletteEl = $("#roulette");
  const poolRail = $("#pool");
  const capsuleBox = $("#capsuleBox");
  const sfxRoleta = document.getElementById("sfxRoleta");

  const token = localStorage.getItem("auth_token");
  const auth = token ? { Authorization: `Bearer ${token}` } : {};

  const unwrap = (d) => d?.resultados ?? d ?? {};

  let pool = [];
  let spinning = false;
  let spinTimer = null;
  let strip = [];

  function openOverlay() {
    overlay.style.display = "flex";
  }
  function closeOverlay() {
    overlay.style.display = "none";
  }
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOverlay();
  });

  async function refreshCapsCount() {
    try {
      const r = await fetch("/shop/listar-capsulas-fechadas", {
        headers: auth,
      });
      const j = unwrap(await r.json());
      const qtd = Number(
        j?.quantidade ??
          (Array.isArray(j.capsulas) ? j.capsulas.length : 0) ??
          0
      );
      capsCountEl.textContent = String(qtd);
      btnOpen.disabled = !token || qtd <= 0;
    } catch {
      capsCountEl.textContent = "0";
      btnOpen.disabled = !token;
    }
  }

  async function loadPool() {
    try {
      const r = await fetch("/album/stickers", { headers: auth });
      const j = unwrap(await r.json());
      pool = j.stickers || [];
      if (pool.length === 0) throw new Error("Pool de stickers vazio.");
    } catch (e) {
      console.error("Falha ao carregar o pool de stickers.", e);
    }
    renderPool();
  }

  function renderPool() {
    poolRail.innerHTML = "";
    for (const s of pool) {
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `<img src="${s.imagem}" alt="${s.nome}"><div class="base"></div>`;
      poolRail.appendChild(el);
    }
  }

  function buildStrip() {
    itemsDiv.innerHTML = "";
    strip = [];
    const base = pool.slice();
    const shuffle = (a) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    for (let r = 0; r < REPEATS; r++) {
      strip.push(...shuffle(base));
    }
    for (const s of strip) {
      const it = document.createElement("div");
      it.className = "item";
      it.innerHTML = `<div class="thumb"><img src="${s.imagem}" alt="${s.nome}"></div><div class="caption">${s.nome}</div>`;
      itemsDiv.appendChild(it);
    }
    itemsDiv.style.transition = "none";
    itemsDiv.style.transform = "translate3d(0,0,0)";
    void itemsDiv.offsetWidth;
  }

  function runRouletteAnimation(target, chosenIndex, reqPromise) {
    const chosenEl = itemsDiv.children[chosenIndex];
    if (!chosenEl) {
      console.error("Elemento da roleta não encontrado:", chosenIndex);
      spinning = false;
      closeOverlay();
      return;
    }
    const itemCenter = chosenEl.offsetLeft + chosenEl.offsetWidth / 2;
    const containerCenter = rouletteEl.clientWidth / 2;
    const targetX = Math.round(containerCenter - itemCenter);

    try {
      sfxRoleta.currentTime = 0;
      sfxRoleta.volume = 1;
      sfxRoleta.play();
    } catch (e) {}

    itemsDiv.style.transition = `transform ${SPIN_MS}ms ${SPIN_EASING}`;
    itemsDiv.style.transform = `translate3d(${targetX}px,0,0)`;

    const finishRoll = () => {
      try {
        sfxRoleta.pause();
      } catch {}

      reqPromise.then((j) => {
        // Se a requisição falhar, j será null.
        if (!j) {
          resultDiv.innerHTML = `<div class="result"><h2>Erro</h2><p>Ocorreu um problema ao abrir a cápsula. Tente novamente.</p><button class="btn primary" id="btnFechar">Fechar</button></div>`;
          resultDiv.style.display = "block";
          $("#btnFechar", resultDiv).onclick = () => {
            closeOverlay();
            spinning = false;
          };
          return;
        }

        const isDup = j.duplicadas && j.duplicadas.length > 0;

        // =====================================================================
        // CORREÇÃO: Usa as mensagens dinâmicas vindas do back-end
        // =====================================================================
        const msgTop = isDup ? "Azar!" : "Parabéns!";
        // O back-end agora envia a mensagem correta, seja para sticker novo ou para venda de duplicata.
        const msgSub = isDup ? j.mensagens.repetidas : j.mensagens.novas;
        // =====================================================================

        resultDiv.innerHTML = `<div class="result"><h2>${msgTop}</h2><p>${msgSub}</p><div class="winbox"><img src="${target.imagem}" alt="${target.nome}"></div><button class="btn primary" id="btnFechar">Fechar</button></div>`;
        resultDiv.style.display = "block";

        if (typeof window.__onStickerDrop === "function") {
          window.__onStickerDrop(target);
        }

        // Se o back-end enviou o novo saldo, atualiza o auth.js
        if (
          typeof j.saldoGoldAtual === "number" &&
          typeof window.updateGoldBadge === "function"
        ) {
          window.updateGoldBadge(j.saldoGoldAtual);
        }

        refreshCapsCount();

        $("#btnFechar", resultDiv).onclick = () => {
          closeOverlay();
          spinning = false;
        };
      });
    };

    itemsDiv.addEventListener("transitionend", finishRoll, { once: true });
    clearTimeout(spinTimer);
    spinTimer = setTimeout(finishRoll, SPIN_MS + 100);
  }

  btnOpen.addEventListener("click", async () => {
    if (spinning || btnOpen.disabled) return;
    spinning = true;

    try {
      sfxRoleta.volume = 0;
      sfxRoleta.play().catch(() => {});
    } catch {}

    capsuleBox.classList.add("opening");
    await new Promise((resolve) => setTimeout(resolve, 900));
    capsuleBox.classList.remove("opening");

    openOverlay();
    resultDiv.style.display = "none";
    buildStrip();

    const reqPromise = fetch("/album/stickers/capsulas", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then(unwrap)
      .catch(() => null);

    reqPromise.then((j) => {
      const winData = j?.novas?.[0] || j?.duplicadas?.[0] || null;
      let target, chosenIndex;

      if (winData && winData.id) {
        const winnerId = winData.id;
        let foundWinner = false;
        for (let i = strip.length - 1; i >= 0; i--) {
          if (strip[i].id === winnerId) {
            target = strip[i];
            chosenIndex = i;
            foundWinner = true;
            break;
          }
        }
        if (!foundWinner) {
          chosenIndex = Math.floor(Math.random() * (strip.length - 20)) + 10;
          target = strip[chosenIndex];
        }
      } else {
        chosenIndex = Math.floor(Math.random() * (strip.length - 20)) + 10;
        target = strip[chosenIndex];
      }

      runRouletteAnimation(target, chosenIndex, reqPromise);
    });
  });

  (async function init() {
    await loadPool();
    await refreshCapsCount();
  })();
})();
