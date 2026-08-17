import assert from "node:assert/strict";
import test from "node:test";

import { parseSimpleYaml } from "../src/yaml.js";

test("minimal YAML parser accepts block chomping indicators", () => {
  assert.deepEqual(parseSimpleYaml("ui:\n  bgm:\n    src: >-\n      data:audio/wav;base64,AAAA"), {
    ui: { bgm: { src: "data:audio/wav;base64,AAAA" } }
  });
  assert.deepEqual(parseSimpleYaml("value: |+\n  first\n  second"), {
    value: "first\nsecond\n"
  });
});
