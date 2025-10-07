import { types } from "./constants";
import type {
  EventTargetLike,
  EventForType,
  EventTypes,
  Onable,
} from "./types";

/**
 * Create an async iterable of events from an EventTarget.
 *
 * _Event type is inferred from the target's `on${TEventType}` property (e.g. `onclick`)._
 *
 * @example
 * for await (const event of on(document, "click")) {
 *   // do something with the click event
 * }
 *
 * @param target Event target
 * @param type Type of event to listen for
 * @param opts Options for the event listener
 *
 * @returns Async iterable of events
 */
function onImpl<
  TTarget extends EventTargetLike,
  TEventType extends EventTypes<TTarget>,
>(
  target: TTarget,
  type: TEventType,
  opts?: AddEventListenerOptions,
): AsyncIterableIterator<EventForType<TTarget, TEventType>>;

/**
 * Create an async iterable of events from an EventTarget.
 *
 * _Event type could not be inferred from the target's `on${TEventType}` property, so defaults to `Event`._
 *
 * _A type parameter can be provided to assert the event type._
 *
 * @example
 * for await (const event of on<PointerEvent>(target, "click")) {
 *   // do something with the click event
 * }
 *
 * @param target Event target
 * @param type Type of event to listen for
 * @param opts Options for the event listener
 *
 * @returns Async iterable of events
 */
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
  /**
   * Create an async iterable of events from an EventTarget.
   *
   * _Event type is inferred from the target's `on${TEventType}` property (e.g. `onclick`)._
   *
   * @example
   * for await (const event of on.click(document)) {
   *   // do something with the click event
   * }
   *
   * @param target Event target
   * @param opts Options for the event listener
   *
   * @returns Async iterable of events
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEvent<TTarget extends EventTargetLike & Onable<TEventType, any>>(
    target: TTarget,
    opts?: AddEventListenerOptions,
  ): AsyncIterableIterator<EventForType<TTarget, TEventType>>;

  /**
   * Create an async iterable of events from an EventTarget.
   *
   * _Event type could not be inferred from the target's `on${TEventType}` property, so defaults to `Event`._
   *
   * _A type parameter can be provided to assert the event type._
   *
   * @example
   * for await (const event of on.click<PointerEvent>(target)) {
   *   // do something with the click event
   * }
   *
   * @param target Event target
   * @param opts Options for the event listener
   *
   * @returns Async iterable of events
   */
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
