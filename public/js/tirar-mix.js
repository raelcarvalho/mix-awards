// public/js/tirar-mix.js
(() => {
  // ===== helpers
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const normalizeToken = (raw) => {
    if (!raw) return "";
    try {
      const maybe = JSON.parse(raw);
      return maybe?.token?.token || maybe?.token || raw;
    } catch {
      return String(raw).replace(/^"+|"+$/g, "");
    }
  };
  const TOKEN = normalizeToken(localStorage.getItem("auth_token") || "");

  const api = async (url, opt = {}) => {
    const headers = { ...(opt.headers || {}) };
    if (opt.body && !headers["Content-Type"])
      headers["Content-Type"] = "application/json";
    if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;
    const res = await fetch(url, { ...opt, headers });
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      location.href = "/login-html";
      throw new Error("401");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(data?.mensagem || data?.message || res.statusText);
    return data;
  };

  // ===== endpoints
  const ENDPOINT = {
    players: "/api/tirar-mix/jogadores-disponiveis",
    stats: "/api/tirar-mix/stats",
    getSession: "/api/tirar-mix/sessao/atual",
    newSession: "/api/tirar-mix/sessao/nova",
    parImpar: (id) => `/api/tirar-mix/par-impar/${id}`,
    convidarCapitaes: "/api/tirar-mix/convites/capitaes",
    conviteMinhaSituacao: "/api/tirar-mix/convites/minha-situacao",
    conviteAceitar: (t) => `/api/tirar-mix/convites/${t}/aceitar`,
    conviteRecusar: (t) => `/api/tirar-mix/convites/${t}/recusar`,
    iniciarDraft: "/api/tirar-mix/draft/iniciar",
    desfazerUltimo: "/api/tirar-mix/draft/desfazer",
    pick: "/api/tirar-mix/pick",
    heartbeat: "/api/tirar-mix/heartbeat",
  };

  // ===== estado
  const state = {
    sessao: null,
    players: [],
    stats: {}, // { [id]: {kdr, wr, kast} }
    filtro: "",
    timeA: [],
    timeB: [],
    capA: null,
    capB: null,
    convites: null, // {A:{status,token?}, B:{...}, eu:{token?,time?}}
    pollingId: null,
    hbId: null,
  };

  // ===== refs
  const refs = {
    btnNova: $("#btn_nova"),
    btnParImpar: $("#btn_parimpar"),
    parImparTag: $("#parimpar_result"),
    btnEnviarConvites: $("#btn_enviar_convites"),
    btnIniciar: $("#btn_iniciar"),
    btnUndo: $("#btn_undo"),
    btnAceitarCap: $("#btn_aceitar_capitao"),
    sessaoLbl: $("#sessao_lbl"),
    myJogadorInput: $("#meu_jogador_id"),
    listPlayers: $("#players"),
    listA: $("#team_a"),
    listB: $("#team_b"),
    search: $("#busca"),
    turnoTag: $("#turno_tag"),
    subTurno: $("#sub_turno"),
  };

  // ===== ui utils
  function avatarUrl(p) {
    // sem fallback /img/{id}.png — para evitar 404 em massa
    const tries = [
      p.foto_url,
      p.sticker_id ? `/uploads/stickers/${p.sticker_id}.png` : null,
      p.figurinha_id ? `/uploads/figurinhas/${p.figurinha_id}.png` : null,
    ].filter(Boolean);
    return tries[0] || "";
  }
  const initials = (n = "") => {
    const s = (n || "").trim().toUpperCase().split(/\s+/);
    return (s[0]?.[0] || "?") + (s[1]?.[0] || "");
  };
  const statText = (v, suff = "") => {
    if (v == null || Number.isNaN(+v)) return "—";
    if (suff === "%") return `${Math.round(+v)}%`;
    return (+v).toFixed(2).replace(".", ",");
  };

  // ===== draft helpers
  const TURNOS = [
    { time: "A", qtd: 1 },
    { time: "B", qtd: 2 },
    { time: "A", qtd: 2 },
    { time: "B", qtd: 2 },
    { time: "A", qtd: 1 },
  ];
  const swap = (t) => (t === "A" ? "B" : "A");

  function nextTurnTeam() {
    const s = state.sessao;
    if (!s || s.status !== "draft_em_andamento") return null;
    const bloco = TURNOS[s.turno_index] || null;
    if (!bloco) return null;
    const flip = s.parImparVencedor === "B";
    return flip ? swap(bloco.time) : bloco.time;
  }

  // ===== render
  function renderHeader() {
    refs.sessaoLbl &&
      (refs.sessaoLbl.textContent = state.sessao ? `#${state.sessao.id}` : "—");

    const st = state.sessao?.status || "—";
    const texto =
      st === "criando"
        ? "Escolha 2 capitães (online) e envie os convites."
        : st === "capitaes_definidos"
        ? "Aguarde ambos aceitarem. Depois faça Par/Ímpar e inicie o draft."
        : st === "draft_em_andamento"
        ? `Draft em andamento — turno do Time ${nextTurnTeam() || "?"}.`
        : st === "finalizado"
        ? "Times completos, prontos para mix!"
        : "Crie a sessão, convide capitães e inicie o draft.";

    if (refs.turnoTag) refs.turnoTag.textContent = st || "—";
    if (refs.subTurno) refs.subTurno.textContent = texto;

    // habilitação dos botões
    const doisCaps = !!(state.capA && state.capB);
    const ambosAceitos =
      state.convites?.A?.status === "aceito" &&
      state.convites?.B?.status === "aceito";

    refs.btnEnviarConvites &&
      (refs.btnEnviarConvites.disabled = !(
        state.sessao &&
        doisCaps &&
        (st === "criando" || st === "capitaes_definidos")
      ));
    refs.btnParImpar &&
      (refs.btnParImpar.disabled = !(
        state.sessao &&
        ambosAceitos &&
        st === "capitaes_definidos"
      ));
    refs.btnIniciar &&
      (refs.btnIniciar.disabled = !(
        state.sessao &&
        ambosAceitos &&
        state.sessao?.parImparVencedor &&
        st === "capitaes_definidos"
      ));
    refs.btnUndo && (refs.btnUndo.disabled = st !== "draft_em_andamento");
    refs.btnAceitarCap && (refs.btnAceitarCap.disabled = !state.sessao);
  }

  function canPickFor(team, playerId) {
    const s = state.sessao;
    if (!s || s.status !== "draft_em_andamento") return false;

    // só habilita se é o turno do time correto
    const turnTeam = nextTurnTeam();
    if (turnTeam !== team) return false;

    // não pode ser capitão
    if (
      (team === "A" && state.capA === playerId) ||
      (team === "B" && state.capB === playerId)
    )
      return false;

    // não repetir nos times locais
    if (state.timeA.some((x) => x.id === playerId)) return false;
    if (state.timeB.some((x) => x.id === playerId)) return false;

    return true;
  }

  function playerRow(p) {
    const st = state.stats[p.id] || {};
    const img = avatarUrl(p);
    const enableA = canPickFor("A", p.id);
    const enableB = canPickFor("B", p.id);

    // antes de capitães aceitarem, botões "Time A/B" ficam bloqueados
    const podeMarcarCaps = state.sessao && state.sessao.status === "criando";

    return `
      <div class="tmx-player" data-id="${p.id}">
        <div class="tmx-ava">
          ${
            img
              ? `<img src="${img}" alt="${p.nick}" loading="lazy" onerror="this.remove()">`
              : `<span>${initials(p.nick)}</span>`
          }
        </div>
        <div>
          <div style="font-weight:800">${p.nick} <span style="opacity:.6">#${
      p.id
    }</span></div>
          <div class="tmx-meta">
            <span>KDR: <b>${statText(st.kdr)}</b></span>
            <span>WR: <b>${statText(st.wr, "%")}</b></span>
            <span>KAST: <b>${statText(st.kast, "%")}</b></span>
          </div>
        </div>
        <div class="tmx-actions">
          <button class="tmx-btn" data-act="addA" data-id="${p.id}" ${
      enableA ? "" : "disabled"
    }>Time A</button>
          <button class="tmx-btn" data-act="addB" data-id="${p.id}" ${
      enableB ? "" : "disabled"
    }>Time B</button>
          <button class="tmx-btn warn" data-act="capA" data-id="${p.id}" ${
      podeMarcarCaps ? "" : "disabled"
    }>Cap A</button>
          <button class="tmx-btn warn" data-act="capB" data-id="${p.id}" ${
      podeMarcarCaps ? "" : "disabled"
    }>Cap B</button>
        </div>
      </div>`;
  }

  function renderPlayers() {
    if (!refs.listPlayers) return;
    const term = state.filtro.trim().toLowerCase();
    const list = state.players.filter(
      (p) => !term || (p.nick || "").toLowerCase().includes(term)
    );
    refs.listPlayers.innerHTML = list.map(playerRow).join("");
  }

  const slot = (content = "vazio", extra = "") =>
    `<div class="tmx-slot ${extra}">${content}</div>`;

  function renderTeam(listEl, teamArr, capId, rotuloCap) {
    if (!listEl) return;
    const items = [];
    if (capId) {
      const p = state.players.find((x) => x.id === capId);
      items.push(
        slot(`${p?.nick || capId} <span class="cap">(${rotuloCap})</span>`)
      );
    } else {
      items.push(slot(`${rotuloCap} não definido`, "empty"));
    }
    for (let i = 0; i < 4; i++) {
      const p = teamArr[i];
      items.push(p ? slot(`${p.nick}`) : slot("vazio", "empty"));
    }
    listEl.innerHTML = items.join("");
  }

  function renderAll() {
    renderHeader();
    renderPlayers();
    renderTeam(refs.listA, state.timeA, state.capA, "Capitão A");
    renderTeam(refs.listB, state.timeB, state.capB, "Capitão B");
  }

  // ===== polling de convites + sessão
  async function refreshConvites() {
    if (!state.sessao) return;
    try {
      const data = await api(
        `${ENDPOINT.conviteMinhaSituacao}?sessao_id=${state.sessao.id}`
      );
      state.convites = data?.resultados || data || null;
    } catch {}
  }
  async function refreshSessao() {
    try {
      const s = await api(ENDPOINT.getSession);
      state.sessao = s?.resultados || s || state.sessao;
      if (state.sessao?.status === "finalizado") {
        refs.subTurno &&
          (refs.subTurno.textContent = "Times completos, prontos para mix!");
      }
    } catch {}
  }
  function startPolling() {
    stopPolling();
    state.pollingId = setInterval(async () => {
      await refreshSessao();
      await refreshConvites();
      renderAll();
    }, 2000);
  }
  function stopPolling() {
    if (state.pollingId) {
      clearInterval(state.pollingId);
      state.pollingId = null;
    }
  }

  // ===== heartbeat
  async function heartbeat() {
    if (!state.sessao) return;
    const jid = Number(refs.myJogadorInput?.value) || null;
    try {
      await api(ENDPOINT.heartbeat, {
        method: "POST",
        body: JSON.stringify({
          session_id: state.sessao.id,
          jogador_id: jid || undefined,
        }),
      });
    } catch {}
  }
  function startHeartbeat() {
    stopHeartbeat();
    state.hbId = setInterval(heartbeat, 25000);
  }
  function stopHeartbeat() {
    if (state.hbId) {
      clearInterval(state.hbId);
      state.hbId = null;
    }
  }

  // ===== ações
  async function ensureSession() {
    try {
      const s = await api(ENDPOINT.getSession);
      state.sessao = s?.resultados || s || null;
    } catch {
      const n = await api(ENDPOINT.newSession, { method: "POST" });
      state.sessao = n?.resultados || n || null;
    }
    renderAll();
    startPolling();
    heartbeat(); // faz um ping imediato
  }

  async function loadPlayersAndStats() {
    const res = await api(ENDPOINT.players);
    const arr = res?.resultados || res?.players || res || [];
    state.players = arr.map((p) => ({
      id: +p.id || +p.jogador_id || +p.jogadores_id,
      nick: p.nick || p.nickname || p.nome || `#${p.id}`,
      figurinha_id: p.figurinha_id ?? p.album_figurinha_id ?? null,
      sticker_id: p.sticker_id ?? null,
      foto_url: p.foto_url || p.avatar_url || null,
    }));
    renderPlayers();

    try {
      const ids = state.players.map((p) => p.id).slice(0, 200);
      if (ids.length) {
        const st = await api(`${ENDPOINT.stats}?ids=${ids.join(",")}`);
        const list = st?.resultados || st || [];
        state.stats = {};
        for (const s of list) {
          const id = +s.jogador_id || +s.id;
          state.stats[id] = {
            kdr: s.kdr_medio != null ? +s.kdr_medio : null,
            wr: s.win_rate != null ? +s.win_rate : null,
            kast: s.kast_medio != null ? +s.kast_medio : null,
          };
        }
      }
    } catch (e) {
      console.debug("stats error:", e.message);
    }
    renderPlayers();
  }

  async function enviarConvites() {
    if (!state.capA || !state.capB || !state.sessao?.id) {
      alert("Selecione os dois capitães (online) antes de enviar.");
      return;
    }
    try {
      const data = await api(ENDPOINT.convidarCapitaes, {
        method: "POST",
        body: JSON.stringify({
          sessao_id: state.sessao.id,
          capA_id: state.capA,
          capB_id: state.capB,
        }),
      });
      state.convites = data?.resultados || data || null;
      openInviteModal(); // mostra a modal com status
      renderAll();
    } catch (e) {
      alert(e.message || "Falha ao enviar convites.");
    }
  }

  async function aceitarMeuConvite() {
    if (!state.sessao?.id) return;
    try {
      const sit = await api(
        `${ENDPOINT.conviteMinhaSituacao}?sessao_id=${state.sessao.id}`
      );
      const eu = sit?.eu;
      if (!eu?.token) {
        alert("Nenhum convite para este usuário.");
        return;
      }
      await api(ENDPOINT.conviteAceitar(eu.token), { method: "POST" });
      await refreshConvites();
      setInviteStatus();
      alert("Convite aceito!");
    } catch (e) {
      alert(e.message || "Falha ao aceitar convite.");
    }
  }

  async function parImpar() {
    if (!state.sessao?.id) return;
    try {
      const r = await api(ENDPOINT.parImpar(state.sessao.id), {
        method: "POST",
      });
      refs.parImparTag && (refs.parImparTag.style.display = "inline-flex");
      refs.parImparTag &&
        (refs.parImparTag.textContent = `Número: ${r.numero} → Vencedor: ${r.vencedor}`);
      await refreshSessao();
      renderAll();
    } catch (e) {
      alert(e.message || "Falha no Par/Ímpar.");
    }
  }

  async function iniciarDraft() {
    if (!state.sessao?.id) return;
    try {
      await api(ENDPOINT.iniciarDraft, {
        method: "POST",
        body: JSON.stringify({ sessao_id: state.sessao.id }),
      });
      await refreshSessao();
      renderAll();
      alert("Draft iniciado!");
    } catch (e) {
      alert(e.message || "Falha ao iniciar draft.");
    }
  }

  function addToTeam(time, id) {
    const p = state.players.find((x) => x.id === id);
    if (!p) return;

    // só permite quando já está em draft e é o turno do time
    if (!canPickFor(time, id)) return;

    const cap = time === "A" ? state.capA : state.capB;
    if (!cap) return;

    const team = time === "A" ? state.timeA : state.timeB;
    if (team.length >= 4) return;
    if (
      state.timeA.some((x) => x.id === id) ||
      state.timeB.some((x) => x.id === id)
    )
      return;

    team.push(p);
    renderAll();

    // persiste pick
    api(ENDPOINT.pick, {
      method: "POST",
      body: JSON.stringify({
        sessao_id: state.sessao.id,
        captain_id: cap,
        player_id: id,
      }),
    })
      .then(async () => {
        await refreshSessao();
        renderAll();
      })
      .catch((e) => alert(e.message || "Falha ao salvar pick."));
  }

  async function desfazerUltimo() {
    try {
      await api(ENDPOINT.desfazerUltimo, {
        method: "POST",
        body: JSON.stringify({ sessao_id: state.sessao.id }),
      });
      // reseta listas locais (mantemos só capitães)
      state.timeA = [];
      state.timeB = [];
      await refreshSessao();
      renderAll();
    } catch {}
  }

  function setCap(time, id) {
    if (state.sessao?.status !== "criando") return;
    if (time === "A") state.capA = id;
    else state.capB = id;
    renderAll();
  }

  // ===== modal de convites
  function ensureInviteModal() {
    if ($("#mixInviteModal")) return;
    const css = document.createElement("style");
    css.textContent = `
      .mw-modal{position:fixed;inset:0;display:none;z-index:1050}
      .mw-modal.is-open{display:block}
      .mw-back{position:absolute;inset:0;background:rgba(0,0,0,.5)}
      .mw-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(92vw,520px);background:#11293d;color:#e8f1f8;border-radius:16px;padding:22px;
        box-shadow:0 18px 60px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.05);
        font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
      .mw-title{margin:0 0 6px;font-size:1.25rem}
      .mw-sub{margin:0 0 16px;color:#b9d4ea}
      .mw-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px dashed #244a6a}
      .mw-row:first-of-type{border-top:0}
      .mw-actions{margin-top:16px;display:flex;gap:10px;justify-content:flex-end}
      .btn{padding:10px 12px;border-radius:10px;border:1px solid #244a6a;background:#0f2337;color:#e6f2ff;cursor:pointer}
      .btn.primary{background:#56c1ff;color:#072033;border-color:#2a88b8}
      .status{font-weight:700}
      .status.ok{color:#9effb0}
      .status.wait{color:#f4c84a}
      .status.err{color:#ff9e9e}
    `;
    document.head.appendChild(css);

    const div = document.createElement("div");
    div.id = "mixInviteModal";
    div.className = "mw-modal";
    div.innerHTML = `
      <div class="mw-back" data-close="true"></div>
      <div class="mw-card" role="dialog" aria-modal="true">
        <h3 class="mw-title">Convites de capitão</h3>
        <p class="mw-sub">Aceite/recuse seu convite e acompanhe o status do outro capitão.</p>
        <div class="mw-row"><span>Capitão A:</span> <span id="stCapA" class="status wait">—</span></div>
        <div class="mw-row"><span>Capitão B:</span> <span id="stCapB" class="status wait">—</span></div>
        <div class="mw-actions">
          <button id="btnRecusarConvite" class="btn">Recusar</button>
          <button id="btnAceitarConvite" class="btn primary">Aceitar</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    div.addEventListener("click", (e) => {
      if (e.target.dataset.close === "true") closeInviteModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && div.classList.contains("is-open"))
        closeInviteModal();
    });

    // wire
    $("#btnAceitarConvite")?.addEventListener("click", aceitarMeuConvite);
    $("#btnRecusarConvite")?.addEventListener("click", async () => {
      try {
        const data = await api(
          `${ENDPOINT.conviteMinhaSituacao}?sessao_id=${state.sessao.id}`
        );
        const eu = data?.eu;
        if (eu?.token)
          await api(ENDPOINT.conviteRecusar(eu.token), { method: "POST" });
        await refreshConvites();
        setInviteStatus();
      } catch {}
    });
  }
  function openInviteModal() {
    ensureInviteModal();
    $("#mixInviteModal").classList.add("is-open");
    setInviteStatus();
  }
  function closeInviteModal() {
    $("#mixInviteModal")?.classList.remove("is-open");
  }
  function setInviteStatus() {
    const a = $("#stCapA"),
      b = $("#stCapB");
    const sa = state.convites?.A?.status,
      sb = state.convites?.B?.status;

    const cls = (el, st) => {
      if (!el) return;
      el.className =
        "status " +
        (st === "aceito" ? "ok" : st === "recusado" ? "err" : "wait");
      el.textContent =
        st === "aceito"
          ? "Aceito"
          : st === "recusado"
          ? "Recusado"
          : "Pendente";
    };
    cls(a, sa);
    cls(b, sb);
    renderHeader();
  }

  // ===== eventos UI
  function wireUI() {
    refs.search?.addEventListener("input", (e) => {
      state.filtro = e.target.value;
      renderPlayers();
    });

    refs.listPlayers?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const id = +btn.dataset.id;
      const act = btn.dataset.act;
      if (act === "addA") addToTeam("A", id);
      if (act === "addB") addToTeam("B", id);
      if (act === "capA") setCap("A", id);
      if (act === "capB") setCap("B", id);
    });

    refs.myJogadorInput?.addEventListener("change", heartbeat);

    refs.btnNova?.addEventListener("click", async () => {
      const n = await api(ENDPOINT.newSession, { method: "POST" });
      state.sessao = n?.resultados || n || null;
      state.timeA = [];
      state.timeB = [];
      state.capA = null;
      state.capB = null;
      state.convites = null;
      refs.parImparTag && (refs.parImparTag.style.display = "none");
      startPolling();
      heartbeat();
      renderAll();
    });

    refs.btnEnviarConvites?.addEventListener("click", enviarConvites);
    refs.btnAceitarCap?.addEventListener("click", aceitarMeuConvite);
    refs.btnParImpar?.addEventListener("click", parImpar);
    refs.btnIniciar?.addEventListener("click", iniciarDraft);
    refs.btnUndo?.addEventListener("click", desfazerUltimo);
  }

  // ===== boot
  document.addEventListener("DOMContentLoaded", async () => {
    if (!TOKEN) {
      location.href = "/login-html";
      return;
    }
    wireUI();
    await ensureSession();
    await loadPlayersAndStats();
    startHeartbeat();
    renderAll();
  });
})();
