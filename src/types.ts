export interface EventTargetLike {
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

export type InferrableTarget<
  TEventType extends string,
  TEvent extends Event,
> = Record<`on${TEventType}`, ((event: TEvent) => void) | null>;

export type EventTypes<TTarget extends EventTargetLike> = {
  [Key in keyof TTarget]: Key extends `on${infer TEventType}`
    ? TEventType
    : never;
}[keyof TTarget];

export type EventForType<
  TTarget extends EventTargetLike,
  TEventType extends string,
> = string extends TEventType
  ? Event
  : TTarget extends InferrableTarget<TEventType, infer TEvent>
    ? TEvent
    : Event;

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type Compute<T> = { [K in keyof T]: T[K] } & unknown;
