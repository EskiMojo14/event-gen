import type { Types } from "./constants";
import { types } from "./constants";
import type { EventTargetLike, EventForType, EventTypes } from "./types";

async function* onImpl<T extends EventTargetLike, E extends EventTypes<T>>(
  target: T,
  type: E,
  opts: Omit<AddEventListenerOptions, "once"> = {},
): AsyncGenerator<EventForType<T, E>> {
  const { signal } = opts;
  let reason: unknown;
  let aborted = false as boolean;
  if (signal) {
    signal.addEventListener("abort", () => {
      aborted = true;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ({ reason } = signal);
    });
  }
  while (!aborted) {
    yield new Promise<EventForType<T, E>>((resolve, reject) => {
      const ac = new AbortController();
      function onAbort() {
        reject(new Error("Iterator aborted", { cause: reason }));
      }
      if (aborted) {
        // already aborted, so reject immediately - don't listen for events
        onAbort();
        return;
      }
      // reject the promise if the listener gets removed
      signal?.addEventListener("abort", onAbort, { signal: ac.signal });

      target.addEventListener(
        type,
        (ev) => {
          // listener got called, we can stop listening for abort
          ac.abort();

          resolve(ev as EventForType<T, E>);
        },
        {
          once: true,
          ...opts,
        },
      );
    });
  }
}

const factory =
  <E extends string>(type: E) =>
  <T extends EventTargetLike>(
    target: T,
    opts?: Omit<AddEventListenerOptions, "once">,
  ): AsyncIterable<EventForType<T, E>> =>
    onImpl(target, type as never, opts) as never;

type EventFactories = {
  [K in Types]: ReturnType<typeof factory<K>>;
};

export const on = Object.assign(
  onImpl,
  Object.fromEntries(
    types.map((type) => [type, factory(type)]),
  ) as EventFactories,
);
