import { getSessionToken } from "./session.js";

/** API HTTP disponible (dev con proxy o VITE_API_URL en build). */
export function hasRemoteApi() {
  if (import.meta.env.DEV) return true;
  return Boolean(import.meta.env.VITE_API_URL?.trim());
}

/** Sincronización en la nube requiere OAuth configurado en el build. */
export function hasGoogleAuth() {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());
}

function apiRoot() {
  const env = import.meta.env.VITE_API_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (import.meta.env.DEV) return "";
  return "";
}

function url(path) {
  const root = apiRoot();
  return root ? `${root}${path}` : path;
}

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  const t = getSessionToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

export async function postGoogleAuth(idToken) {
  const r = await fetch(url("/api/auth/google"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchRemoteState() {
  const r = await fetch(url("/api/state"), { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function putRemoteState({ wardrobe, outfits }) {
  const r = await fetch(url("/api/state"), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ wardrobe, outfits }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
