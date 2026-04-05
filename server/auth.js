import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

export async function verifyGoogleIdToken(idToken, clientId) {
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

export function signSessionToken(payload, secret) {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifySessionToken(token, secret) {
  return jwt.verify(token, secret);
}