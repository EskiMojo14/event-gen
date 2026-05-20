# event-gen

Create an async iterable of events from an EventTarget.

```ts
import { on } from "event-gen";

for await (const event of on(document, "click")) {
  // do something with the click event
}

// also available as methods (using a Proxy)
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

Events that are emitted faster than they are consumed will be buffered up to the `maxUnconsumedEvents` limit (if one is set). When the buffer is full, the behavior is determined by the `onOverflow` option.

```ts
for await (const event of on.click(document, {
  maxUnconsumedEvents: 100, // no limit by default
  onOverflow: "drop-oldest", // "drop-oldest", "drop-newest", or "error" - "drop-oldest" by default
})) {
  // do something long with the click event
}
```

**Note that a `maxUnconsumedEvents` of `0` with an `onOverflow` of `"error"` will cause the iterator to error on the first event if it's not consumed immediately.**

For performance, consumed events are not removed immediately from the buffer, but instead the buffer is trimmed after a certain number of events (determined by `trimBufferAfter`, default `100`) have been consumed. This means that the real amount of events stored in the buffer may be up to `trimBufferAfter + maxUnconsumedEvents`.

```ts
// up to 150 events may remain in memory with these settings
for await (const event of on.click(document, {
  maxUnconsumedEvents: 100,
  trimBufferAfter: 50, // trim the buffer after every 50 consumed events
})) {
  // do something long with the click event
}
```

## Polyfills

This package uses [`AbortSignal.any`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static) and [`Promise.withResolvers`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers). If you're in an environment without these, you'll need a polyfill.

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

### Methods

A Proxy is used to allow providing the type via calling a method instead of passing it as a parameter. (e.g. `on.click(document)` instead of `on(document, "click")`). This allows any type in runtime, but in Typescript the keys need to be known at compile time for inference to work. Additionally, if you're using `noUncheckedIndexedAccess`, unknown keys will be marked as potentially undefined due to the [index signature](https://github.com/microsoft/TypeScript/issues/47594).

```ts
for await (const event of on.custom(customTarget)) {
  // event is defaulted as Event
}

// can be asserted
for await (const event of on.custom<CustomEvent>(customTarget)) {
  // event is asserted as CustomEvent
}
```

By default the known types are limited to the ones from `window` and `document`. You can expand this by adding to the `KnownEvents` interface.

```ts
declare module "event-gen" {
  export interface KnownEvents {
    custom: true;
  }
}

for await (const event of on.custom(customTarget)) {
  // now knows to look at customTarget.oncustom to infer the event type
}
```
