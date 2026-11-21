import { cleanName, nameIssue, newRound, draw, finishTurn, restoreGame } from "./draw.js";

const byId = id => document.getElementById(id);
const input = byId("person-name");
const startButton = byId("start-round");
const turnButton = byId("turn-button");
const key = "poczta-prezentowa:sesja:v1";
let game;
try {
  game = restoreGame(sessionStorage.getItem(key));
} catch {
  game = restoreGame(null);
}
let revealed = false;

function save() {
  // The current round also works in memory if a browser disables session storage.
  try { sessionStorage.setItem(key, JSON.stringify(game)); } catch { /* storage unavailable */ }
}

function icon(id) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(svg.namespaceURI, "use");
  use.setAttribute("href", "#" + id);
  svg.append(use);
  return svg;
}

function renderNames() {
  const list = byId("names");
  const items = game.names.map((name, index) => {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.setAttribute("aria-label", "Usuń z listy " + name);
    remove.dataset.index = String(index);
    remove.append(icon("i-x"));
    li.append(text, remove);
    return li;
  });
  list.replaceChildren(...items);
  list.hidden = items.length === 0;
  byId("empty-roster").hidden = items.length > 0;
  byId("count").textContent = String(items.length);
  startButton.disabled = items.length < 2;
}

function setError(message = "") {
  byId("name-error").textContent = message;
  byId("name-error").hidden = !message;
  input.setAttribute("aria-invalid", String(Boolean(message)));
}

function addInput() {
  const name = cleanName(input.value);
  const error = nameIssue(game.names, name);
  setError(error);
  if (error) {
    byId("status").textContent = error;
    input.focus();
    return false;
  }
  game.names.push(name);
  input.value = "";
  save();
  renderNames();
  byId("status").textContent = "Dodano " + name + ".";
  return true;
}

function turnView() {
  const round = game.round;
  const giver = game.names[round.turn];
  if (round.recipient !== null && revealed) {
    const last = round.turn === game.names.length - 1;
    return {
      label: "Twój prezent dostanie", title: game.names[round.recipient],
      hint: last ? "Zapamiętaj imię i zakończ losowanie." : "Zapamiętaj imię, a potem ukryj karteczkę.",
      seal: "i-gift", action: last ? "Ukryj i zakończ" : "Ukryj i przekaż telefon", actionIcon: "i-lock"
    };
  }
  if (round.retry) {
    return {
      label: "Losuje " + giver, title: "To Twoje imię!",
      hint: "Twoja karteczka wraca do puli. Sięgnij po następną.",
      seal: "i-redraw", action: "Losuj ponownie", actionIcon: "i-redraw"
    };
  }
  return {
    label: "Teraz losuje", title: giver,
    hint: "Weź telefon i sprawdź swój wynik w tajemnicy.",
    seal: "i-mail", action: round.recipient === null ? "Wylosuj osobę" : "Odkryj mój wynik", actionIcon: "i-mail"
  };
}

function renderTurn() {
  const round = game.round;
  const view = turnView();
  const showing = round.recipient !== null && revealed;
  byId("turn-count").textContent = "Osoba " + (round.turn + 1) + " z " + game.names.length;
  byId("meter-fill").style.width = (100 * (round.turn + 1) / game.names.length) + "%";
  byId("turn-label").textContent = view.label;
  byId("turn-title").textContent = view.title;
  byId("turn-hint").textContent = view.hint;
  byId("action-label").textContent = view.action;
  byId("turn-icon").setAttribute("href", "#" + view.seal);
  byId("action-icon").setAttribute("href", "#" + view.actionIcon);
  byId("turn-seal").classList.toggle("revealed", showing);
  document.querySelector(".slip").classList.toggle("revealed", showing);
}

function render(focus = false) {
  const phase = !game.round ? 0 : game.round.turn < game.names.length ? 1 : 2;
  const panels = ["setup", "turn", "done"];
  panels.forEach((id, index) => { byId(id).hidden = index !== phase; });
  document.querySelectorAll(".steps li").forEach((step, index) => {
    step.classList.toggle("current", index === phase);
    step.classList.toggle("past", index < phase);
    if (index === phase) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
    step.firstElementChild.textContent = index < phase ? "✓" : String(index + 1);
  });
  if (phase === 0) renderNames();
  if (phase === 1) renderTurn();
  else byId("turn-title").textContent = "";
  if (focus) byId(panels[phase] + "-title").focus();
}

function backToList() {
  game.round = null;
  revealed = false;
  setError();
  byId("status").textContent = "";
  save();
  render(true);
}

byId("name-form").addEventListener("submit", event => {
  event.preventDefault();
  if (!game.round && addInput()) input.focus();
});
input.addEventListener("input", () => setError());
byId("names").addEventListener("click", event => {
  const button = event.target.closest("button[data-index]");
  if (!button || game.round) return;
  const index = Number(button.dataset.index);
  const [name] = game.names.splice(index, 1);
  setError();
  save();
  renderNames();
  byId("status").textContent = "Usunięto " + name + ".";
  const buttons = byId("names").querySelectorAll("button");
  (buttons[Math.min(index, buttons.length - 1)] ?? input).focus();
});
startButton.addEventListener("click", () => {
  if (game.round || game.names.length < 2) return;
  if (input.value.trim() && !addInput()) return;
  input.value = "";
  game.round = newRound(game.names);
  byId("status").textContent = "";
  save();
  render(true);
});

turnButton.addEventListener("click", event => {
  const round = game.round;
  if (event.detail > 1 || !round || round.turn >= game.names.length) return;
  if (round.recipient === null) {
    game.round = draw(round);
    revealed = game.round.recipient !== null;
  } else if (!revealed) {
    revealed = true;
  } else {
    game.round = finishTurn(round);
    revealed = false;
  }
  save();
  render(true);
});

function coverResult() {
  if (!revealed) return;
  revealed = false;
  render();
}
document.addEventListener("visibilitychange", () => { if (document.hidden) coverResult(); });
window.addEventListener("pagehide", coverResult);

byId("again").addEventListener("click", backToList);
byId("help-open").addEventListener("click", () => byId("help-dialog").showModal());
byId("restart-open").addEventListener("click", () => byId("restart-dialog").showModal());
byId("confirm-restart").addEventListener("click", () => {
  byId("restart-dialog").close();
  backToList();
});
document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    if (event.target === dialog || event.target.closest("[data-close]")) dialog.close();
  });
});

render();
