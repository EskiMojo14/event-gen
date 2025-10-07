import { types } from "./constants";
import type {
  EventTargetLike,
  EventForType,
  EventTypes,
  Onable,
} from "./types";

// safely infer the event type from the target's `on${E}` property
function onImpl<
  TTarget extends EventTargetLike,
  TEventType extends EventTypes<TTarget>,
>(
  target: TTarget,
  type: TEventType,
  opts?: AddEventListenerOptions,
): AsyncIterableIterator<EventForType<TTarget, TEventType>>;

// unsafely allow asserting the event type
function onImpl<TEvent extends Event>(
  target: EventTargetLike,
  type: string,
  opts?: AddEventListenerOptions,
): AsyncIterableIterator<TEvent>;

function onImpl(
  target: EventTargetLike,
  type: string,
  { signal: parentSignal, ...opts }: AddEventListenerOptions = {},
): AsyncIterableIterator<Event> {
  let current = Promise.withResolvers<IteratorResult<Event>>();

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
      (value) => {
        current.resolve({ done: false, value });
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

const makeOn = <TEventType extends string>(type: TEventType) => {
  // safely infer the event type from the target's `on${E}` property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEvent<TTarget extends EventTargetLike & Onable<TEventType, any>>(
    target: TTarget,
    opts?: AddEventListenerOptions,
  ): AsyncIterableIterator<EventForType<TTarget, TEventType>>;

  // unsafely allow asserting the event type
  function onEvent<TEvent extends Event>(
    target: EventTargetLike,
    opts?: AddEventListenerOptions,
  ): AsyncIterableIterator<TEvent>;

  function onEvent(
    target: EventTargetLike,
    opts?: AddEventListenerOptions,
  ): AsyncIterableIterator<Event> {
    return onImpl(target, type, opts);
  }
  return onEvent;
};

type EventFactories = {
  [K in (typeof types)[number]]: ReturnType<typeof makeOn<K>>;
};

export const on = Object.assign(
  onImpl,
  Object.fromEntries(
    types.map((type) => [type, makeOn(type)]),
  ) as EventFactories,
);
