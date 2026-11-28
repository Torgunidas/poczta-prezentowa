import { cleanName, draw, finishTurn, nameIssue, newRound, restoreGame } from "./draw.js";

export const invitationPrefix = "#losowanie=";
const invitationPattern = /^#losowanie=1\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{28,1024})$/;

function encode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode(value) {
  const bytes = Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
  if (encode(bytes) !== value) throw new Error("Invalid base64url");
  return bytes;
}

async function createInvitation(giver, recipient) {
  const secret = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", secret, "AES-GCM", false, ["encrypt"]);
  const message = new TextEncoder().encode(JSON.stringify([giver, recipient]));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, message);
  return `${invitationPrefix}1.${encode(secret)}.${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}

export async function openInvitation(fragment) {
  const match = invitationPattern.exec(fragment);
  if (!match) return null;
  try {
    const [, secret, iv, encrypted] = match;
    const key = await crypto.subtle.importKey("raw", decode(secret), "AES-GCM", false, ["decrypt"]);
    const message = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv) }, key, decode(encrypted));
    const names = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(message));
    if (!Array.isArray(names) || names.length !== 2 ||
        !names.every(name => typeof name === "string" && name === cleanName(name))) return null;
    const [giver, recipient] = names;
    if (nameIssue([], giver) || nameIssue([giver], recipient)) return null;
    return { giver, recipient };
  } catch {
    return null;
  }
}

export function drawOrder(names, absent) {
  const remote = new Set(absent);
  return [...absent, ...names.filter(name => !remote.has(name))];
}

export async function prepareRound(names, absent) {
  const participants = drawOrder(names, absent);
  let round = newRound(participants);
  const invitations = [];
  for (const giver of absent) {
    let result = draw(round);
    if (result.retry) result = draw(result);
    invitations.push(await createInvitation(giver, participants[result.recipient]));
    round = finishTurn(result);
  }
  return { round, invitations };
}

export function restoreSession(raw) {
  const { names, round } = restoreGame(raw);
  let stored;
  try { stored = JSON.parse(raw); } catch { stored = null; }
  const selected = Array.isArray(stored?.absent) ? stored.absent : [];
  const absent = names.filter(name => selected.includes(name));
  const setup = { names, absent, round: null, invitations: [], linksPending: false };
  if (!round) return setup;

  const invitations = stored?.invitations ?? [];
  if (!Array.isArray(invitations) ||
      invitations.length !== absent.length ||
      !invitations.every(link => typeof link === "string" && invitationPattern.test(link)) ||
      absent.some((name, index) => name !== selected[index]) ||
      round.turn < absent.length) return setup;

  return { ...setup, round, invitations, linksPending: invitations.length > 0 && stored.linksPending === true };
}
