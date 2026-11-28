import { cleanName, nameIssue, draw, finishTurn } from "./draw.js";
import {
  drawOrder, invitationPrefix, openInvitation, openOrganizerSession,
  organizerPrefix, prepareRound, restoreSession
} from "./invitations.js";

const byId = id => document.getElementById(id);
const input = byId("person-name");
const startButton = byId("start-round");
const turnButton = byId("turn-button");
const key = "poczta-prezentowa:sesja:v1";
const fragment = window.location.hash;
const guestMode = fragment.startsWith(invitationPrefix);
const organizerMode = fragment.startsWith(organizerPrefix);
let game;
try {
  game = restoreSession(guestMode || organizerMode ? null : sessionStorage.getItem(key));
} catch {
  game = restoreSession(null);
}
let revealed = false;
let preparing = false;

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
  const absent = new Set(game.absent);
  const items = game.names.map((name, index) => {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = name;
    const option = document.createElement("label");
    option.className = "absence-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = absent.has(name);
    checkbox.disabled = preparing;
    checkbox.dataset.index = String(index);
    checkbox.setAttribute("aria-label", "Nieobecny: " + name);
    option.append(checkbox, "Nieobecny");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.disabled = preparing;
    remove.setAttribute("aria-label", "Usuń z listy " + name);
    remove.dataset.index = String(index);
    remove.append(icon("i-x"));
    li.append(text, option, remove);
    return li;
  });
  list.replaceChildren(...items);
  list.hidden = items.length === 0;
  byId("empty-roster").hidden = items.length > 0;
  byId("absence-hint").hidden = items.length === 0;
  byId("count").textContent = String(items.length);
  input.disabled = preparing;
  byId("add-person").disabled = preparing;
  startButton.disabled = preparing || items.length < 2;
  byId("start-label").textContent = preparing ? "Przygotowujemy koperty…" : "Rozpocznij losowanie";
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
  byId("setup-error").hidden = true;
  save();
  renderNames();
  byId("status").textContent = "Dodano " + name + ".";
  return true;
}

function turnView(participants) {
  const round = game.round;
  const giver = participants[round.turn];
  if (round.recipient !== null && revealed) {
    const last = round.turn === participants.length - 1;
    return {
      label: "Twój prezent dostanie", title: participants[round.recipient],
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
  const view = turnView(drawOrder(game.names, game.absent));
  const showing = round.recipient !== null && revealed;
  const person = round.turn - game.absent.length + 1;
  const present = game.names.length - game.absent.length;
  byId("turn-count").textContent = "Osoba " + person + " z " + present;
  byId("meter-fill").style.width = (100 * person / present) + "%";
  byId("turn-label").textContent = view.label;
  byId("turn-title").textContent = view.title;
  byId("turn-hint").textContent = view.hint;
  byId("action-label").textContent = view.action;
  byId("turn-icon").setAttribute("href", "#" + view.seal);
  byId("action-icon").setAttribute("href", "#" + view.actionIcon);
  byId("turn-seal").classList.toggle("revealed", showing);
  byId("local-slip").classList.toggle("revealed", showing);
}

function invitationUrl(fragment) {
  const page = window.location.hostname.endsWith(".chatgpt.site")
    ? "https://torgunidas.github.io/poczta-prezentowa/"
    : window.location.href;
  const url = new URL(page);
  url.search = "";
  url.hash = fragment;
  return url.href;
}

function invitationRow(name, fragment) {
  const item = document.createElement("li");
  const label = document.createElement("span");
  label.textContent = name;
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "btn secondary";
  copy.textContent = "Kopiuj link";
  copy.setAttribute("aria-label", "Kopiuj link dla " + name);
  const field = document.createElement("input");
  field.type = "text";
  field.readOnly = true;
  field.hidden = true;
  field.setAttribute("aria-label", "Link dla " + name);
  const url = invitationUrl(fragment);

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      field.hidden = true;
      field.value = "";
      copy.textContent = "Skopiowano";
      byId("status").textContent = "Skopiowano link dla " + name + ".";
    } catch {
      field.value = url;
      field.hidden = false;
      field.focus();
      field.select();
      byId("status").textContent = "Skopiuj zaznaczony link dla " + name + ".";
    }
  });
  item.append(label, copy, field);
  return item;
}

