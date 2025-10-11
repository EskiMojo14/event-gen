import type {
  EventTargetLike,
  EventForType,
  EventTypes,
  InferrableTarget,
  Compute,
} from "./types";

interface EventIteratorOptions extends AddEventListenerOptions {
  /**
   * How many events to queue before discarding older events.
   *
   * @remarks
   * Instead of removing each event from the queue as it is consumed, we only move the head of the queue (which is more efficient).
   * Occasionally the queue will be "trimmed" by removing all processed events from the array.
   * This value determines how often that happens.
   *
   * Decrease if you experience memory leaks.
   *
   * @default 100
   */
  maxQueueSize?: number;
}

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
  opts?: EventIteratorOptions,
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
  opts?: EventIteratorOptions,
): AsyncIterableIterator<TEvent>;

function onImpl(
  target: EventTargetLike,
  type: string,
  { signal, maxQueueSize = 100, ...opts }: EventIteratorOptions = {},
): AsyncIterableIterator<Event> {
  const eventQueue: Array<Event> = [];
  let queueHead = 0;
  let current: PromiseWithResolvers<IteratorResult<Event>> | undefined;
  let isAborted = false;
  let abortReason: unknown;

  const returnAc = new AbortController();

  function done(reason?: unknown) {
    isAborted = true;
    abortReason = reason;

    current?.resolve({ done: true, value: reason });
    current = undefined;

    queueHead = eventQueue.length = 0;
  }

  signal?.addEventListener(
    "abort",
    () => {
      done(signal.reason);
    },
    {
      once: true,
      signal: returnAc.signal,
    },
  );

  if (signal?.aborted) {
    done(signal.reason);
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
        signal: signal
          ? AbortSignal.any([returnAc.signal, signal])
          : returnAc.signal,
      },
    );
  }

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      if (isAborted) return Promise.resolve({ done: true, value: abortReason });

      if (queueHead < eventQueue.length) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const event = eventQueue[queueHead++]!;

        if (queueHead > maxQueueSize) {
          eventQueue.splice(0, queueHead);
          queueHead = 0;
        }

        return Promise.resolve({ done: false, value: event });
      }

      return (current ??= Promise.withResolvers()).promise;
    },
    return(reason?: unknown) {
      returnAc.abort();
      done(reason);
      return Promise.resolve({ done: true, value: reason });
    },
  };
}

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
export type OnEvent = <TEvent extends Event>(
  target: EventTargetLike,
  opts?: EventIteratorOptions,
) => AsyncIterableIterator<TEvent>;

export interface OnKnownEvent<TEventType extends string> extends OnEvent {
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
    opts?: EventIteratorOptions,
  ): AsyncIterableIterator<EventForType<TTarget, TEventType>>;
}

export interface KnownEvents
  extends Record<keyof WindowEventMap | keyof DocumentEventMap, true> {}

type EventMethods = Compute<
  Record<string, OnEvent> & {
    [K in keyof KnownEvents]: OnKnownEvent<K>;
  }
>;
const methodCache = new Map<string, OnEvent>();
export const on = new Proxy(onImpl as typeof onImpl & EventMethods, {
  get: (target, prop) => {
    if (typeof prop !== "string" || Reflect.has(target, prop)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return Reflect.get(target, prop);
    }
    if (!methodCache.has(prop))
      methodCache.set(prop, (target, opts) => onImpl(target, prop, opts));
    return methodCache.get(prop);
  },
});
