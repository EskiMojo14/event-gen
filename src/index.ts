import type { EventTargetLike, EventForType, EventTypes, InferrableTarget, Compute } from "./types";

export type { EventTargetLike, EventForType, EventTypes, InferrableTarget };

export type BufferOverflowBehavior = "drop-oldest" | "drop-newest" | "error";

interface EventBufferOptions {
  /**
   * How many events to queue before trimming consumed events.
   *
   * @remarks
   * Instead of removing each event from the queue as it is consumed, we only move the head of the queue (which is more efficient).
   * Occasionally the queue will be "trimmed" by removing all consumed events from the array.
   * This value determines how often that happens.
   *
   * Note: This does not limit the number of unconsumed events in the queue.
   *
   * @default 100
   */
  trimBufferAfter?: number;

  /**
   * Maximum number of unconsumed events to keep buffered.
   *
   * @remarks
   * When the limit is reached, the next incoming event is handled according to `overflow`.
   *
   * @default undefined
   */
  maxUnconsumedEvents?: number;

  /**
   * Behavior when `maxUnconsumedEvents` is reached.
   *
   * - `drop-oldest`: discard the oldest buffered event and enqueue the new event
   * - `drop-newest`: discard the newly received event
   * - `error`: stop iteration and reject subsequent `next()` calls
   *
   * @default "drop-oldest"
   */
  onOverflow?: BufferOverflowBehavior;

  /** @deprecated Use `trimBufferAfter` instead. */
  maxQueueSize?: number;
}

export interface EventIteratorOptions extends AddEventListenerOptions, EventBufferOptions {}

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
function onImpl<TTarget extends EventTargetLike, TEventType extends EventTypes<TTarget>>(
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
  {
    signal,
    maxQueueSize,
    trimBufferAfter = maxQueueSize ?? 100,
    maxUnconsumedEvents: maxBufferedEvents,
    onOverflow = "drop-oldest",
    ...opts
  }: EventIteratorOptions = {},
): AsyncIterableIterator<Event> {
  if (maxQueueSize !== undefined) {
    console.warn(
      "The `maxQueueSize` option is deprecated and will be removed in a future version. Please use `trimBufferAfter` instead.",
    );
  }
  const bufferedEvents: Array<Event> = [];
  let bufferHead = 0;
  let waiting: PromiseWithResolvers<IteratorResult<Event>> | undefined;
  let completion: "done" | "error" | undefined;
  let completionReason: unknown;

  if (
    maxBufferedEvents !== undefined &&
    (!Number.isInteger(maxBufferedEvents) || maxBufferedEvents < 0)
  ) {
    throw new RangeError("The `maxBufferedEvents` option must be a positive integer.");
  }

  if (!Number.isInteger(trimBufferAfter) || trimBufferAfter < 0) {
    throw new RangeError("The `trimBufferAfter` option must be a positive integer.");
  }

  const completionAc = new AbortController();

  function done(reason?: unknown) {
    if (!completion) {
      completion = "done";
      completionReason = reason;
    }

    waiting?.resolve({ done: true, value: completionReason });
    waiting = undefined;

    bufferHead = bufferedEvents.length = 0;
  }

  function fail(reason: unknown) {
    if (!completion) {
      completion = "error";
      completionReason = reason;
    }

    waiting?.reject(reason);
    waiting = undefined;

    bufferHead = bufferedEvents.length = 0;
  }

  signal?.addEventListener(
    "abort",
    () => {
      done(signal.reason);
    },
    {
      once: true,
      signal: completionAc.signal,
    },
  );

  if (signal?.aborted) {
    done(signal.reason);
  } else {
    target.addEventListener(
      type,
      (value) => {
        if (waiting) {
          waiting.resolve({ done: false, value });
          waiting = undefined;
        } else {
          const bufferedCount = bufferedEvents.length - bufferHead;

          if (maxBufferedEvents !== undefined && bufferedCount >= maxBufferedEvents) {
            if (onOverflow === "drop-newest") {
              return;
            }

            if (onOverflow === "error") {
              const reason = new Error(
                `Buffered event limit exceeded for \`${type}\` (maxBufferedEvents=${maxBufferedEvents}).`,
              );
              fail(reason);
              completionAc.abort(reason);
              return;
            }

            if (maxBufferedEvents > 0) {
              bufferHead++;
            } else {
              return;
            }
          }

          bufferedEvents.push(value);
        }
      },
      {
        ...opts,
        signal: signal ? AbortSignal.any([completionAc.signal, signal]) : completionAc.signal,
      },
    );
  }

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      if (completion === "error") return Promise.reject(completionReason);
      if (completion === "done") return Promise.resolve({ done: true, value: completionReason });

      if (bufferHead < bufferedEvents.length) {
        const event = bufferedEvents[bufferHead++]!;

        if (bufferHead > trimBufferAfter) {
          bufferedEvents.splice(0, bufferHead);
          bufferHead = 0;
        }

        return Promise.resolve({ done: false, value: event });
      }

      return (waiting ??= Promise.withResolvers()).promise;
    },
    return(reason?: unknown) {
      completionAc.abort();
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
  <TTarget extends EventTargetLike & InferrableTarget<TEventType, any>>(
    target: TTarget,
    opts?: EventIteratorOptions,
  ): AsyncIterableIterator<EventForType<TTarget, TEventType>>;
}

export interface KnownEvents extends Record<keyof WindowEventMap | keyof DocumentEventMap, true> {}

type EventMethods = Compute<
  Record<string, OnEvent> & {
    [K in keyof KnownEvents]: OnKnownEvent<K>;
  } & {
    then?: never; // avoid being thenable
  }
>;
const methodCache = new Map<string, OnEvent>();
export const on = new Proxy(onImpl as typeof onImpl & EventMethods, {
  get: (target, prop) => {
    if (prop === "then") return undefined; // avoid accidentally being thenable
    if (typeof prop !== "string" || Reflect.has(target, prop)) {
      return Reflect.get(target, prop);
    }
    if (!methodCache.has(prop)) methodCache.set(prop, (target, opts) => onImpl(target, prop, opts));
    return methodCache.get(prop);
  },
});
