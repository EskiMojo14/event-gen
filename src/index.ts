import { types } from "./constants";
import type {
  EventTargetLike,
  EventForType,
  EventTypes,
  InferrableTarget,
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
 * for await (const event of on<PointerEvent>(customTarget, "click")) {
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
  const eventQueue: Array<Event> = [];
  let current: PromiseWithResolvers<IteratorResult<Event>> | undefined;
  let isAborted = false;
  let abortReason: unknown;

  const returnAc = new AbortController();

  function done(reason?: unknown) {
    isAborted = true;
    abortReason = reason;

    if (current) {
      current.resolve({ done: true, value: reason });
      current = undefined;
    }

    eventQueue.length = 0;
  }

  parentSignal?.addEventListener("abort", () => {
    done(parentSignal.reason);
  });

  if (parentSignal?.aborted) {
    done(parentSignal.reason);
  } else {
    target.addEventListener(
      type,
      (value) => {
        if (current) {
          current.resolve({ done: false, value });
          current = undefined;
        } else {
          eventQueue.push(value);
        }
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
      if (isAborted) {
        return Promise.resolve({ done: true, value: abortReason });
      }
      const nextEvent = eventQueue.shift();
      if (nextEvent) {
        return Promise.resolve({ done: false, value: nextEvent });
      }
      return (current = Promise.withResolvers()).promise;
    },
    return(reason?: unknown) {
      returnAc.abort();
      done(reason);
      return Promise.resolve({ done: true, value: reason });
    },
  };
}

export interface OnEvent<TEventType extends string> {
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
  <TTarget extends EventTargetLike & InferrableTarget<TEventType, any>>(
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
   * for await (const event of on.click<PointerEvent>(customTarget)) {
   *   // do something with the click event
   * }
   *
   * @param target Event target
   * @param opts Options for the event listener
   *
   * @returns Async iterable of events
   */
  <TEvent extends Event>(
    target: EventTargetLike,
    opts?: AddEventListenerOptions,
  ): AsyncIterableIterator<TEvent>;
}

const makeOn = <TEventType extends string>(
  type: TEventType,
): OnEvent<TEventType> => {
  function onEvent<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TTarget extends EventTargetLike & InferrableTarget<TEventType, any>,
  >(
    target: TTarget,
    opts?: AddEventListenerOptions,
  ): AsyncIterableIterator<EventForType<TTarget, TEventType>>;

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
  [K in (typeof types)[number]]: OnEvent<K>;
};

export const on = Object.assign(
  onImpl,
  Object.fromEntries(
    types.map((type) => [type, makeOn(type)]),
  ) as EventFactories,
);
