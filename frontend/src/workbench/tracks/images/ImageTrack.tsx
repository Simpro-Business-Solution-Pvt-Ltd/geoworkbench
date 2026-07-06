import { useMemo } from "react";

import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import type { LogTrackContext } from "../../core/logTrackContext";
import { TrackFrame } from "../../core/TrackFrame";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

type PreparedCoreImage = {
  image: BoreholeWorkbench["core_images"][number];
  fromDepth: number;
  toDepth: number;
  centerDepth: number;
};

const FULL_STRIP_FIT_HEIGHT = 140;
const STRIP_IMAGE_LOAD_MIN_HEIGHT = 18;
const CORE_IMAGE_OVERSCAN_DEPTH = 12;

export function ImageTrack({ data, track, context }: Props) {
  const { scale, visibleDepthSpan } = context;
  const preparedImages = useMemo(
    () =>
      data.core_images
        .map(prepareCoreImage)
        .filter((image): image is PreparedCoreImage => Boolean(image))
        .sort((a, b) => a.fromDepth - b.fromDepth || a.image.box_number - b.image.box_number),
    [data.core_images],
  );
  const visibleImages = useMemo(
    () =>
      preparedImages.filter(
        (image) =>
          image.toDepth >= visibleDepthSpan.fromDepth - CORE_IMAGE_OVERSCAN_DEPTH &&
          image.fromDepth <= visibleDepthSpan.toDepth + CORE_IMAGE_OVERSCAN_DEPTH,
      ),
    [preparedImages, visibleDepthSpan],
  );

  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="image-track"
      hitTest={({ depth }) => {
        const image = imageAtDepth(preparedImages, depth);
        if (image) {
          return {
            kind: "core-image",
            id: `core-image:${image.image.box_number}`,
            depth,
            image: image.image,
          };
        }
        const nearest = nearestImage(preparedImages, depth);
        return nearest
          ? {
              kind: "core-image",
              id: `core-image:${nearest.image.box_number}`,
              depth,
              image: nearest.image,
            }
          : null;
      }}
    >
      {visibleImages.map(({ image, fromDepth, toDepth }) => {
        const visibleFromDepth = Math.max(fromDepth, scale.fromDepth);
        const visibleToDepth = Math.min(toDepth, scale.toDepth);
        if (visibleToDepth <= visibleFromDepth) return null;

        const intervalHeight = Math.max(1, scale.depthToY(visibleToDepth) - scale.depthToY(visibleFromDepth));
        const shouldLoadImage = intervalHeight >= STRIP_IMAGE_LOAD_MIN_HEIGHT;
        const canShowFullStrip = intervalHeight >= FULL_STRIP_FIT_HEIGHT;
        const intervalSpan = Math.max(0.001, toDepth - fromDepth);
        const visibleSpan = Math.max(0.001, visibleToDepth - visibleFromDepth);
        const imageOffsetPercent = ((visibleFromDepth - fromDepth) / intervalSpan) * 100;
        const imageScalePercent = (intervalSpan / visibleSpan) * 100;
        const imageClassName = canShowFullStrip
          ? "core-strip-img core-strip-img-full"
          : "core-strip-img core-strip-img-crop";
        return (
          <button
            type="button"
            className={`core-strip ${shouldLoadImage ? "loaded" : "deferred"}`}
            key={image.box_number}
            style={scale.intervalToStyle(visibleFromDepth, visibleToDepth)}
            aria-label={`Open corebox ${image.box_number}, ${fromDepth.toFixed(1)} to ${toDepth.toFixed(1)} meters`}
            title={`Open corebox ${image.box_number}`}
          >
            {shouldLoadImage && image.strip_url ? (
              <img
                className={imageClassName}
                src={image.strip_url}
                alt={`Depth-arranged core strip ${image.box_number}`}
                loading="lazy"
                decoding="async"
                draggable={false}
                width={stripDimension(image.strip_metadata, "strip_width_px")}
                height={stripDimension(image.strip_metadata, "strip_height_px")}
                style={{
                  top: `${-imageOffsetPercent}%`,
                  height: `${imageScalePercent}%`,
                }}
              />
            ) : shouldLoadImage ? (
              <CoreLaneStack imageUrl={image.url} boxNumber={image.box_number} />
            ) : (
              <span className="core-strip-placeholder">Box {image.box_number}</span>
            )}
          </button>
        );
      })}
    </TrackFrame>
  );
}

function prepareCoreImage(image: BoreholeWorkbench["core_images"][number]): PreparedCoreImage | null {
  const fromDepth = image.from_depth ?? image.to_depth;
  const toDepth = image.to_depth ?? image.from_depth;
  if (typeof fromDepth !== "number" || typeof toDepth !== "number") return null;
  if (!Number.isFinite(fromDepth) || !Number.isFinite(toDepth)) return null;
  const startDepth = Math.min(fromDepth, toDepth);
  const endDepth = Math.max(fromDepth, toDepth);
  return {
    image,
    fromDepth: startDepth,
    toDepth: endDepth > startDepth ? endDepth : startDepth + 0.01,
    centerDepth: (startDepth + endDepth) / 2,
  };
}

function imageAtDepth(images: PreparedCoreImage[], depth: number) {
  let low = 0;
  let high = images.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const image = images[mid];
    if (depth < image.fromDepth) {
      high = mid - 1;
    } else if (depth > image.toDepth) {
      low = mid + 1;
    } else {
      return image;
    }
  }
  return null;
}

function nearestImage(images: PreparedCoreImage[], depth: number) {
  if (images.length === 0) return null;
  let nearest = images[0];
  let nearestDistance = Math.abs(nearest.centerDepth - depth);
  for (const image of images) {
    const distance = Math.abs(image.centerDepth - depth);
    if (distance < nearestDistance) {
      nearest = image;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function stripDimension(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function CoreLaneStack({ imageUrl, boxNumber }: { imageUrl: string; boxNumber: number }) {
  return (
    <div className="core-lane-stack" aria-label={`Depth-arranged core lanes for box ${boxNumber}`}>
      {[0, 1, 2, 3].map((lane) => (
        <i key={lane}>
          <b
            style={{
              backgroundImage: `url(${imageUrl})`,
              backgroundPosition: `center ${lane === 0 ? "16%" : lane === 1 ? "39%" : lane === 2 ? "62%" : "84%"}`,
            }}
          />
        </i>
      ))}
    </div>
  );
}
