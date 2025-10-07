import { describe, it, expectTypeOf } from "vitest";
import { on } from ".";

describe("on", () => {
  it("infers the event type", () => {
    expectTypeOf(on(document, "click")).toEqualTypeOf<
      AsyncIterableIterator<PointerEvent>
    >();
    expectTypeOf(on.click(document)).toEqualTypeOf<
      AsyncIterableIterator<PointerEvent>
    >();
  });
  it("defaults to Event if the event type cannot be inferred", () => {
    expectTypeOf(on(document, "unknown")).toEqualTypeOf<
      AsyncIterableIterator<Event>
    >();
    expectTypeOf(on.click(new EventTarget())).toEqualTypeOf<
      AsyncIterableIterator<Event>
    >();
  });
  it("allows asserting the event type", () => {
    expectTypeOf(on<PointerEvent>(document, "unknown")).toEqualTypeOf<
      AsyncIterableIterator<PointerEvent>
    >();
    expectTypeOf(on.click<PointerEvent>(new EventTarget())).toEqualTypeOf<
      AsyncIterableIterator<PointerEvent>
    >();
  });
});
