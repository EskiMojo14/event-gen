export interface EventTargetLike {
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

export type EventTypes<T extends EventTargetLike> = {
  [K in keyof T]: K extends `on${infer E}` ? E : never;
}[keyof T];

export type EventForType<T extends EventTargetLike, E extends string> =
  T extends Partial<
    Record<`on${E}`, ((ev: infer F extends Event) => void) | null>
  >
    ? F
    : Event;
