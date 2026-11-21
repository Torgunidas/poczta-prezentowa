import test from "node:test";
import assert from "node:assert/strict";
import { cleanName, nameIssue, newRound, candidates, draw, finishTurn, restoreGame } from "../dist/draw.js";

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