function renderInvitations() {
  byId("invitation-list").replaceChildren(...game.absent.map((name, index) =>
    invitationRow(name, game.invitations[index])
  ));
  byId("links-continue").textContent = game.round.turn === game.names.length
    ? "Gotowe"
    : "Przejdź do losowania na telefonie";
}

function render(focus = false) {
  const phase = !game.round ? 0 : game.round.turn < game.names.length || game.linksPending ? 1 : 2;
  const panel = ["setup", game.linksPending ? "links" : "turn", "done"][phase];
  for (const id of ["setup", "links", "turn", "done"]) byId(id).hidden = id !== panel;
  document.querySelectorAll(".steps li").forEach((step, index) => {
    step.classList.toggle("current", index === phase);
    step.classList.toggle("past", index < phase);
    if (index === phase) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
    step.firstElementChild.textContent = index < phase ? "✓" : String(index + 1);
  });
  if (panel === "setup") renderNames();
  if (panel === "links") renderInvitations();
  else byId("invitation-list").replaceChildren();
  if (panel === "turn") renderTurn();
  else byId("turn-title").textContent = "";
  if (panel === "done") {
    const hasLinks = game.invitations.length > 0;
    byId("show-links").hidden = !hasLinks;
    byId("done-hint").textContent = hasLinks
      ? "Osoby nieobecne mogą odkryć swój wynik z otrzymanego linku."
      : "Każdy już wie, komu kupuje prezent. Wesołych Świąt!";
  }
  if (focus) byId(panel + "-title").focus();
}

function backToList() {
  game.round = null;
  game.invitations = [];
  game.linksPending = false;
  revealed = false;
  setError();
  byId("setup-error").hidden = true;
  byId("status").textContent = "";
  save();
  render(true);
}

byId("name-form").addEventListener("submit", event => {
  event.preventDefault();
  if (!game.round && !preparing && addInput()) input.focus();
});
input.addEventListener("input", () => setError());
byId("names").addEventListener("change", event => {
  const checkbox = event.target.closest("input[data-index]");
  if (!checkbox || game.round || preparing) return;
  const name = game.names[Number(checkbox.dataset.index)];
  const absent = new Set(game.absent);
  if (checkbox.checked) absent.add(name);
  else absent.delete(name);
  game.absent = game.names.filter(name => absent.has(name));
  byId("setup-error").hidden = true;
  save();
});
byId("names").addEventListener("click", event => {
  const button = event.target.closest("button[data-index]");
  if (!button || game.round || preparing) return;
  const index = Number(button.dataset.index);
  const [name] = game.names.splice(index, 1);
  game.absent = game.absent.filter(person => person !== name);
  setError();
  byId("setup-error").hidden = true;
  save();
  renderNames();
  byId("status").textContent = "Usunięto " + name + ".";
  const buttons = byId("names").querySelectorAll("button");
  (buttons[Math.min(index, buttons.length - 1)] ?? input).focus();
});
startButton.addEventListener("click", async () => {
  if (game.round || preparing || game.names.length < 2) return;
  if (input.value.trim() && !addInput()) return;
  input.value = "";
  const error = byId("setup-error");
  error.hidden = true;
  preparing = true;
  renderNames();
  try {
    const { round, invitations } = await prepareRound(game.names, game.absent);
    game.round = round;
    game.invitations = invitations;
    game.linksPending = invitations.length > 0;
    save();
  } catch {
    error.textContent = "Nie udało się przygotować kopert. Spróbuj ponownie w aktualnej przeglądarce.";
    error.hidden = false;
  } finally {
    preparing = false;
  }
  byId("status").textContent = "";
  render(Boolean(game.round));
  if (!game.round) startButton.focus();
});

