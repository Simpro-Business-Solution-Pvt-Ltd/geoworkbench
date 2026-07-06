import { create } from "zustand";

import type { AiSuggestion, CoreImage, LithologyInterval } from "../../api/types";
import type { TrackObject } from "../core/trackObject";

export type TrackContextMenu = {
  trackId: string;
  trackType: string;
  depth: number;
  object: TrackObject;
  x: number;
  y: number;
};

export type WorkbenchActions = {
  setSelectedInterval: (interval: LithologyInterval | null) => void;
  setSelectedDepth: (depth: number | null) => void;
  setSelectedImage: (image: CoreImage | null) => void;
  setSelectedRemarkGroup: (group: Extract<TrackObject, { kind: "remark-group" }> | null) => void;
  setSelectedAiSuggestion: (suggestion: AiSuggestion | null) => void;
  setHoveredObject: (object: TrackObject | null) => void;
  setContextMenu: (contextMenu: TrackContextMenu | null) => void;
  setTooltipsEnabled: (tooltipsEnabled: boolean) => void;
  setMode: (mode: "runtime" | "edit") => void;
};

type WorkbenchState = {
  selectedInterval: LithologyInterval | null;
  selectedDepth: number | null;
  selectedImage: CoreImage | null;
  selectedRemarkGroup: Extract<TrackObject, { kind: "remark-group" }> | null;
  selectedAiSuggestion: AiSuggestion | null;
  hoveredObject: TrackObject | null;
  contextMenu: TrackContextMenu | null;
  tooltipsEnabled: boolean;
  mode: "runtime" | "edit";
} & WorkbenchActions;

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  selectedInterval: null,
  selectedDepth: null,
  selectedImage: null,
  selectedRemarkGroup: null,
  selectedAiSuggestion: null,
  hoveredObject: null,
  contextMenu: null,
  tooltipsEnabled: true,
  mode: "runtime",
  setSelectedInterval: (selectedInterval) => set({ selectedInterval }),
  setSelectedDepth: (selectedDepth) => set({ selectedDepth }),
  setSelectedImage: (selectedImage) => set({ selectedImage }),
  setSelectedRemarkGroup: (selectedRemarkGroup) => set({ selectedRemarkGroup }),
  setSelectedAiSuggestion: (selectedAiSuggestion) => set({ selectedAiSuggestion }),
  setHoveredObject: (hoveredObject) => set({ hoveredObject }),
  setContextMenu: (contextMenu) => set({ contextMenu }),
  setTooltipsEnabled: (tooltipsEnabled) =>
    set((state) => ({
      tooltipsEnabled,
      hoveredObject: tooltipsEnabled ? state.hoveredObject : null,
    })),
  setMode: (mode) => set({ mode }),
}));
