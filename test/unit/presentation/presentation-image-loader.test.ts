import {
  loadPresentationImages,
  PresentationAssetError,
  type ImageFactory,
  type LoadableImage,
} from "@/presentation/presentation-image-loader";
import { describe, expect, it } from "vitest";

function fakeImageFactory(width: number, height: number, fails = false): ImageFactory {
  return () => {
    let source = "";
    const listeners: Partial<Record<"load" | "error", () => void>> = {};
    const image = {
      naturalWidth: width,
      naturalHeight: height,
      decoding: "auto" as const,
      addEventListener(type: "load" | "error", listener: () => void) {
        listeners[type] = listener;
      },
      get src() {
        return source;
      },
      set src(value: string) {
        source = value;
        queueMicrotask(() => listeners[fails ? "error" : "load"]?.());
      },
    };
    return image as unknown as LoadableImage;
  };
}

describe("presentation image loader", () => {
  it("blocks until every required 512 square asset is ready", async () => {
    const images = await loadPresentationImages(
      { "enemy.bat.normal": "/bat.png", "presentation.stair": "/stair.png" },
      fakeImageFactory(512, 512),
    );

    expect([...images.keys()]).toEqual(["enemy.bat.normal", "presentation.stair"]);
  });

  it("reports the authored asset id for dimensions that cannot enter the renderer", async () => {
    await expect(
      loadPresentationImages({ "enemy.guard.hurt": "/guard.png" }, fakeImageFactory(256, 512)),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PresentationAssetError>>({
        name: "PresentationAssetError",
        assetId: "enemy.guard.hurt",
      }),
    );
  });

  it("accepts an explicitly sized animation atlas without weakening the default sprite contract", async () => {
    const images = await loadPresentationImages(
      { "enemy.skeletonSwordsman.atlas.walk": "/skeleton-walk.png" },
      fakeImageFactory(1024, 1024),
      { width: 1024, height: 1024 },
    );

    expect([...images.keys()]).toEqual(["enemy.skeletonSwordsman.atlas.walk"]);
  });

  it("keeps load failures retryable by rejecting without retaining partial state", async () => {
    await expect(
      loadPresentationImages({ "key.red": "/missing.png" }, fakeImageFactory(512, 512, true)),
    ).rejects.toThrow("key.red: unable to load /missing.png");
  });
});
