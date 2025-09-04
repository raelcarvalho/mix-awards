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
  const GOLD_ENDPOINTS = ["/jogadores/gold", "/jogadores/meuGold"];

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

  // Função para normalizar token
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

    for (const url of GOLD_ENDPOINTS) {
      try {
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (r.status === 401) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          return null;
        }

        if (!r.ok) continue;

        const data = await r.json();
        const gold = data?.resultados?.gold ?? data?.gold;
        if (Number.isFinite(+gold)) return +gold;
      } catch {
        // Tenta o próximo endpoint
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
        if (idx < GOLD_ICON_CANDIDATES.length) {
          imgEl.src = GOLD_ICON_CANDIDATES[idx];
        } else {
          imgEl.replaceWith(svgCoin());
        }
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

      <a id="btnChangePassword" class="nav-btn" data-color="#56c1ff" href="/alterar-senha">Alterar senha</a>
      <a id="btnLogout" class="nav-btn" data-color="#ff9e9e" href="javascript:void(0)">Sair</a>
    `;

    toggleImportLinkForAdmin(!!user?.usuario_admin);

    wireGoldIconFallback(document.getElementById("goldIcon"));
    updateGoldBadge();

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
          if (location.pathname.endsWith("/login-html")) {
            window.location.href = "/index";
          }
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
