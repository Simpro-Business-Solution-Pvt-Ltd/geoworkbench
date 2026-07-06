import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import type { LogTrackContext } from "../../core/logTrackContext";
import { TrackFrame } from "../../core/TrackFrame";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

export function ImageTrack({ data, track, context }: Props) {
  const { scale } = context;
  const fullStripFitHeight = 140;
  const visibleImages = data.core_images.filter(
    (image) =>
      (image.to_depth ?? image.from_depth ?? 0) >= scale.fromDepth &&
      (image.from_depth ?? image.to_depth ?? 0) <= scale.toDepth,
  );

  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="image-track"
      hitTest={({ depth }) => {
        const image = data.core_images.find((item) => {
          const fromDepth = item.from_depth ?? item.to_depth;
          const toDepth = item.to_depth ?? item.from_depth;
          if (fromDepth === null || toDepth === null) {
            return false;
          }
          const lowerBound = Math.min(fromDepth, toDepth);
          const upperBound = Math.max(fromDepth, toDepth);
          return lowerBound <= depth && depth <= upperBound;
        });
        if (image) {
          return {
            kind: "core-image",
            id: `core-image:${image.box_number}`,
            depth,
            image,
          };
        }
        const orderedImages = [...data.core_images].sort((a, b) => {
          const aFrom = a.from_depth ?? a.to_depth ?? 0;
          const aTo = a.to_depth ?? a.from_depth ?? 0;
          const bFrom = b.from_depth ?? b.to_depth ?? 0;
          const bTo = b.to_depth ?? b.from_depth ?? 0;
          const aDepth = Math.min(aFrom, aTo);
          const bDepth = Math.min(bFrom, bTo);
          return Math.abs(aDepth - depth) - Math.abs(bDepth - depth);
        });
        return orderedImages[0]
          ? {
              kind: "core-image",
              id: `core-image:${orderedImages[0].box_number}`,
              depth,
              image: orderedImages[0],
            }
          : null;
      }}
    >
      {visibleImages.map((image) => {
        const fromDepth = image.from_depth ?? 0;
        const toDepth = image.to_depth ?? fromDepth + 1;
        const visibleFromDepth = Math.max(fromDepth, scale.fromDepth);
        const visibleToDepth = Math.min(toDepth, scale.toDepth);
        if (visibleToDepth <= visibleFromDepth) return null;

        const intervalHeight = Math.max(1, scale.depthToY(visibleToDepth) - scale.depthToY(visibleFromDepth));
        const canShowFullStrip = intervalHeight >= fullStripFitHeight;

        const intervalSpan = Math.max(0.001, toDepth - fromDepth);
        const visibleSpan = Math.max(0.001, visibleToDepth - visibleFromDepth);
        const imageOffsetPercent = ((visibleFromDepth - fromDepth) / intervalSpan) * 100;
        const imageScalePercent = (intervalSpan / visibleSpan) * 100;
        const imageClassName = canShowFullStrip ? "core-strip-img core-strip-img-full" : "core-strip-img core-strip-img-crop";
        return (
          <button
            type="button"
            className="core-strip"
            key={image.box_number}
            style={scale.intervalToStyle(visibleFromDepth, visibleToDepth)}
            aria-label={`Open corebox ${image.box_number}, ${fromDepth.toFixed(1)} to ${toDepth.toFixed(1)} meters`}
            title={`Open corebox ${image.box_number}`}
          >
            {image.strip_url ? (
              <img
                className={imageClassName}
                src={image.strip_url}
                alt={`Depth-arranged core strip ${image.box_number}`}
                style={{
                  top: `${-imageOffsetPercent}%`,
                  height: `${imageScalePercent}%`,
                }}
              />
            ) : (
              <CoreLaneStack imageUrl={image.url} boxNumber={image.box_number} />
            )}
          </button>
        );
      })}
    </TrackFrame>
  );
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
