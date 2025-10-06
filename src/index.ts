import type { Types } from "./constants";
import { types } from "./constants";
import type { EventTargetLike, EventForType, EventTypes } from "./types";

interface OnOptions extends AddEventListenerOptions {
  /**
   * Whether to throw an error or complete when the signal (if provided) is aborted.
   *
   * @default true
   */
  throwOnAbort?: boolean;
}

function onImpl<T extends EventTargetLike, E extends EventTypes<T>>(
  target: T,
  type: E,
  { signal: parentSignal, throwOnAbort = true, ...opts }: OnOptions = {},
): AsyncIterableIterator<EventForType<T, E>> {
  let current = Promise.withResolvers<IteratorResult<EventForType<T, E>>>();

  const returnAc = new AbortController();

  function onAbort() {
    if (throwOnAbort) {
      current.reject(
        new Error("Iterator aborted", { cause: parentSignal?.reason }),
      );
    } else {
      current.resolve({ done: true, value: undefined });
    }
  }

  parentSignal?.addEventListener("abort", onAbort);

  if (parentSignal?.aborted) {
    onAbort();
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
      current.resolve({ done: true, value: undefined });
      return current.promise;
    },
  };
}

const factory =
  <E extends string>(type: E) =>
  <T extends EventTargetLike>(
    target: T,
    opts?: OnOptions,
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
