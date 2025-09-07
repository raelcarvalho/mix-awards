// public/js/auth.js
(function () {
  // ===== helpers =====
  const $ = (id) => document.getElementById(id);
  const nav = document.querySelector(".nav");

  // Layout básico do nav
  if (nav) {
    Object.assign(nav.style, {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      padding: "10px 16px",
      background: "#0b1824",
      color: "#e8f1f8",
      borderBottom: "1px solid #12304a",
    });
  }

  // Refs
  const loginModal = $("loginModal");
  const openLogin = $("btnOpenLogin");
  const closeLogin = $("btnCloseLogin");
  const loginForm = $("loginForm");
  const loginEmail = $("loginEmail");
  const loginSenha = $("loginSenha");
  const loginMsg = $("loginMsg");
  const btnDoLogin = $("btnDoLogin");

  // ===== utils =====
  const GOLD_ICON_CANDIDATES = ["/uploads/figurinhas/3310001.png"];
  const GOLD_ENDPOINTS = ["/api/jogadores/gold"];

  const getStoredUser = () => {
    const s = localStorage.getItem("auth_user");
    try {
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  };

  const setStoredUser = (u) => {
    if (!u) return localStorage.removeItem("auth_user");
    localStorage.setItem("auth_user", JSON.stringify(u));
  };

  const formatBR = (n) =>
    new Intl.NumberFormat("pt-BR").format(Number.isFinite(+n) ? +n : 0);

  // normaliza token salvo
  const normalizeToken = (raw) => {
    if (!raw) return "";
    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        const obj = JSON.parse(raw);
        return obj?.token?.token || obj?.token || "";
      } catch {
        return "";
      }
    }
    return String(raw).replace(/^"+|"+$/g, "");
  };

  async function fetchGoldFromApi() {
    const rawToken = localStorage.getItem("auth_token");
    const token = normalizeToken(rawToken);
    if (!token) return null;

    const u = getStoredUser();
    const id = u?.id || u?.usuario_id || u?.user_id;
    const q = id ? `?usuario_id=${encodeURIComponent(id)}` : "";

    for (const base of GOLD_ENDPOINTS) {
      try {
        const r = await fetch(`${base}${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (r.status === 401) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          return null;
        }

        if (!r.ok) {
          try {
            const j = await r.json();
            console.debug("gold api err:", j);
          } catch {}
          continue;
        }

        const data = await r.json();
        const gold = data?.resultados?.gold ?? data?.gold;
        if (Number.isFinite(+gold)) return +gold;
      } catch {
      }
    }
    return null;
  }

  async function updateGoldBadge() {
    const qtyEl = document.getElementById("goldQty");
    if (!qtyEl) return;

    let gold = await fetchGoldFromApi();
    if (!Number.isFinite(gold)) {
      const u = getStoredUser();
      gold = Number.isFinite(+u?.gold) ? +u.gold : 0;
    } else {
      const u = getStoredUser() || {};
      setStoredUser({ ...u, gold });
    }
    qtyEl.textContent = formatBR(gold);
  }

  function wireGoldIconFallback(imgEl) {
    if (!imgEl) return;
    let idx = 0;
    imgEl.src = GOLD_ICON_CANDIDATES[idx];
    imgEl.addEventListener(
      "error",
      () => {
        idx += 1;
        if (idx < GOLD_ICON_CANDIDATES.length)
          imgEl.src = GOLD_ICON_CANDIDATES[idx];
        else imgEl.replaceWith(svgCoin());
      },
      { once: true }
    );
  }

  function svgCoin() {
    const span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    span.style.width = "18px";
    span.style.height = "18px";
    span.style.display = "inline-block";
    span.style.borderRadius = "50%";
    span.style.background = "linear-gradient(180deg,#ffd35a,#ffb200)";
    span.style.boxShadow = "inset 0 0 0 2px rgba(0,0,0,.15)";
    return span;
  }

  // ===== modal helpers =====
  function openModal(el, focusEl) {
    if (!el) {
      window.location.href = "/login-html";
      return;
    }
    el.classList.add("is-open");
    const msg = el.querySelector(".mw-msg");
    if (msg) {
      msg.textContent = "";
      msg.className = "mw-msg";
    }
    el.querySelector("form")?.reset();
    if (el.id === "loginModal" && btnDoLogin) btnDoLogin.disabled = false;
    setTimeout(() => focusEl?.focus(), 0);
  }
  function closeModal(el) {
    if (el) el.classList.remove("is-open");
  }

  if (loginModal) {
    loginModal.addEventListener("click", (e) => {
      if (e.target.dataset.close === "true") closeModal(loginModal);
    });
  }
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      loginModal &&
      loginModal.classList.contains("is-open")
    ) {
      closeModal(loginModal);
    }
  });
  openLogin?.addEventListener("click", () => openModal(loginModal, loginEmail));
  closeLogin?.addEventListener("click", () => closeModal(loginModal));

  // ====== ALTERAR SENHA (MODAL embutido no nav) ======
  function ensureChangePwdModal() {
    if (document.getElementById("changePwdModal")) return;

    if (!document.getElementById("changePwdStyles")) {
      const style = document.createElement("style");
      style.id = "changePwdStyles";
      style.textContent = `
        .mw-modal{position:fixed;inset:0;display:none;z-index:1050}
        .mw-modal.is-open{display:block}
        .mw-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(1px)}
        .mw-modal__dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
          width:min(92vw,480px);background:#11293d;color:#e8f1f8;border-radius:16px;padding:22px 20px 20px;
          box-shadow:0 18px 60px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.05);
          font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
        .mw-modal__title{margin:0 0 10px;font-size:1.25rem;text-align:center}
        .mw-field{display:block;margin:12px 0}
        .mw-field>span{display:block;font-size:.9rem;color:#b9d4ea;margin-bottom:6px}
        .mw-field>input{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #1e3a53;background:#0f2233;color:#e8f1f8;outline:none}
        .mw-field>input:focus{border-color:#56c1ff;outline:3px solid rgba(86,193,255,.25)}
        .mw-btn{width:100%;margin-top:10px;padding:12px;border:0;border-radius:10px;font-weight:700;background:#56c1ff;color:#072033;cursor:pointer}
        .mw-msg{min-height:18px;margin-top:10px;font-size:.92rem}
        .mw-msg.error{color:#ff9e9e}.mw-msg.ok{color:#9effb0}
        .mw-modal__close{position:absolute;right:10px;top:8px;width:36px;height:36px;border:0;border-radius:10px;cursor:pointer;background:transparent;color:#cfe8ff;font-size:22px;line-height:1}
        .mw-modal__close:hover{background:rgba(255,255,255,.06)}
      `;
      document.head.appendChild(style);
    }

    const div = document.createElement("div");
    div.id = "changePwdModal";
    div.className = "mw-modal";
    div.innerHTML = `
      <div class="mw-modal__backdrop" data-close="true"></div>
      <div class="mw-modal__dialog" role="document">
        <button class="mw-modal__close" type="button" id="cpCloseBtn">×</button>
        <h2 class="mw-modal__title">Alterar senha</h2>
        <form id="cpForm" novalidate>
          <label class="mw-field">
            <span>Senha atual</span>
            <input id="cpOld" type="password" maxlength="100" required placeholder="••••••••"/>
          </label>
          <label class="mw-field">
            <span>Nova senha</span>
            <input id="cpNew" type="password" maxlength="100" required placeholder="••••••••"/>
          </label>
          <label class="mw-field">
            <span>Confirmar nova senha</span>
            <input id="cpNew2" type="password" maxlength="100" required placeholder="••••••••"/>
          </label>
          <button id="cpBtn" class="mw-btn" type="submit">Salvar nova senha</button>
          <div id="cpMsg" class="mw-msg"></div>
        </form>
      </div>
    `;
    document.body.appendChild(div);

    const modal = div;
    const form = div.querySelector("#cpForm");
    const oldI = div.querySelector("#cpOld");
    const newI = div.querySelector("#cpNew");
    const new2 = div.querySelector("#cpNew2");
    const btn = div.querySelector("#cpBtn");
    const msg = div.querySelector("#cpMsg");

    const open = () => {
      modal.classList.add("is-open");
      msg.textContent = "";
      msg.className = "mw-msg";
      form.reset();
      setTimeout(() => oldI?.focus(), 0);
    };
    const close = () => modal.classList.remove("is-open");

    modal.addEventListener("click", (e) => {
      if (e.target.id === "cpCloseBtn" || e.target.dataset.close === "true")
        close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) close();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "";
      msg.className = "mw-msg";

      if (newI.value !== new2.value) {
        msg.textContent = "A confirmação não confere.";
        msg.className = "mw-msg error";
        return;
      }
      if (newI.value.length < 6) {
        msg.textContent = "A nova senha deve ter ao menos 6 caracteres.";
        msg.className = "mw-msg error";
        return;
      }

      const raw = localStorage.getItem("auth_token");
      const token = normalizeToken(raw);
      if (!token) {
        window.location.href = "/login-html";
        return;
      }

      btn.disabled = true;
      try {
        const res = await fetch("/alterar-senha", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            senha_anterior: oldI.value,
            nova_senha: newI.value,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          msg.textContent = data?.mensagem || "Erro ao alterar a senha.";
          msg.className = "mw-msg error";
          btn.disabled = false;
          return;
        }

        const newTok =
          (data?.resultados?.token &&
            (data.resultados.token.token || data.resultados.token)) ||
          (data?.token && (data.token.token || data.token)) ||
          "";
        if (newTok) localStorage.setItem("auth_token", newTok);
        if (data?.resultados?.usuario)
          localStorage.setItem(
            "auth_user",
            JSON.stringify(data.resultados.usuario)
          );

        msg.textContent = "Senha alterada com sucesso!";
        msg.className = "mw-msg ok";
        setTimeout(close, 800);
      } catch (err) {
        msg.textContent = "Erro inesperado.";
        msg.className = "mw-msg error";
        btn.disabled = false;
      }
    });

    // expõe "open" para ser chamado pelo botão do menu
    window.__openChangePwd = open;
  }

  // conecta o botão do menu ao modal
  function wireChangePwdButton() {
    ensureChangePwdModal();
    document
      .getElementById("btnChangePassword")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        window.__openChangePwd?.();
      });
  }

  // ===== NAV rendering helpers =====
  function ensureNavRight() {
    if (!nav) return null;
    let nr = nav.querySelector(".nav-right");
    if (!nr) {
      nr = document.createElement("div");
      nr.className = "nav-right";
      nav.appendChild(nr);
    }
    return nr;
  }

  function toggleImportLinkForAdmin(isAdmin) {
    const importLink = nav?.querySelector('a[href="/importar-partida-html"]');
    if (importLink) importLink.style.display = isAdmin ? "" : "none";
  }

  function drawLoggedOutUI() {
    const nr = ensureNavRight();
    if (!nr) return;

    nr.innerHTML = `
      <a id="btnOpenRegister" class="nav-btn" data-color="#a78bfa" href="/cadastrar-html">Cadastrar</a>
      <a id="btnOpenLogin" class="nav-btn" data-color="#56c1ff" href="/login-html">Logar</a>
    `;

    const loginBtn = nr.querySelector("#btnOpenLogin");
    loginBtn?.addEventListener("click", (e) => {
      if (loginModal) {
        e.preventDefault();
        openModal(loginModal, loginEmail);
      }
    });

    toggleImportLinkForAdmin(false);
  }

  function drawLoggedInUI(user) {
    const nr = ensureNavRight();
    if (!nr) return;

    nr.innerHTML = `
      <span class="nav-welcome">Olá, <strong>${
        user?.nome || user?.email || "usuário"
      }</strong></span>

      <span class="gold-badge" title="Seu saldo de gold">
        <img id="goldIcon" class="gold-icon" alt="Gold">
        <span id="goldQty" class="qty">--</span>
      </span>

      <a id="btnChangePassword" class="nav-btn" data-color="#56c1ff" href="javascript:void(0)">Alterar senha</a>
      <a id="btnLogout" class="nav-btn" data-color="#ff9e9e" href="javascript:void(0)">Sair</a>
    `;

    toggleImportLinkForAdmin(!!user?.usuario_admin);

    wireGoldIconFallback(document.getElementById("goldIcon"));
    updateGoldBadge();

    // Wire do modal de alterar senha
    wireChangePwdButton();

    nr.querySelector("#btnLogout")?.addEventListener("click", async () => {
      const rawToken = localStorage.getItem("auth_token");
      const token = normalizeToken(rawToken);
      try {
        if (token) {
          await fetch("/api/logout", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      } finally {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        window.location.href = "/index";
      }
    });
  }

  function refreshAuthUI() {
    if (!nav) return;

    const rawToken = localStorage.getItem("auth_token");
    const token = normalizeToken(rawToken);
    const userStr = localStorage.getItem("auth_user");
    const wrapper = document.getElementById("importarWrap");

    if (!token || !userStr) {
      drawLoggedOutUI();
      wrapper?.remove();
      return;
    }

    let user;
    try {
      user = JSON.parse(userStr);
    } catch {
      localStorage.removeItem("auth_user");
      drawLoggedOutUI();
      return;
    }

    if (user?.usuario_admin && wrapper) wrapper.style.display = "block";
    else wrapper?.remove();

    drawLoggedInUI(user);
  }

  document.addEventListener("DOMContentLoaded", () => refreshAuthUI());

  // ===== submit login =====
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginMsg) {
        loginMsg.textContent = "";
        loginMsg.className = "mw-msg";
      }
      if (btnDoLogin) btnDoLogin.disabled = true;

      const payload = {
        email: loginEmail.value.trim(),
        senha: loginSenha.value,
      };

      try {
        const res = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
          if (loginMsg) {
            loginMsg.textContent =
              data.mensagem || data.message || "Falha no login.";
            loginMsg.className = "mw-msg error";
          }
          if (btnDoLogin) btnDoLogin.disabled = false;
          return;
        }

        const rawToken = data?.resultados?.token;
        const token =
          (rawToken && typeof rawToken === "object"
            ? rawToken.token
            : rawToken) ||
          data?.token?.token ||
          data?.token;
        const usuario = data?.resultados?.usuario || data?.usuario;

        if (token) localStorage.setItem("auth_token", token);
        if (usuario) setStoredUser(usuario);

        if (loginMsg) {
          loginMsg.textContent = "Login realizado!";
          loginMsg.className = "mw-msg ok";
        }

        setTimeout(() => {
          if (loginModal) closeModal(loginModal);
          refreshAuthUI();
          if (location.pathname.endsWith("/login-html"))
            window.location.href = "/index";
        }, 250);
      } catch (err) {
        console.error(err);
        if (loginMsg) {
          loginMsg.textContent = "Erro inesperado ao tentar logar.";
          loginMsg.className = "mw-msg error";
        }
        if (btnDoLogin) btnDoLogin.disabled = false;
      }
    });
  }

  // Render inicial
  refreshAuthUI();
})();
