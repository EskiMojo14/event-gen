import { describe, expect, it, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
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

    const listenPromise = Array.fromAsync(on.click(document, { signal: ac.signal }));

    await clickThrice();

    ac.abort();

    await body.click();

    await expect(listenPromise).resolves.toHaveLength(3);
  });
  it("can't be thenable", async () => {
    expect(on.then).toBeUndefined();
    await expect(Promise.resolve(on)).resolves.toBe(on);
  });
  it("forwards symbol and built in props", () => {
    expect(on).toHaveProperty("call", expect.any(Function));
    // @ts-expect-error
    expect(on[Symbol.asyncIterator]).toBeUndefined();
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
        value: expect.any(PointerEvent),
      });

      ac.abort("Oops!");

      await expect(iter.next()).resolves.toEqual({
        done: true,
        value: "Oops!",
      });
    });
  });
  describe("custom options", () => {
    it("warns when deprecated options are used", async () => {
      using consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {}) as unknown as Disposable;

      on.click(document, { maxQueueSize: 42, signal: AbortSignal.abort() });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "The `maxQueueSize` option is deprecated and will be removed in a future version. Please use `trimQueueAfter` instead.",
      );
    });

    it("queues unconsumed click events and yields them later", async () => {
      const iter = on.click(document);

      await clickThrice();

      await expect(iter.next()).resolves.toEqual({ done: false, value: expect.any(PointerEvent) });
      await expect(iter.next()).resolves.toEqual({ done: false, value: expect.any(PointerEvent) });
      await expect(iter.next()).resolves.toEqual({ done: false, value: expect.any(PointerEvent) });

      await iter.return?.();
    });

    it("does not drop unconsumed click events when trimQueueAfter is small", async () => {
      const iter = on.click(document, { trimQueueAfter: 1 });

      await clickThrice();

      await expect(iter.next()).resolves.toEqual({ done: false, value: expect.any(PointerEvent) });
      await expect(iter.next()).resolves.toEqual({ done: false, value: expect.any(PointerEvent) });
      await expect(iter.next()).resolves.toEqual({ done: false, value: expect.any(PointerEvent) });

      await iter.return?.();
    });
  });
});