byId("links-continue").addEventListener("click", () => {
  game.linksPending = false;
  byId("status").textContent = "";
  save();
  render(true);
});
byId("show-links").addEventListener("click", () => {
  game.linksPending = true;
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
byId("restart-open").addEventListener("click", () => {
  byId("restart-hint").textContent = game.invitations.length
    ? "Wysłane linki nadal otworzą poprzedni wynik. Jeśli zaczniesz od nowa, wyślij uczestnikom nowe linki."
    : "Dotychczasowe przydziały stracą ważność. Imiona zostaną na liście do kolejnej rundy.";
  byId("restart-dialog").showModal();
});
byId("confirm-restart").addEventListener("click", () => {
  byId("restart-dialog").close();
  backToList();
});
document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    if (event.target === dialog || event.target.closest("[data-close]")) dialog.close();
  });
});

async function showInvitation() {
  for (const id of ["hero", "steps", "help-open", "setup"]) byId(id).hidden = true;
  byId("game").classList.add("guest-sheet");
  byId("guest").hidden = false;

  const guest = await openInvitation(fragment);
  const title = byId("guest-title");
  const hint = byId("guest-hint");
  const button = byId("guest-button");
  if (!guest) {
    title.textContent = "Nie udało się otworzyć koperty";
    hint.textContent = "Poproś organizatora o ponowne wysłanie linku.";
    byId("guest-home").hidden = false;
    title.focus();
    return;
  }

  let showing = false;
  function renderGuest() {
    byId("guest-label").textContent = showing ? "Twój prezent dostanie" : "Koperta dla";
    title.textContent = showing ? guest.recipient : guest.giver;
    hint.textContent = showing ? "Po zapamiętaniu imienia możesz ukryć wynik." : "Otwórz kopertę, żeby zobaczyć, komu kupujesz prezent.";
    byId("guest-action").textContent = showing ? "Ukryj wynik" : "Odkryj mój wynik";
    byId("guest-icon").setAttribute("href", showing ? "#i-gift" : "#i-mail");
    byId("guest-action-icon").setAttribute("href", showing ? "#i-lock" : "#i-mail");
    byId("guest-seal").classList.toggle("revealed", showing);
    byId("guest-slip").classList.toggle("revealed", showing);
  }

  function coverGuest() {
    if (!showing) return;
    showing = false;
    renderGuest();
  }

  button.addEventListener("click", event => {
    if (event.detail > 1) return;
    showing = !showing;
    renderGuest();
    title.focus();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) coverGuest(); });
  window.addEventListener("pagehide", coverGuest);
  button.hidden = false;
  renderGuest();
  title.focus();
}

async function showOrganizerSession() {
  for (const id of ["hero", "steps", "help-open", "setup", "links-continue"]) byId(id).hidden = true;
  byId("game").classList.add("guest-sheet");
  const title = byId("links-title");
  const hint = byId("links-hint");
  title.textContent = "Sesja organizatora";
  hint.textContent = "Wczytujemy linki…";
  byId("links").hidden = false;
  const session = await openOrganizerSession(fragment);
  if (!session) {
    hint.textContent = "Nie udało się wczytać sesji. Sprawdź, czy adres został skopiowany w całości.";
  } else {
    hint.textContent = "Zachowaj adres tej sesji dla siebie. Każdej osobie wyślij tylko jej link.";
    byId("invitation-list").replaceChildren(...session.invitations.map(({ giver, link }) => invitationRow(giver, link)));
    const completed = byId("completed-givers");
    completed.textContent = "Wyniki zapisane wcześniej: " + session.completed.join(", ") + ".";
    completed.hidden = session.completed.length === 0;
  }
  title.focus();
}

window.addEventListener("hashchange", () => {
  if (guestMode || organizerMode || window.location.hash.startsWith(invitationPrefix) ||
      window.location.hash.startsWith(organizerPrefix)) window.location.reload();
});

if (guestMode) showInvitation();
else if (organizerMode) showOrganizerSession();
else render();
