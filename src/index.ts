import type { Types } from "./constants";
import { types } from "./constants";
import type { EventTargetLike, EventForType, EventTypes } from "./types";

function onImpl<T extends EventTargetLike, E extends EventTypes<T>>(
  target: T,
  type: E,
  { signal: parentSignal, ...opts }: AddEventListenerOptions = {},
): AsyncIterableIterator<EventForType<T, E>> {
  let current = Promise.withResolvers<IteratorResult<EventForType<T, E>>>();

  const returnAc = new AbortController();

  function done() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    current.resolve({ done: true, value: parentSignal?.reason });
  }

  parentSignal?.addEventListener("abort", done);

  if (parentSignal?.aborted) {
    done();
  } else {
    target.addEventListener(
      type,
      (ev) => {
        current.resolve({ done: false, value: ev as EventForType<T, E> });
        current = Promise.withResolvers();
      },
      {
        ...opts,
        signal: parentSignal
          ? AbortSignal.any([returnAc.signal, parentSignal])
          : returnAc.signal,
      },
    );
  }

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      return current.promise;
    },
    return() {
      returnAc.abort();
      done();
      return current.promise;
    },
  };
}

const factory =
  <E extends string>(type: E) =>
  <T extends EventTargetLike>(
    target: T,
    opts?: AddEventListenerOptions,
  ): AsyncIterableIterator<EventForType<T, E>> =>
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
