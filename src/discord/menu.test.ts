import { describe, expect, it } from "vitest";

import { fitToRows } from "./connection";

/**
 * The core lays a menu out one option per row — right for a Telegram
 * keyboard, and impossible on Discord, which allows five action rows. The
 * feedback menu is six (a like) or seven (a dislike), so every one of them
 * failed with `components[BASE_TYPE_MAX_LENGTH]` until this re-flowed them.
 */

const grid = (n: number) =>
  Array.from({ length: n }, (_, i) => [{ text: `option ${i}`, callbackData: `cb:${i}` }]);

const flat = (rows: { callbackData: string }[][]) => rows.flat().map((b) => b.callbackData);

describe("fitToRows", () => {
  it("fits the feedback menus that used to fail", () => {
    for (const size of [6, 7]) {
      const rows = fitToRows(grid(size));
      expect(rows.length).toBeLessThanOrEqual(5);
      for (const row of rows) expect(row.length).toBeLessThanOrEqual(5);
      // Nothing is dropped: losing an option changes the question asked.
      expect(flat(rows)).toEqual(flat(grid(size)));
    }
  });

  it("leaves a menu that already fits one per row alone", () => {
    const rows = fitToRows(grid(4));
    expect(rows.map((r) => r.length)).toEqual([1, 1, 1, 1]);
  });

  it("keeps rows as narrow as they can be, so long labels stay readable", () => {
    // 7 buttons fit in 5 rows at 2 per row; it must not cram 5 into one.
    expect(fitToRows(grid(7)).map((r) => r.length)).toEqual([2, 2, 2, 1]);
    expect(fitToRows(grid(25)).map((r) => r.length)).toEqual([5, 5, 5, 5, 5]);
  });

  it("says so rather than silently losing buttons past what Discord can show", () => {
    expect(() => fitToRows(grid(26))).toThrow(/25 buttons, not 26/);
  });

  it("re-packs a grid that is already several buttons wide", () => {
    const wide = [
      [{ text: "a", callbackData: "1" }, { text: "b", callbackData: "2" }],
      [{ text: "c", callbackData: "3" }],
    ];
    expect(flat(fitToRows(wide))).toEqual(["1", "2", "3"]);
  });

  it("has nothing to do with an empty menu", () => {
    expect(fitToRows([])).toEqual([]);
  });
});
