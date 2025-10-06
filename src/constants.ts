export const types = [
  "abort",
  "blur",
  "click",
  "focus",
] as const satisfies ReadonlyArray<keyof GlobalEventHandlersEventMap>;

export type Types = (typeof types)[number];
