import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Database from "@ioc:Adonis/Lucid/Database";
import Env from "@ioc:Adonis/Core/Env";
import { schema } from "@ioc:Adonis/Core/Validator";
import axios from "axios";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { DateTime } from "luxon";
import Jogadores from "App/Models/Jogadores";
import UsuarioAdm from "App/Models/UsuarioAdm";
import { setAuthCookie } from "App/Utils/AuthCookie";
import CustomResponse from "App/Utils/CustomResponse";

type SteamStatePayload = {
  ts: number;
  redirect: string;
  gc_profile_url?: string;
  gc_id?: number;
  link_user_id?: number;
};

type GcIdentity = {
  gcId: number;
  gcNick: string | null;
  gcProfileUrl: string;
  steamUrl: string | null;
  steamId: string | null;
};

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const STEAM_OPENID_NS = "http://specs.openid.net/auth/2.0";

export default class SteamAuthController {
  private customResponse = new CustomResponse();

  private allowedOrigins() {
    const values = new Set<string>();
    const appUrl = String(Env.get("APP_URL") || "").trim();
    const frontendUrl = String(Env.get("FRONTEND_URL") || "").trim();
    const extra = String(Env.get("FRONTEND_ORIGINS") || "").trim();

    const pushOrigin = (raw: string) => {
      if (!raw) return;
      try {
        const parsed = new URL(raw);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          values.add(`${parsed.protocol}//${parsed.host}`);
        }
      } catch {}
    };

    pushOrigin(appUrl);
    pushOrigin(frontendUrl);
    extra
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach(pushOrigin);

    const isProduction =
      String(Env.get("NODE_ENV") || "")
        .trim()
        .toLowerCase() === "production";

    if (!isProduction) {
      values.add("http://localhost:5173");
      values.add("http://127.0.0.1:5173");
      values.add("http://localhost:3000");
      values.add("http://127.0.0.1:3000");
    }

