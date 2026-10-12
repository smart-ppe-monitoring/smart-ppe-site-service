import { ConfigResolutionSource } from "./safety-rule.constant";

export interface UpdateSiteSafetyConfigDto {
  confidenceThreshold?: number;
  confirmationDuration?: number;
  cooldownDuration?: number;
  enableNoHelmet?: boolean;
  enableNoVest?: boolean;
  enableRestrictedArea?: boolean;
  modelVersionId?: string | null;
}

export interface UpdateCameraSafetyConfigDto {
  confidenceThreshold?: number | null;
  confirmationDuration?: number | null;
  cooldownDuration?: number | null;
  enableNoHelmet?: boolean | null;
  enableNoVest?: boolean | null;
  enableRestrictedArea?: boolean | null;
  modelVersionId?: string | null;
}

export interface EffectiveSafetyConfigQueryDto {
  siteId?: string;
  cameraId?: string;
}

export interface ResolvedAiModelVersionDto {
  id: string;
  modelId: string;
  modelName: string;
  modelCode: string;
  version: string;
  framework: string;
  inputSize: string;
  status: string;
  metrics: unknown;
}

export interface ResolvedRestrictedAreaDto {
  id: string;
  name: string;
  zoneId: string | null;
  boundary: unknown;
  status: string;
}

export interface EffectiveSafetyConfigResultDto {
  siteId: string;
  siteName: string | null;
  siteCode: string | null;
  cameraId: string | null;
  cameraName: string | null;
  cameraCode: string | null;
  confidenceThreshold: number;
  confirmationDuration: number;
  cooldownDuration: number;
  rules: {
    enableNoHelmet: boolean;
    enableNoVest: boolean;
    enableRestrictedArea: boolean;
  };
  modelVersion: ResolvedAiModelVersionDto | null;
  restrictedAreas: ResolvedRestrictedAreaDto[];
  source: ConfigResolutionSource;
  resolvedAt: string;
}

export interface SiteSafetyConfigItemDto {
  id: string;
  siteId: string;
  confidenceThreshold: number;
  confirmationDuration: number;
  cooldownDuration: number;
  enableNoHelmet: boolean;
  enableNoVest: boolean;
  enableRestrictedArea: boolean;
  modelVersionId: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CameraSafetyConfigItemDto {
  id: string;
  cameraId: string;
  confidenceThreshold: number | null;
  confirmationDuration: number | null;
  cooldownDuration: number | null;
  enableNoHelmet: boolean | null;
  enableNoVest: boolean | null;
  enableRestrictedArea: boolean | null;
  modelVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}
