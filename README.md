# event-gen

Create an async iterable of events from an EventTarget.

```ts
import { on } from "event-gen";

for await (const event of on(document, "click")) {
  // do something with the click event
}

// for convenience
for await (const event of on.click(document)) {
  // do something with the click event
}
```

Supports passing an abort signal to stop listening for events.

```ts
for await (const event of on.click(document, {
  // stop listening after 1 second
  signal: AbortSignal.timeout(1000),
})) {
  // do something with the click event
}
```

## Type inference

The event type is inferred from the target's `on${TEventType}` property (e.g. `onclick`).

```ts
for await (const event of on.click(document)) {
  // event is inferred as PointerEvent
}
```

If the event type cannot be inferred, it defaults to `Event`. You can assert the event type by providing a type parameter.

```ts
for await (const event of on.click<PointerEvent>(customTarget)) {
  // event is asserted as PointerEvent
}
```
