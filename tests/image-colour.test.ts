import { parseSchema } from "@artzine/contracts";
import { expect, test } from "vitest";

const id = "00000000-0000-4000-8000-000000000001";
const image = { asset_id: id, width: 480, height: 360, widths: [480] };
const analysis = {
  version: 1,
  space: "srgb",
  swatches: [{ hex: "#00ff88", weight: 1 }],
};
test("image colour metadata is optional and versioned", () => {
  expect(parseSchema("ImageDisplay", image)).toEqual(image);
  expect(
    parseSchema("ImageDisplay", { ...image, colour_analysis: null })
      .colour_analysis,
  ).toBeNull();
  expect(
    parseSchema("ImageDisplay", { ...image, colour_analysis: analysis })
      .colour_analysis,
  ).toEqual(analysis);
  expect(() =>
    parseSchema("ImageColourAnalysis", { ...analysis, version: 2 }),
  ).toThrow();
  expect(() =>
    parseSchema("ImageColourAnalysis", { ...analysis, space: "unbounded" }),
  ).toThrow();
  expect(() =>
    parseSchema("ImageColourAnalysis", {
      ...analysis,
      swatches: [{ hex: "#ff00ff", weight: 2 }],
    }),
  ).toThrow();
  expect(() =>
    parseSchema("ImageColourAnalysis", {
      ...analysis,
      swatches: Array.from({ length: 9 }, (_, i) => ({
        hex: "#00000" + i,
        weight: 1 / 9,
      })),
    }),
  ).toThrow();
});
