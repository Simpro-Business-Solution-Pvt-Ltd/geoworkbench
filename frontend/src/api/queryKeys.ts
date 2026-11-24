export const queryKeys = {
  authSession: ["authSession"] as const,
  fieldAuthSession: ["fieldAuthSession"] as const,
  boreholes: ["boreholes"] as const,
  importProfiles: ["importProfiles"] as const,
  exportProfiles: ["exportProfiles"] as const,
  diagnosticsHealth: ["diagnosticsHealth"] as const,
  aiProvider: ["aiProvider"] as const,
  roles: ["roles"] as const,
  permissions: ["permissions"] as const,
  users: ["users"] as const,
  qualitySettings: ["qualitySettings"] as const,
  workbenchRoot: ["workbench"] as const,
  workbench: (boreholeId: number | null | undefined, layoutId: number | null = null) =>
    ["workbench", boreholeId, layoutId] as const,
  curveSamplesRoot: (boreholeId: number | null | undefined) =>
    ["curveSamples", boreholeId] as const,
  aiSummaryRoot: ["aiSummary"] as const,
  aiSummary: (boreholeId: number | null | undefined) => ["aiSummary", boreholeId] as const,
  exportReadinessRoot: ["exportReadiness"] as const,
  exportReadiness: (boreholeId: number | null | undefined) =>
    ["exportReadiness", boreholeId] as const,
  exportJobs: (boreholeId: number | null | undefined) => ["exportJobs", boreholeId] as const,
  roleAccess: (roleKey: string) => ["roleAccess", roleKey] as const,
  correlationObservations: (setKey: string) => ["correlation-observations", setKey] as const,
  correlationAiRoot: ["correlation-ai-summary"] as const,
  correlationAi: (setKey: string, seamName: string, alignMode: string) =>
    ["correlation-ai-summary", setKey, seamName, alignMode] as const,
};
