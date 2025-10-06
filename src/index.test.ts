import { page } from "@vitest/browser/context";
import { describe, expect, it, test } from "vitest";
import { on } from ".";

describe("on", () => {
  const body = page.elementLocator(document.body);

  async function clickThrice() {
    for (let i = 0; i < 3; i++) {
      await body.click();
    }
  }

  it("creates an iterable of events", async () => {
    // could be Array.fromAsync(on.click(document).take(3)) one day
    // or with observables, document.on("click").take(3).toArray()
    async function listen() {
      const clickEvents: Array<PointerEvent> = [];
      for await (const event of on.click(document)) {
        clickEvents.push(event);
        if (clickEvents.length === 3) {
          break;
        }
      }
      return clickEvents;
    }

    const listenPromise = listen();

    await clickThrice();

    await expect(listenPromise).resolves.toHaveLength(3);
  });
  it("can be aborted", async () => {
    async function listen() {
      const clickEvents: Array<PointerEvent> = [];
      const ac = new AbortController();
      for await (const event of on.click(document, { signal: ac.signal })) {
        clickEvents.push(event);
        if (clickEvents.length === 3) {
          ac.abort("Reached limit of 3 clicks");
        }
      }
      return clickEvents;
    }

    const listenPromise = listen();

    await clickThrice();

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
