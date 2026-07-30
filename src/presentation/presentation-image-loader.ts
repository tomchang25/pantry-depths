import { REQUIRED_PRESENTATION_ASSETS } from "@/content/presentation/presentation-asset-definitions";

export type PresentationImages = ReadonlyMap<string, CanvasImageSource>;

export class PresentationAssetError extends Error {
  public constructor(
    readonly assetId: string,
    message: string,
  ) {
    super(`${assetId}: ${message}`);
    this.name = "PresentationAssetError";
  }
}

export type LoadableImage = CanvasImageSource &
  Readonly<{
    naturalWidth: number;
    naturalHeight: number;
  }> & {
    src: string;
    decoding?: "async" | "sync" | "auto";
    addEventListener(type: "load" | "error", listener: () => void, options?: AddEventListenerOptions): void;
  };

export type ImageFactory = () => LoadableImage;

export type ExpectedImageDimensions = Readonly<{ width: number; height: number }>;

/**
 * One asset, and the exact sheet it has to arrive as.
 *
 * A manifest entry may still be a bare url, which is what the shipped 512-square manifest is and
 * what every world sprite will stay. The long form exists for animation atlases, whose size is a
 * fact about the individual clip: a batch of them cannot be checked against one number without
 * either weakening the check or forcing every clip to the widest one's shape.
 */
export type PresentationAssetSource = Readonly<{ url: string; dimensions: ExpectedImageDimensions }>;

export type PresentationManifest = Readonly<Record<string, string | PresentationAssetSource>>;

const DEFAULT_IMAGE_DIMENSIONS: ExpectedImageDimensions = { width: 512, height: 512 };

function defaultImageFactory(): LoadableImage {
  return new Image() as LoadableImage;
}

function loadOne(
  assetId: string,
  url: string,
  imageFactory: ImageFactory,
  expectedDimensions: ExpectedImageDimensions,
): Promise<readonly [string, CanvasImageSource]> {
  return new Promise((resolve, reject) => {
    const image = imageFactory();
    image.decoding = "async";
    image.addEventListener(
      "load",
      () => {
        if (image.naturalWidth !== expectedDimensions.width || image.naturalHeight !== expectedDimensions.height) {
          reject(
            new PresentationAssetError(
              assetId,
              `expected a ${expectedDimensions.width} x ${expectedDimensions.height} image, received ${image.naturalWidth} x ${image.naturalHeight}`,
            ),
          );
          return;
        }

        resolve([assetId, image]);
      },
      { once: true },
    );
    image.addEventListener("error", () => reject(new PresentationAssetError(assetId, `unable to load ${url}`)), {
      once: true,
    });
    image.src = url;
  });
}

/** Loads the complete immutable sprite manifest before the renderer becomes ready. */
export async function loadPresentationImages(
  manifest: PresentationManifest = REQUIRED_PRESENTATION_ASSETS,
  imageFactory: ImageFactory = defaultImageFactory,
): Promise<PresentationImages> {
  const loaded = await Promise.all(
    Object.entries(manifest).map(([assetId, entry]) =>
      typeof entry === "string"
        ? loadOne(assetId, entry, imageFactory, DEFAULT_IMAGE_DIMENSIONS)
        : loadOne(assetId, entry.url, imageFactory, entry.dimensions),
    ),
  );
  return new Map(loaded);
}
