import test from "node:test";
import assert from "node:assert/strict";
import { cleanName, nameIssue, newRound, candidates, draw, finishTurn, restoreGame } from "../dist/draw.js";
import {
  createInvitation, drawOrder, openInvitation, openOrganizerSession,
  organizerFragment, prepareRound, restoreSession
} from "../dist/invitations.js";

test("sesja organizatora otwiera tylko zaproszenia dla pozostałych osób", async () => {
  const link = await createInvitation("Ewa", "Karol");
  const fragment = organizerFragment(["Karol"], [link]);
  assert.deepEqual(await openOrganizerSession(fragment), {
    completed: ["Karol"],
    invitations: [{ giver: "Ewa", link }]
  });
  assert.equal(await openOrganizerSession(organizerFragment(["Ewa"], [link])), null);
  assert.equal(await openOrganizerSession(fragment.slice(0, -2)), null);
});

test("osoby na telefonie i pod linkami losują z jednej puli", async () => {
  const names = ["Łucja", "Kasia", "Jaś", "Mikołaj", "Marta"];
  const absent = ["Kasia", "Mikołaj"];
  const participants = drawOrder(names, absent);
  const { round, invitations } = await prepareRound(names, absent);
  assert.equal(round.turn, absent.length);
  assert.deepEqual(restoreSession(JSON.stringify({ names, absent, round, invitations, linksPending: true })), {
    names, absent, round, invitations, linksPending: true
  });
  assert.equal(restoreSession(JSON.stringify({ names, absent, round, invitations: [] })).round, null);

  const pairs = await Promise.all(invitations.map(openInvitation));
  assert.deepEqual(pairs.map(pair => pair.giver), absent);
  for (let next = round; next.turn < names.length; next = finishTurn(next)) {
    next = draw(next);
    if (next.retry) next = draw(next);
    pairs.push({ giver: participants[next.turn], recipient: participants[next.recipient] });
  }
  assert.ok(pairs.every(pair => pair.giver !== pair.recipient));
  assert.deepEqual(new Set(pairs.map(pair => pair.recipient)), new Set(names));
});

test("link otwiera ten sam wynik po ponownym wejściu, a uszkodzony link jest odrzucany", async () => {
  const names = ["Żaneta W.".repeat(6), "Łukasz"];
  const { round, invitations: [first, second] } = await prepareRound(names, names);
  assert.equal(round.turn, names.length);
  const firstResult = await openInvitation(first);
  assert.deepEqual(firstResult, { giver: names[0], recipient: names[1] });
  assert.deepEqual(await openInvitation(first), firstResult);
  assert.deepEqual(await openInvitation(second), { giver: names[1], recipient: names[0] });
  const [version, key, iv, data] = first.split(".");
  const changed = (data.startsWith("A") ? "B" : "A") + data.slice(1);
  assert.equal(await openInvitation([version, key, iv, changed].join(".")), null);
  assert.equal(await openInvitation("#losowanie=1.niekompletny"), null);
});

test("runda bez nieobecnych odtwarza sesje zapisane przed dodaniem linków", async () => {
  const names = ["Jan", "Anna"];
  const round = newRound(names);
  assert.deepEqual(await prepareRound(names, []), { round, invitations: [] });
  assert.deepEqual(restoreSession(JSON.stringify({ names, round })), {
    names, round, absent: [], invitations: [], linksPending: false
  });
});

test("imiona są oczyszczane, a dwie osoby o tym samym imieniu można rozróżnić", () => {
  const name = cleanName("   Z\u0307aneta   K.  ");
  assert.equal(name, "Żaneta K.");
  assert.notEqual(nameIssue([name], "ŻANETA K."), "");
  assert.equal(nameIssue([name], "Żaneta M."), "");
  assert.notEqual(nameIssue([], cleanName("  ")), "");
  assert.throws(() => newRound(["Ala"]), RangeError);
});

test("trafienie na siebie nie zużywa karteczki, a ponowne losowanie daje inną osobę", () => {
  const first = newRound(["Ala", "Olek"]);
  const retry = draw(first, () => 0);
  assert.equal(retry.retry, true);
  assert.equal(retry.recipient, null);
  assert.deepEqual(retry.pool, [0, 1]);
  assert.deepEqual(candidates(retry), [1]);
  assert.deepEqual(draw(retry, () => 0).pool, [0]);
});

test("wszystkie ścieżki dla grup od dwóch do sześciu osób kończą się pełnym przydziałem", () => {
  const validAssignments = { 2: 1, 3: 2, 4: 9, 5: 44, 6: 265 };
  for (let size = 2; size <= 6; size++) {
    const names = Array.from({ length: size }, (_, i) => "Osoba " + i);
    const completed = new Set();
    function visit(round, history) {
      assert.deepEqual(restoreGame(JSON.stringify({ names, round })).round, round);
      if (round.turn === size) {
        assert.equal(round.pool.length, 0);
        assert.equal(new Set(history).size, size);
        completed.add(history.join(","));
        return;
      }
      const options = candidates(round);
      assert.ok(options.some(id => id !== round.turn));
      for (const [index, id] of options.entries()) {
        const picked = draw(round, () => index);
        assert.deepEqual(restoreGame(JSON.stringify({ names, round: picked })).round, picked);
        if (id === round.turn) {
          assert.equal(round.retry, false);
          assert.equal(picked.retry, true);
          assert.deepEqual(picked.pool, round.pool);
          visit(picked, history);
        } else {
          assert.equal(picked.recipient, id);
          assert.equal(picked.pool.length, round.pool.length - 1);
          assert.ok(!picked.pool.includes(id));
          assert.equal(draw(picked), picked);
          visit(finishTurn(picked), [...history, id]);
        }
      }
    }
    visit(newRound(names), []);
    assert.equal(completed.size, validAssignments[size]);
  }
});

test("większa grupa losuje z rzeczywistym generatorem bez powtórzeń", () => {
  const names = Array.from({ length: 50 }, (_, i) => "Osoba " + i);
  for (let attempt = 0; attempt < 50; attempt++) {
    let round = newRound(names);
    const recipients = new Set();
    while (round.turn < names.length) {
      round = draw(round);
      if (round.retry) round = draw(round);
      assert.notEqual(round.recipient, null);
      assert.notEqual(round.recipient, round.turn);
      recipients.add(round.recipient);
      round = finishTurn(round);
    }
    assert.equal(recipients.size, names.length);
  }
});

test("uszkodzony zapis nie blokuje kolejnego losowania", () => {
  assert.deepEqual(restoreGame("{"), { names: [], round: null });
  const names = ["Ala", "Olek"];
  const broken = { turn: 0, pool: [1], recipient: 0, retry: false };
  assert.deepEqual(restoreGame(JSON.stringify({ names, round: broken })), { names, round: null });
});
