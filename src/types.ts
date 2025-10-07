export interface EventTargetLike {
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

export type Onable<TEventType extends string, TEvent extends Event> = Partial<
  Record<`on${TEventType}`, ((event: TEvent) => void) | null>
>;

export type EventTypes<TTarget extends EventTargetLike> = {
  [Key in keyof TTarget]: Key extends `on${infer TEventType}`
    ? TEventType
    : never;
}[keyof TTarget];

export type EventForType<
  TTarget extends EventTargetLike,
  TEventType extends string,
> = TTarget extends Onable<TEventType, infer TEvent> ? TEvent : Event;
