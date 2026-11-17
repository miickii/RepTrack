import { describe, expect, it } from "vitest";
import { assetUrl } from "../src/assets";
describe("portable exercise images", () => {
  it("resolves existing stored image paths under a Pages project path", () => {
    expect(assetUrl("/exercises/chest.svg", "/RepTrack/")).toBe(
      "/RepTrack/exercises/chest.svg",
    );
    expect(assetUrl("/exercises/chest.svg", "/")).toBe("/exercises/chest.svg");
  });
  it("preserves custom image data exactly", () => {
    const image = "data:image/png;base64,aGVsbG8=";
    expect(assetUrl(image, "/RepTrack/")).toBe(image);
  });
});