    return values;
  }

  private isAllowedOrigin(origin: string) {
    return this.allowedOrigins().has(origin);
  }

  private normalizeName(raw: string) {
    return String(raw || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  private normalizeNameLower(raw: string) {
    return this.normalizeName(raw).toLowerCase();
  }

  private getStateSecret() {
    return `${String(Env.get("APP_KEY") || "app-key")}:steam:v1`;
  }

  private base64UrlEncode(raw: string) {
    return Buffer.from(raw, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  private base64UrlDecode(raw: string) {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4;
    const padded = normalized + (pad ? "=".repeat(4 - pad) : "");
    return Buffer.from(padded, "base64").toString("utf8");
  }

  private encodeState(payload: SteamStatePayload) {
    const encoded = this.base64UrlEncode(JSON.stringify(payload));
    const signature = createHmac("sha256", this.getStateSecret())
      .update(encoded)
      .digest("hex");
    return `${encoded}.${signature}`;
  }

  private decodeState(rawState: string | null | undefined) {
    if (!rawState || typeof rawState !== "string") return null;
    const parts = rawState.split(".");
    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;
    const expected = createHmac("sha256", this.getStateSecret())
      .update(encoded)
      .digest("hex");

    const signatureBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (
      signatureBuf.length !== expectedBuf.length ||
      !timingSafeEqual(signatureBuf, expectedBuf)
    ) {
      return null;
    }

    try {
      return JSON.parse(this.base64UrlDecode(encoded)) as SteamStatePayload;
    } catch {
      return null;
    }
  }

  private getBaseOrigin(request: HttpContextContract["request"]) {
    const originHeader = String(request.header("origin") || "").trim();
    const parsedOrigin = this.parseAllowedOrigin(originHeader);
    if (parsedOrigin) return parsedOrigin;

    const host = request.header("x-forwarded-host") || request.host();
    const proto =
      request.header("x-forwarded-proto") || request.protocol() || "https";
    return `${proto}://${host}`;
  }

  private parseAllowedOrigin(raw: string) {
    const value = String(raw || "").trim();
    if (!value) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      const normalized = `${url.protocol}//${url.host}`;
      return this.isAllowedOrigin(normalized) ? normalized : null;
    } catch {
      return null;
    }
  }

  private sanitizeRedirect(value: string) {
    const fallback = "/index";
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    if (raw.startsWith("/")) {
      // Bloqueia URLs protocol-relative (//host) e variantes com backslash.
      if (/^\/[\\/]/.test(raw)) return fallback;
      return raw;
    }

    try {
      const parsed = new URL(raw);
      if (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        this.isAllowedOrigin(`${parsed.protocol}//${parsed.host}`)
      ) {
        return `${parsed.pathname || "/"}${parsed.search || ""}${parsed.hash || ""}`;
      }
    } catch {}

    return fallback;
  }

  private sanitizeGcProfileInput(params: {
    gcProfileUrl?: string;
    gcId?: number | null;
  }) {
    const gcId = Number(params.gcId || 0);
    if (gcId > 0) {
      return `https://gamersclub.com.br/player/${gcId}`;
    }

    const raw = String(params.gcProfileUrl || "").trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
      return `https://gamersclub.com.br/player/${Number(raw)}`;
    }

    const parsed = new URL(raw);
    if (!/gamersclub\.com\.br$/i.test(parsed.hostname)) {
      throw new Error("URL da Gamers Club inválida.");
    }

    const byId = parsed.pathname.match(/\/player\/(\d+)/i);
    if (byId?.[1]) {
      return `https://gamersclub.com.br/player/${Number(byId[1])}`;
    }

    return raw;
  }

  private async resolveSteamIdFromSteamUrl(url: string) {
    const profiles = url.match(/steamcommunity\.com\/profiles\/(\d+)/i);
    if (profiles?.[1]) return profiles[1];

    const vanity = url.match(/steamcommunity\.com\/id\/([a-zA-Z0-9_-]+)/i);
    if (!vanity?.[1]) return null;

    try {
      const xmlUrl = `https://steamcommunity.com/id/${vanity[1]}?xml=1`;
      const res = await axios.get(xmlUrl, {
        timeout: 12000,
        headers: {
          "User-Agent": "Mozilla/5.0 (MixAwards Steam Link Bot)",
          Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
        },
      });
      const xml = String(res.data || "");
      const steamId = xml.match(/<steamID64>(\d+)<\/steamID64>/i)?.[1] || null;
      return steamId;
    } catch {
      return null;
    }
  }

  private async resolveGcIdentity(params: {
    gcProfileUrl?: string;
    gcId?: number | null;
  }): Promise<GcIdentity> {
    const profileUrl = this.sanitizeGcProfileInput(params);
    if (!profileUrl) {
      throw new Error("Informe o perfil da GC para vincular a conta.");
    }

    const res = await axios.get(profileUrl, {
      timeout: 12000,
      headers: {
        "User-Agent": "Mozilla/5.0 (MixAwards GC Resolver Bot)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const html = String(res.data || "");
    const gcFromLabel =
      html.match(/(?:CS\s*)?GCID:\s*(\d+)/i)?.[1] ||
      html.match(/GCID:\s*(\d+)/i)?.[1] ||
      null;
    const gcFromUrl = profileUrl.match(/\/player\/(\d+)/i)?.[1] || null;
    const gcId = Number(gcFromLabel || gcFromUrl || 0);

    if (!gcId || gcId <= 0) {
      throw new Error("Não foi possível identificar o GCID no perfil informado.");
    }

    const nick =
      html.match(/<title>\s*Gamers Club\s*-\s*(.*?)\s*-\s*Player\s*<\/title>/i)?.[1] ||
      null;

    const steamUrl =
      html.match(
        /https?:\/\/steamcommunity\.com\/(?:profiles\/\d+|id\/[a-zA-Z0-9_-]+)/i
      )?.[0] || null;
    const steamId = steamUrl
      ? await this.resolveSteamIdFromSteamUrl(steamUrl)
      : null;

    return {
      gcId,
      gcNick: nick ? String(nick).trim() : null,
      gcProfileUrl: `https://gamersclub.com.br/player/${gcId}`,
      steamUrl,
      steamId,
    };
  }

  private async fetchSteamProfile(steamId: string) {
    try {
      const url = `https://steamcommunity.com/profiles/${steamId}?xml=1`;
      const res = await axios.get(url, {
        timeout: 12000,
        headers: {
          "User-Agent": "Mozilla/5.0 (MixAwards Steam Profile Bot)",
          Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
        },
      });
      const xml = String(res.data || "");
      const persona =
        xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/i)?.[1] ||
        xml.match(/<steamID>(.*?)<\/steamID>/i)?.[1] ||
        null;
      const avatar =
        xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/i)?.[1] ||
        xml.match(/<avatarFull>(.*?)<\/avatarFull>/i)?.[1] ||
        null;
      return {
        persona: persona ? String(persona).trim() : null,
        avatar: avatar ? String(avatar).trim() : null,
      };
    } catch {
      return { persona: null, avatar: null };
    }
  }

  private async verifySteamOpenId(payload: Record<string, any>) {
    const params = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      params.set(key, String(value));
    });
    params.set("openid.mode", "check_authentication");

    const res = await axios.post(STEAM_OPENID_ENDPOINT, params.toString(), {
      timeout: 12000,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (MixAwards Steam Verify Bot)",
      },
    });

    const body = String(res.data || "");
    return /is_valid\s*:\s*true/i.test(body);
  }

  private getSteamIdFromClaimedId(claimedId: string | null | undefined) {
    if (!claimedId) return null;
    return claimedId.match(/\/id\/(\d+)$/i)?.[1] || null;
  }

  private buildSteamLoginUrl(params: { returnTo: string; realm: string }) {
    const q = new URLSearchParams();
    q.set("openid.ns", STEAM_OPENID_NS);
    q.set("openid.mode", "checkid_setup");
    q.set("openid.return_to", params.returnTo);
    q.set("openid.realm", params.realm);
    q.set("openid.identity", `${STEAM_OPENID_NS}/identifier_select`);
    q.set("openid.claimed_id", `${STEAM_OPENID_NS}/identifier_select`);
    return `${STEAM_OPENID_ENDPOINT}?${q.toString()}`;
  }

  private buildSteamSuccessHtml(args: {
    user: any;
    redirect: string;
    warning?: string | null;
  }) {
    const safeRedirect = JSON.stringify(args.redirect || "/index");
    const safeUser = JSON.stringify(args.user || {});
    const safeWarning = JSON.stringify(args.warning || "");

    return `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Login Steam - Mix Awards</title>
  </head>
  <body style="font-family: Arial, sans-serif; background:#0f172a; color:#e2e8f0; display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0;">
    <div style="max-width:560px; width:100%; margin:16px; border:1px solid rgba(148,163,184,.35); border-radius:14px; padding:20px; background:rgba(15,23,42,.95);">
      <h1 style="margin:0 0 8px; font-size:20px;">Autenticando via Steam...</h1>
      <p id="status" style="margin:0; opacity:.88;">Finalizando seu login.</p>
    </div>
    <script>
      (function () {
        var user = ${safeUser};
        var redirectTo = ${safeRedirect};
        var warning = ${safeWarning};
        try {
          localStorage.setItem("auth_token", "__cookie_session__");
          if (user) localStorage.setItem("auth_user", JSON.stringify(user));
          if (warning) localStorage.setItem("steam_login_warning", warning);
          if (window.opener && window.opener !== window) {
            window.opener.postMessage(
              { type: "steam-auth-success", user: user, warning: warning },
              window.location.origin
            );
            window.close();
            return;
          }
        } catch (e) {}
        window.location.href = redirectTo || "/index";
      })();
    </script>
  </body>
</html>`;
  }

  private async findOrCreateBySteam(params: {
    steamId: string;
    steamPersona?: string | null;
    steamAvatar?: string | null;
    gcIdentity?: GcIdentity | null;
    forcedUserId?: number | null;
  }) {
    const steamId = String(params.steamId || "").trim();
    const steamEmail = `steam_${steamId}@steam.local`;
    const forcedUserId = Number(params.forcedUserId || 0);
    const gcIdentity = params.gcIdentity || null;

    let user =
      (forcedUserId > 0
        ? await UsuarioAdm.query().where("id", forcedUserId).first()
        : null) ||
      (gcIdentity?.gcId
        ? await UsuarioAdm.query().where("gc_id", gcIdentity.gcId).first()
        : null) ||
      (await UsuarioAdm.query().where("steam_id", steamId).first()) ||
      (await UsuarioAdm.query().where("email", steamEmail).first()) ||
      (gcIdentity?.gcId
        ? await Jogadores.query()
            .where("gc_id", gcIdentity.gcId)
            .whereNotNull("usuario_adm_id")
            .first()
            .then((j) =>
              j?.usuario_adm_id
                ? UsuarioAdm.query().where("id", Number(j.usuario_adm_id)).first()
                : null
            )
        : null) ||
      (await Jogadores.query()
        .where("steam_id", steamId)
        .whereNotNull("usuario_adm_id")
        .first()
        .then((j) =>
          j?.usuario_adm_id
            ? UsuarioAdm.query().where("id", Number(j.usuario_adm_id)).first()
            : null
        ));

    const steamOwner = await UsuarioAdm.query().where("steam_id", steamId).first();
    if (user && steamOwner && Number(steamOwner.id) !== Number(user.id)) {
      const selectedIsAdmin = Boolean((user as any)?.usuario_admin);
      const ownerIsAdmin = Boolean((steamOwner as any)?.usuario_admin);
      const selectedIsForced = forcedUserId > 0 && Number(user.id) === forcedUserId;

      if (selectedIsAdmin && !ownerIsAdmin) {
        steamOwner.merge({
          steam_id: null,
          steam_profile_url: null,
          steam_persona: null,
          steam_avatar: null,
        } as any);
        await steamOwner.save();
      } else if (ownerIsAdmin && !selectedIsAdmin) {
        user = steamOwner;
      } else if (selectedIsForced) {
        steamOwner.merge({
          steam_id: null,
          steam_profile_url: null,
          steam_persona: null,
          steam_avatar: null,
        } as any);
        await steamOwner.save();
      } else {
        user = steamOwner;
      }
    }

    if (!user) {
      const fallbackName = params.steamPersona || `STEAM_${steamId.slice(-6)}`;
      user = await UsuarioAdm.create({
        nome: fallbackName,
        email: steamEmail,
        password: randomBytes(24).toString("hex"),
        nome_normalizado: this.normalizeName(fallbackName),
        alterar_senha: 0,
        usuario_admin: false,
        steam_id: steamId,
        steam_profile_url: `https://steamcommunity.com/profiles/${steamId}`,
        steam_persona: params.steamPersona || null,
        steam_avatar: params.steamAvatar || null,
      } as any);
      return user;
    }

    user.merge({
      steam_id: steamId,
      steam_profile_url: `https://steamcommunity.com/profiles/${steamId}`,
      steam_persona: params.steamPersona || user.steam_persona || null,
      steam_avatar: params.steamAvatar || user.steam_avatar || null,
    });
    if (gcIdentity) {
      user.merge({
        gc_id: gcIdentity.gcId,
        gc_profile_url: gcIdentity.gcProfileUrl,
        gc_nick: gcIdentity.gcNick || user.gc_nick || null,
        gc_nick_normalizado: this.normalizeNameLower(gcIdentity.gcNick || ""),
        gc_verified_at: DateTime.now(),
      } as any);
    }
    await user.save();
    return user;
  }

  private async linkUserAndPlayerIdentities(params: {
    user: UsuarioAdm;
    steamId: string;
    gcIdentity?: GcIdentity | null;
  }) {
    const gcIdentity = params.gcIdentity || null;
    const steamId = String(params.steamId || "").trim();

    const trx = await Database.transaction();
    try {
      const user = await UsuarioAdm.query({ client: trx })
        .where("id", params.user.id)
        .firstOrFail();

      user.steam_id = steamId || user.steam_id || null;
      user.steam_profile_url = `https://steamcommunity.com/profiles/${steamId}`;

      if (gcIdentity) {
        user.gc_id = gcIdentity.gcId;
        user.gc_profile_url = gcIdentity.gcProfileUrl;
        user.gc_nick = gcIdentity.gcNick || user.gc_nick || null;
        user.gc_nick_normalizado = this.normalizeNameLower(gcIdentity.gcNick || "");
        user.gc_verified_at = DateTime.now();
      }
      await user.save();

      let jogador =
        (gcIdentity
          ? await Jogadores.query({ client: trx })
              .where("gc_id", gcIdentity.gcId)
              .first()
          : null) ||
        (steamId
          ? await Jogadores.query({ client: trx })
              .where("steam_id", steamId)
              .first()
          : null) ||
        (await Jogadores.query({ client: trx })
          .where("usuario_adm_id", user.id)
          .first());

      const nickNorm = this.normalizeNameLower(gcIdentity?.gcNick || "");

      if (!jogador && nickNorm) {
        const candidates = await Jogadores.query({ client: trx })
          .where("gc_nick_normalizado", nickNorm)
          .limit(2);
        if (candidates.length === 1) {
          jogador = candidates[0];
        }
      }

      if (jogador) {
        if (!jogador.usuario_adm_id || Number(jogador.usuario_adm_id) === Number(user.id)) {
          jogador.usuario_adm_id = user.id;
          if (gcIdentity?.gcId && !jogador.gc_id) jogador.gc_id = gcIdentity.gcId;
          if (steamId && !jogador.steam_id) jogador.steam_id = steamId;
          if (gcIdentity?.gcNick) jogador.gc_nick = gcIdentity.gcNick;
          if (nickNorm && gcIdentity?.gcNick) {
            jogador.gc_nick_normalizado = nickNorm;
          } else if (nickNorm && !jogador.gc_nick_normalizado) {
            jogador.gc_nick_normalizado = nickNorm;
          }
          await jogador.save();
        }
      }

      await trx.commit();
      return user;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  public async steamLogin({ request, response }: HttpContextContract) {
    try {
      const qs = request.qs();
      const redirect = this.sanitizeRedirect(String(qs?.redirect || "/index"));
      const gcProfileUrl = String(qs?.gc_profile_url || "").trim();
      const gcIdInput = Number(qs?.gc_id || 0);
      const gc_id = Number.isFinite(gcIdInput) && gcIdInput > 0 ? gcIdInput : undefined;

      const originHint = this.parseAllowedOrigin(String(qs?.origin || ""));
      const baseOrigin = originHint || this.getBaseOrigin(request);
      const callbackFromEnv = String(Env.get("STEAM_OPENID_CALLBACK") || "").trim();
      const realmFromEnv = String(Env.get("STEAM_OPENID_REALM") || "").trim();
      const isLocalBase = /\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(
        baseOrigin
      );
      const preferDynamicOrigin = Boolean(originHint) || isLocalBase;

      const callbackUrl = preferDynamicOrigin
        ? `${baseOrigin}/auth/steam/callback`
        : callbackFromEnv || `${baseOrigin}/auth/steam/callback`;
      const realm = preferDynamicOrigin ? baseOrigin : realmFromEnv || baseOrigin;

      const statePayload: SteamStatePayload = {
        ts: Date.now(),
        redirect,
      };
      if (gcProfileUrl) statePayload.gc_profile_url = gcProfileUrl;
      if (gc_id) statePayload.gc_id = gc_id;

      const state = this.encodeState(statePayload);
      const returnTo = new URL(callbackUrl);
      returnTo.searchParams.set("state", state);

      const steamLoginUrl = this.buildSteamLoginUrl({
        returnTo: returnTo.toString(),
        realm,
      });

      response.status(302);
      response.header("Location", steamLoginUrl);
      return response.send("");
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao iniciar login com Steam.",
        error,
        500
      );
    }
  }

  public async steamLoginAuthUrl({
    auth,
    request,
    response,
  }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const qs = request.qs();
      const redirect = this.sanitizeRedirect(String(qs?.redirect || "/index"));
      const gcProfileUrl = String(qs?.gc_profile_url || "").trim();
      const gcIdInput = Number(qs?.gc_id || 0);
      const gc_id = Number.isFinite(gcIdInput) && gcIdInput > 0 ? gcIdInput : undefined;

      const originHint = this.parseAllowedOrigin(String(qs?.origin || ""));
      const baseOrigin = originHint || this.getBaseOrigin(request);
      const callbackFromEnv = String(Env.get("STEAM_OPENID_CALLBACK") || "").trim();
      const realmFromEnv = String(Env.get("STEAM_OPENID_REALM") || "").trim();
      const isLocalBase = /\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(
        baseOrigin
      );
      const preferDynamicOrigin = Boolean(originHint) || isLocalBase;
      const callbackUrl = preferDynamicOrigin
        ? `${baseOrigin}/auth/steam/callback`
        : callbackFromEnv || `${baseOrigin}/auth/steam/callback`;
      const realm = preferDynamicOrigin ? baseOrigin : realmFromEnv || baseOrigin;

      const statePayload: SteamStatePayload = {
        ts: Date.now(),
        redirect,
        link_user_id: Number(user.id),
      };
      if (gcProfileUrl) statePayload.gc_profile_url = gcProfileUrl;
      if (gc_id) statePayload.gc_id = gc_id;

      const state = this.encodeState(statePayload);
      const returnTo = new URL(callbackUrl);
      returnTo.searchParams.set("state", state);

      const steamLoginUrl = this.buildSteamLoginUrl({
        returnTo: returnTo.toString(),
        realm,
      });

      return this.customResponse.sucesso(
        response,
        "URL de login Steam gerada com sucesso.",
        { url: steamLoginUrl }
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao preparar login Steam autenticado.",
        error,
        500
      );
    }
  }

  public async steamCallback({ request, response, auth }: HttpContextContract) {
    try {
      const queryPayload = request.qs() as Record<string, any>;
      const state = this.decodeState(String(queryPayload?.state || ""));
      if (!state) {
        return this.customResponse.erro(response, "Estado de login inválido.", {}, 400);
      }

      const ttlSecsRaw = Number(Env.get("STEAM_STATE_TTL_SECONDS") || 900);
      const ttlSecs = Number.isFinite(ttlSecsRaw) && ttlSecsRaw > 30 ? ttlSecsRaw : 900;
      if (Date.now() - Number(state.ts || 0) > ttlSecs * 1000) {
        return this.customResponse.erro(
          response,
          "Sessão de login Steam expirada. Tente novamente.",
          {},
          400
        );
      }

      const isValid = await this.verifySteamOpenId(queryPayload);
      if (!isValid) {
        return this.customResponse.erro(
          response,
          "Falha na verificação do login da Steam.",
          {},
          401
        );
      }

      const claimedId = String(
        queryPayload?.["openid.claimed_id"] ||
          queryPayload?.openid?.claimed_id ||
          ""
      );
      const steamId = this.getSteamIdFromClaimedId(claimedId);
      if (!steamId) {
        return this.customResponse.erro(
          response,
          "Não foi possível extrair o SteamID do retorno.",
          {},
          400
        );
      }

      const steamProfile = await this.fetchSteamProfile(steamId);
      let gcIdentity: GcIdentity | null = null;
      let warning: string | null = null;

      if (state.gc_profile_url || state.gc_id) {
        try {
          gcIdentity = await this.resolveGcIdentity({
            gcProfileUrl: state.gc_profile_url,
            gcId: state.gc_id,
          });

          if (gcIdentity.steamId && gcIdentity.steamId !== steamId) {
            return this.customResponse.erro(
              response,
              "O perfil GC informado pertence a outro SteamID.",
              {
                steam_id_login: steamId,
                steam_id_gc: gcIdentity.steamId,
                gc_id: gcIdentity.gcId,
              },
              409
            );
          }

          if (!gcIdentity.steamId) {
            warning =
              "GCID identificado, porém sem Steam público no perfil da GC para verificação forte.";
          }
        } catch (err: any) {
          warning =
            err?.message ||
            "Não foi possível validar o perfil da GC durante o login Steam.";
        }
      }

      const user = await this.findOrCreateBySteam({
        steamId,
        steamPersona: steamProfile.persona,
        steamAvatar: steamProfile.avatar,
        gcIdentity,
        forcedUserId: Number(state?.link_user_id || 0) || null,
      });

      const linkedUser = await this.linkUserAndPlayerIdentities({
        user,
        steamId,
        gcIdentity,
      });

      const token = await auth.use("api").generate(linkedUser, {
        expiresIn: "10 days",
      });
      const tokenJson = typeof (token as any).toJSON === "function" ? (token as any).toJSON() : (token as any);
      const tokenValue = String(tokenJson?.token || (token as any)?.token || "");
      if (tokenValue) {
        setAuthCookie(response, tokenValue);
      }

      const rawUser = linkedUser.toJSON() as any;
      const userPayload = {
        ...rawUser,
        jogador_id:
          Number(rawUser?.jogador_id || 0) > 0
            ? Number(rawUser.jogador_id)
            : undefined,
      };

      const redirect = this.sanitizeRedirect(state.redirect || "/index");
      const html = this.buildSteamSuccessHtml({
        user: userPayload,
        redirect,
        warning,
      });
      response.type("text/html; charset=utf-8");
      return response.send(html);
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao concluir login com Steam.",
        error,
        500
      );
    }
  }

  public async steamStatus({ auth, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const usuario = await UsuarioAdm.findOrFail(user.id);

      return this.customResponse.sucesso(response, "Status de integração Steam.", {
        steam_id: usuario.steam_id || null,
        steam_profile_url: usuario.steam_profile_url || null,
        steam_persona: usuario.steam_persona || null,
        steam_avatar: usuario.steam_avatar || null,
        gc_id: usuario.gc_id || null,
        gc_profile_url: usuario.gc_profile_url || null,
        gc_nick: usuario.gc_nick || null,
        gc_verified_at: usuario.gc_verified_at || null,
      });
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao consultar status da integração Steam.",
        error,
        500
      );
    }
  }

  public async vincularGc({ auth, request, response }: HttpContextContract) {
    try {
      const userAuth = await auth.authenticate();
      const payload = await request.validate({
        schema: schema.create({
          gc_profile_url: schema.string.optional({ trim: true }),
          gc_id: schema.number.optional(),
        }),
      });

      const usuario = await UsuarioAdm.findOrFail(userAuth.id);
      const steamId = String(usuario.steam_id || "").trim();
      if (!steamId) {
        return this.customResponse.erro(
          response,
          "Faça login com Steam antes de vincular sua conta GC.",
          {},
          400
        );
      }

      const identity = await this.resolveGcIdentity({
        gcProfileUrl: payload.gc_profile_url,
        gcId: payload.gc_id || null,
      });

      if (identity.steamId && identity.steamId !== steamId) {
        return this.customResponse.erro(
          response,
          "Este perfil GC está vinculado a outro SteamID.",
          {
            steam_id_login: steamId,
            steam_id_gc: identity.steamId,
            gc_id: identity.gcId,
          },
          409
        );
      }

      const updated = await this.linkUserAndPlayerIdentities({
        user: usuario,
        steamId,
        gcIdentity: identity,
      });

      return this.customResponse.sucesso(
        response,
        "Conta da Gamers Club vinculada com sucesso.",
        {
          usuario_id: updated.id,
          steam_id: updated.steam_id,
          gc_id: updated.gc_id,
          gc_profile_url: updated.gc_profile_url,
          gc_nick: updated.gc_nick,
          gc_verified_at: updated.gc_verified_at,
          verificacao_steam: identity.steamId
            ? "validada_por_steam_id"
            : "steam_nao_exposto_no_perfil_gc",
        }
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao vincular conta GC na integração Steam.",
        error,
        500
      );
    }
  }
}
