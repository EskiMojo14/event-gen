import { page } from "@vitest/browser/context";
import { describe, expect, it, test } from "vitest";
import { on } from ".";

async function* take<T>(iter: AsyncIterable<T>, count: number) {
  for await (const value of iter) {
    yield value;
    if (--count === 0) return;
  }
}

const body = page.elementLocator(document.body);

async function clickThrice() {
  for (let i = 0; i < 3; i++) {
    await body.click();
  }
}

describe("on", () => {
  it("creates an iterable of events", async () => {
    // could be Array.fromAsync(on.click(document).take(3)) one day
    // or with observables, document.when("click").take(3).toArray()
    const listenPromise = Array.fromAsync(take(on.click(document), 3));

    await clickThrice();

    const events = await listenPromise;
    expect(events).toHaveLength(3);
    expect(events.every((event) => event instanceof PointerEvent)).toBe(true);
  });
  it("can be aborted", async () => {
    const ac = new AbortController();

    const listenPromise = Array.fromAsync(
      on.click(document, { signal: ac.signal }),
    );

    await clickThrice();

    ac.abort();

    await body.click();

    await expect(listenPromise).resolves.toHaveLength(3);
  });
  describe("it exposes the abort reason", () => {
    test("when already aborted", async () => {
      const iter = on.click(document, { signal: AbortSignal.abort("Oops!") });
      await expect(iter.next()).resolves.toEqual({
        done: true,
        value: "Oops!",
      });
    });
    test("when aborted during iteration", async () => {
      const ac = new AbortController();
      const iter = on.click(document, { signal: ac.signal });

      const firstClickPromise = iter.next();
      await body.click();
      await expect(firstClickPromise).resolves.toEqual({
        done: false,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        value: expect.any(PointerEvent),
      });

      ac.abort("Oops!");

      await expect(iter.next()).resolves.toEqual({
        done: true,
        value: "Oops!",
      });
    });
  });
});
