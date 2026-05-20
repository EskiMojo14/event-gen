import type { SizeLimitConfig } from "size-limit";
import * as exports from "./dist/index.mjs";

const path = "dist/index.mjs";

export default [
  { path },
  ...Object.keys(exports).map((key) => ({ path, import: `{ ${key} }`, name: key })),
] satisfies SizeLimitConfig;
