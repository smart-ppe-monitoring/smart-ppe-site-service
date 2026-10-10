import {
  SiteStatus,
  ZoneStatus,
  RestrictedAreaStatus,
} from "../../common/constants/site.constant";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResultDto<T> {
  data: T[];
  items?: T[];
  meta: PaginationMeta;
}


// ── Site DTOs ────────────────────────────────────────────────────────────────
export interface CreateSiteDto {
  name: string;
  code: string;
  address?: string;
  description?: string;
  status?: SiteStatus;
  startDate?: string | Date;
  endDate?: string | Date;
}

export interface UpdateSiteDto {
  name?: string;
  code?: string;
  address?: string;
  description?: string;
  status?: SiteStatus;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}

export interface SiteQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: SiteStatus;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ── Zone DTOs ────────────────────────────────────────────────────────────────
export interface CreateZoneDto {
  siteId: string;
  name: string;
  code: string;
  description?: string;
  status?: ZoneStatus;
}

export interface UpdateZoneDto {
  name?: string;
  code?: string;
  description?: string;
  status?: ZoneStatus;
}

export interface ZoneQueryDto {
  siteId?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: ZoneStatus;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ── Safety Config DTOs ───────────────────────────────────────────────────────
export interface UpdateSiteSafetyConfigDto {
  confidenceThreshold?: number;
  confirmationDuration?: number;
  cooldownDuration?: number;
  enableNoHelmet?: boolean;
  enableNoVest?: boolean;
  enableRestrictedArea?: boolean;
  updatedBy?: string;
}

// ── Restricted Area DTOs ─────────────────────────────────────────────────────
export interface PointDto {
  x: number;
  y: number;
}

export interface CreateRestrictedAreaDto {
  siteId: string;
  zoneId?: string | null;
  name: string;
  description?: string;
  boundary: PointDto[] | any;
  status?: RestrictedAreaStatus;
}

export interface UpdateRestrictedAreaDto {
  zoneId?: string | null;
  name?: string;
  description?: string;
  boundary?: PointDto[] | any;
  status?: RestrictedAreaStatus;
}

export interface RestrictedAreaQueryDto {
  siteId?: string;
  zoneId?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: RestrictedAreaStatus;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
