import { useMemo, type CSSProperties } from "react";

import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import type { LogTrackContext } from "../../core/logTrackContext";
import { TrackFrame } from "../../core/TrackFrame";
import {
  canLoadCoreImage,
  canShowPreparedCoreImage,
  CORE_IMAGE_LOAD_IDLE_MS,
  CORE_IMAGE_OVERSCAN_DEPTH,
  coreImageDisplayUrl,
  imageAtDepth,
  nearestImage,
  prepareCoreImages,
  resolveCoreImageRenderModel,
  stripDimension,
  stripLaneCount,
  visiblePreparedImages,
} from "./coreImageRenderModel";
import { useDeferredDepthSpan } from "./useDeferredDepthSpan";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

export function ImageTrack({ data, track, context }: Props) {
  const { scale, visibleDepthSpan } = context;
  const loadDepthSpan = useDeferredDepthSpan(visibleDepthSpan, CORE_IMAGE_LOAD_IDLE_MS);
  const preparedImages = useMemo(
    () => prepareCoreImages(data.core_images),
    [data.core_images],
  );
  const visibleImages = useMemo(
    () => visiblePreparedImages(preparedImages, visibleDepthSpan, CORE_IMAGE_OVERSCAN_DEPTH),
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
      {visibleImages.map((preparedImage) => {
        const { image, fromDepth, toDepth } = preparedImage;
        const renderModel = resolveCoreImageRenderModel(preparedImage, scale);
        if (!renderModel) return null;

        const shouldLoadImage = canLoadCoreImage(renderModel, loadDepthSpan);
        const canShowImage = canShowPreparedCoreImage(image);
        const displayUrl = shouldLoadImage ? coreImageDisplayUrl(image, renderModel.mode) : null;
        const overviewLaneCount = stripLaneCount(image.strip_metadata);
        return (
          <button
            type="button"
            className={`core-strip core-strip-${renderModel.mode} core-strip-${renderModel.assetKind} ${shouldLoadImage && canShowImage ? "loaded" : "deferred"}`}
            key={image.box_number}
            style={scale.intervalToStyle(renderModel.displayFromDepth, renderModel.displayToDepth)}
            aria-label={`Open corebox ${image.box_number}, ${fromDepth.toFixed(1)} to ${toDepth.toFixed(1)} meters`}
            title={`Open corebox ${image.box_number}`}
          >
            {!shouldLoadImage ? (
              <span
                className="core-strip-overview"
                style={{ "--core-lane-count": overviewLaneCount } as CSSProperties}
                aria-hidden="true"
              >
                {Array.from({ length: overviewLaneCount }, (_, index) => (
                  <span className="core-strip-overview-lane" key={index} />
                ))}
              </span>
            ) : canShowImage && displayUrl ? (
              <img
                className={renderModel.imageClassName}
                src={displayUrl}
                alt={`Depth-aligned rock lane ${image.box_number}`}
                loading="lazy"
                decoding="async"
                draggable={false}
                width={stripDimension(image.strip_metadata, "strip_width_px")}
                height={stripDimension(image.strip_metadata, "strip_height_px")}
                style={{
                  top: `${-renderModel.imageOffsetPercent}%`,
                  height: `${renderModel.imageScalePercent}%`,
                }}
              />
            ) : (
              <span className="core-strip-placeholder">Prepare lane</span>
            )}
          </button>
        );
      })}
    </TrackFrame>
  );
}
