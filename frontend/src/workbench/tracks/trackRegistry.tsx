import type { ReactNode } from "react";

import type { BoreholeWorkbench, DisplayTrack } from "../../api/types";
import type { LogTrackContext } from "../core/logTrackContext";
import { AiSuggestionsTrack } from "./aiSuggestions/AiSuggestionsTrack";
import { CurveTrack } from "./curve/CurveTrack";
import { DepthTrack } from "./depth/DepthTrack";
import { ImageTrack } from "./images/ImageTrack";
import { LithologyTrack } from "./lithology/LithologyTrack";
import { QuantitativeBarTrack } from "./quantitativeBar/QuantitativeBarTrack";
import { RemarksTrack } from "./remarks/RemarksTrack";
import { SeamTrack } from "./seam/SeamTrack";

type TrackRenderArgs = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

export type TrackDefinition = {
  type: string;
  label: string;
  render: (args: TrackRenderArgs) => ReactNode;
};

const TRACK_DEFINITIONS: TrackDefinition[] = [
  {
    type: "depthAxis",
    label: "Depth",
    render: ({ data, track, context }) => <DepthTrack data={data} track={track} context={context} />,
  },
  {
    type: "lithology",
    label: "Lithology",
    render: ({ data, track, context }) => <LithologyTrack data={data} track={track} context={context} />,
  },
  {
    type: "seam",
    label: "Seam",
    render: ({ data, track, context }) => <SeamTrack data={data} track={track} context={context} />,
  },
  {
    type: "images",
    label: "Core Images",
    render: ({ data, track, context }) => <ImageTrack data={data} track={track} context={context} />,
  },
  {
    type: "curve",
    label: "Curve",
    render: ({ data, track, context }) => <CurveTrack data={data} track={track} context={context} />,
  },
  {
    type: "quantitativeBar",
    label: "Quantitative Bar",
    render: ({ data, track, context }) => <QuantitativeBarTrack data={data} track={track} context={context} />,
  },
  {
    type: "remarks",
    label: "Remarks",
    render: ({ data, track, context }) => <RemarksTrack data={data} track={track} context={context} />,
  },
  {
    type: "aiSuggestions",
    label: "AI Suggestions",
    render: ({ data, track, context }) => <AiSuggestionsTrack data={data} track={track} context={context} />,
  },
];

const trackDefinitionsByType = new Map(TRACK_DEFINITIONS.map((definition) => [definition.type, definition]));

export function getTrackDefinition(type: string) {
  return trackDefinitionsByType.get(type) ?? null;
}

export function renderRegisteredTrack(data: BoreholeWorkbench, track: DisplayTrack, context: LogTrackContext) {
  const definition = getTrackDefinition(track.type);
  if (definition) {
    return <TrackRegistryBoundary key={track.id}>{definition.render({ data, track, context })}</TrackRegistryBoundary>;
  }
  return (
    <div key={track.id} className="track track-unknown" style={{ width: context.widthForTrack(track) }}>
      <div className="track-title" style={{ height: context.headerHeight }}>{track.title || track.type}</div>
      <div className="track-body" style={{ top: context.headerHeight }}>
        <div className="empty">Unsupported track type: {track.type}</div>
      </div>
    </div>
  );
}

function TrackRegistryBoundary({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
