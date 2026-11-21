export function cleanName(value) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function nameIssue(names, name) {
  if (!name) return "Wpisz imię osoby, którą chcesz dodać.";
  if (name.length > 60) return "Skróć imię do 60 znaków.";
  if (names.some(other => other.toLocaleLowerCase("pl") === name.toLocaleLowerCase("pl"))) {
    return "To imię jest już na liście. Dopisz inicjał lub pseudonim.";
  }
  return "";
}

export function newRound(names) {
  if (names.length < 2) throw new RangeError("Do losowania potrzebne są dwie osoby.");
  return { turn: 0, pool: names.map((_, i) => i), recipient: null, retry: false };
}

export function candidates(round) {
  const { turn, pool, retry } = round;
  // With two slips left, taking the other slip could strand the last giver with their own name.
  const lastGiver = turn + 1;
  const mustTakeLastGiver = pool.length === 2 && pool.includes(lastGiver);
  return pool.filter(id => {
    if (id === turn) return !retry;
    return !mustTakeLastGiver || id === lastGiver;
  });
}

function randomIndex(count) {
  const range = 2 ** 32;
  const limit = range - (range % count);
  const sample = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(sample);
  } while (sample[0] >= limit);
  return sample[0] % count;
}

export function draw(round, choose = randomIndex) {
  if (round.recipient !== null || round.pool.length === 0) return round;
  const options = candidates(round);
  const recipient = options[choose(options.length)];
  if (recipient === round.turn) return { ...round, retry: true };
  return { ...round, pool: round.pool.filter(id => id !== recipient), recipient, retry: false };
}

export function finishTurn(round) {
  if (round.recipient === null) return round;
  return { ...round, turn: round.turn + 1, recipient: null, retry: false };
}

export function restoreGame(raw) {
  const empty = { names: [], round: null };
  if (!raw) return empty;
  let game;
  try { game = JSON.parse(raw); } catch { return empty; }
  if (!Array.isArray(game?.names)) return empty;
  const { names, round } = game;
  if (!names.every(name => typeof name === "string" && name === cleanName(name) && name.length > 0 && name.length <= 60)) return empty;
  if (new Set(names.map(name => name.toLocaleLowerCase("pl"))).size !== names.length) return empty;
  const setup = { names, round: null };
  if (!round || names.length < 2) return setup;
  const { turn, pool, recipient, retry } = round;
  const validId = id => Number.isInteger(id) && id >= 0 && id < names.length;
  if (!Number.isInteger(turn) || turn < 0 || turn > names.length || typeof retry !== "boolean") return setup;
  if (!Array.isArray(pool) || !pool.every(validId) || new Set(pool).size !== pool.length) return setup;
  const assigned = recipient !== null;
  if (assigned && (!validId(recipient) || recipient === turn || pool.includes(recipient) || retry)) return setup;
  if (retry && !pool.includes(turn)) return setup;
  const nextGiver = turn + Number(assigned);
  if (pool.length !== names.length - nextGiver || (pool.length === 1 && pool[0] === nextGiver)) return setup;
  return { names, round: { turn, pool, recipient, retry } };
}
