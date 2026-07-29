import { env } from "cloudflare:workers";

export const ADMIN_COOKIE_NAME = "hd_admin_session";
export const ADMIN_REVEAL_COOKIE_NAME = "hd_admin_reveal";

const SESSION_SECONDS = 60 * 60 * 24 * 7;
const REVEAL_SECONDS = 60 * 10;
const encoder = new TextEncoder();

type AdminEnv = {
  ADMIN_PASSWORD?: string;
  ADMIN_REVEAL_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
};

function adminEnv(): AdminEnv {
  return env as unknown as AdminEnv;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function sign(value: string): Promise<string> {
  const secret = adminEnv().ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Admin session secret is not configured.");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

export async function verifyAdminPassword(password: unknown): Promise<boolean> {
  return verifyPassword(password, adminEnv().ADMIN_PASSWORD);
}

export async function verifyRevealPassword(password: unknown): Promise<boolean> {
  return verifyPassword(password, adminEnv().ADMIN_REVEAL_PASSWORD);
}

async function verifyPassword(
  password: unknown,
  expected: string | undefined,
): Promise<boolean> {
  if (!expected || typeof password !== "string") return false;
  const [left, right] = await Promise.all([digest(password), digest(expected)]);
  return equalBytes(left, right);
}

export async function createAdminSession(): Promise<string> {
  return createSession("admin", SESSION_SECONDS);
}

export async function createRevealSession(): Promise<string> {
  return createSession("reveal", REVEAL_SECONDS);
}

async function createSession(
  purpose: "admin" | "reveal",
  lifetime: number,
): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + lifetime;
  const payload = `${purpose}:${expires}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyAdminSession(
  token: string | undefined,
): Promise<boolean> {
  return verifySession(token, "admin");
}

export async function verifyRevealSession(
  token: string | undefined,
): Promise<boolean> {
  return verifySession(token, "reveal");
}

async function verifySession(
  token: string | undefined,
  purpose: "admin" | "reveal",
): Promise<boolean> {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const [tokenPurpose, rawExpires] = payload.split(":");
  const expires = Number(rawExpires);
  if (tokenPurpose !== purpose) return false;
  if (!Number.isFinite(expires) || expires <= Date.now() / 1000) return false;

  try {
    const expected = await sign(payload);
    return equalBytes(encoder.encode(signature), encoder.encode(expected));
  } catch {
    return false;
  }
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  const token = readCookie(request.headers.get("cookie"), ADMIN_COOKIE_NAME);
  return verifyAdminSession(token);
}

export async function isRevealRequest(request: Request): Promise<boolean> {
  const token = readCookie(
    request.headers.get("cookie"),
    ADMIN_REVEAL_COOKIE_NAME,
  );
  return verifyRevealSession(token);
}

export function adminSessionCookie(
  token: string,
  request: Request,
): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function revealSessionCookie(
  token: string,
  request: Request,
): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${ADMIN_REVEAL_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${REVEAL_SECONDS}${secure}`;
}

export function expiredAdminSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function expiredRevealSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${ADMIN_REVEAL_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
