import type {
  BoreholeAiSummary,
  BoreholeWorkbench,
  CoreImage,
  ExportJob,
  ExportReadiness,
  ImportProfile,
  LithologyInterval,
  DisplayLayout,
  DisplayWidget,
} from "../../../api/types";
import type { UserPreferences } from "../../../preferences/userPreferences";

export type DisplayRuntimeProps = {
  data: BoreholeWorkbench;
  aiSummary?: BoreholeAiSummary;
  aiProvider?: Record<string, unknown>;
  exportReadiness?: ExportReadiness;
  exportJobs?: ExportJob[];
  importProfiles?: ImportProfile[];
  selectedInterval: LithologyInterval | null;
  selectedCoreImage: CoreImage | null;
  validationRunning: boolean;
  aiGenerating: boolean;
  aiActing: boolean;
  exportCreating: boolean;
  exportApproving: boolean;
  sourceRegistering: boolean;
  sourceUploading: boolean;
  sourceProcessing: boolean;
  sourceImporting: boolean;
  sourceMerging: boolean;
  intervalSaving: boolean;
  preferences: UserPreferences;
  onRunValidation: () => void;
  onGenerateAi: () => void;
  onAcceptSuggestion: (suggestionId: number) => void;
  onRejectSuggestion: (suggestionId: number) => void;
  onCreateExport: (exportType: string) => void;
  onApproveExport: () => void;
  onRegisterSourceFile: (payload: {
    file_type: string;
    original_name: string;
    storage_path?: string;
    file_metadata?: Record<string, unknown>;
  }) => void;
  onUploadSourceFile: (payload: { file_type: string; file: File }) => void;
  onProcessSourceFile: (sourceFileId: number) => void;
  onImportBoreholeFile: (sourceFileId: number) => void;
  onMergeSourceFile: (sourceFileId: number) => void;
  onSaveInterval: (intervalId: string, patch: Partial<LithologyInterval>) => void;
  onSelectImage: (image: CoreImage) => void;
  runtimeLayoutSaving?: boolean;
  runtimeLayoutCloning?: boolean;
  onSaveRuntimeLayout?: (layout: DisplayLayout) => void;
  onCloneRuntimeLayout?: (layout: DisplayLayout) => void;
  onPreviewRuntimeWidget?: (widgetId: string, widget: DisplayWidget, message: string) => void;
  onDiscardRuntimePreview?: () => void;
  runtimePreviewWidgetIds?: Set<string>;
};
