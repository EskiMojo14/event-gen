export const types = [
  // Mouse
  "click",
  "dblclick",
  "mousedown",
  "mouseup",
  "mousemove",
  "mouseenter",
  "mouseleave",
  "contextmenu",
  "wheel",

  // Keyboard
  "keydown",
  "keyup",

  // Form
  "input",
  "change",
  "submit",
  "reset",
  "focus",
  "blur",

  // Clipboard
  "copy",
  "cut",
  "paste",

  // Lifecycle
  "load",
  "error",
  "abort",

  // Layout
  "resize",
  "scroll",

  // Drag & Drop
  "drag",
  "dragover",
  "drop",

  // Touch
  "touchstart",
  "touchend",

  // Pointer (modern)
  "pointerdown",
  "pointerup",
  "pointermove",

  // Animation
  "animationend",
  "transitionend",
] as const satisfies ReadonlyArray<keyof GlobalEventHandlersEventMap>;
