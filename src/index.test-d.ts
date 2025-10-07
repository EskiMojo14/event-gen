/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expectTypeOf } from "vitest";
import type { OnEvent } from ".";
import { on } from ".";

declare module "." {
  export interface KnownEvents {
    known: true;
  }
}

class CustomTarget extends EventTarget {
  onknown: ((event: CustomEvent) => void) | null = null;
}

describe("on", () => {
  it("infers the event type", () => {
    expectTypeOf(on(document, "click")).toEqualTypeOf<
      AsyncIterableIterator<PointerEvent>
    >();
    expectTypeOf(on.click(document)).toEqualTypeOf<
      AsyncIterableIterator<PointerEvent>
    >();
    expectTypeOf(on(new CustomTarget(), "known")).toEqualTypeOf<
      AsyncIterableIterator<CustomEvent>
    >();
    expectTypeOf(on.known(new CustomTarget())).toEqualTypeOf<
      AsyncIterableIterator<CustomEvent>
    >();
  });
  it("defaults to Event if the event type cannot be inferred", () => {
    expectTypeOf(on(document, "unknown")).toEqualTypeOf<
      AsyncIterableIterator<Event>
    >();
    expectTypeOf(on.unknown!(new EventTarget())).toEqualTypeOf<
      AsyncIterableIterator<Event>
    >();
  });
  it("allows asserting the event type", () => {
    expectTypeOf(on<PointerEvent>(document, "unknown")).toEqualTypeOf<
      AsyncIterableIterator<PointerEvent>
    >();
    expectTypeOf(on.unknown!<PointerEvent>(new EventTarget())).toEqualTypeOf<
      AsyncIterableIterator<PointerEvent>
    >();
  });
  it("has known types as methods, and unknown types as possible methods", () => {
    expectTypeOf(on.unknown).toEqualTypeOf<OnEvent<string> | undefined>();
    expectTypeOf(on.known).toEqualTypeOf<OnEvent<"known">>();
  });
});
