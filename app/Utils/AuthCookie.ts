import Env from "@ioc:Adonis/Core/Env";

export const AUTH_COOKIE_NAME = String(
  Env.get("AUTH_COOKIE_NAME") || "mix_access_token"
).trim();

const parseBoolean = (value: unknown, fallback = false) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
};

const secureByEnv = String(Env.get("NODE_ENV") || "")
  .trim()
  .toLowerCase() === "production";

const COOKIE_MAX_AGE = String(Env.get("AUTH_COOKIE_MAX_AGE") || "10d");

export const authCookieOptions = {
  path: "/",
  maxAge: COOKIE_MAX_AGE,
  httpOnly: true,
  secure: parseBoolean(Env.get("AUTH_COOKIE_SECURE"), secureByEnv),
  sameSite: String(Env.get("AUTH_COOKIE_SAMESITE") || "lax")
    .trim()
    .toLowerCase() as "lax" | "strict" | "none",
};

export function setAuthCookie(response: any, token: string) {
  const value = String(token || "");
  // Usa cookie assinado para evitar adulteração manual do valor no cliente.
  response.cookie(AUTH_COOKIE_NAME, value, authCookieOptions);
}

export function clearAuthCookie(response: any) {
  response.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
}
