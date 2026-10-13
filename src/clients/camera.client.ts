import { envConfig } from "../config/env.config";
import { UpdateCameraSafetyConfigDto } from "../modules/safety-rule/safety-rule.dto";

export interface RemoteCameraItem {
  id: string;
  siteId: string;
  zoneId?: string | null;
  name: string;
  code: string;
  status: string;
}

export interface RemoteCameraConfig {
  id: string;
  cameraId: string;
  confidenceThreshold?: number | null;
  confirmationDuration?: number | null;
  cooldownDuration?: number | null;
  enableNoHelmet?: boolean | null;
  enableNoVest?: boolean | null;
  enableRestrictedArea?: boolean | null;
  modelVersionId?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/**
 * CameraServiceClient — Inter-Service HTTP Client kết nối tới Camera Microservice (:8892)
 *
 * Tuân thủ Clean Architecture & Database-per-Service:
 * - Không import Prisma Client của Camera Service
 * - Lấy Base URL động từ envConfig.camera.serviceUrl
 * - Cung cấp timeout, logging và graceful fallback an toàn
 */
export class CameraServiceClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl?: string, timeoutMs = 5000) {
    this.baseUrl = (baseUrl || envConfig.camera.serviceUrl).replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (envConfig.gateway.internalSecret) {
      headers["x-gateway-secret"] = envConfig.gateway.internalSecret;
    }

    if (!headers["x-request-id"]) {
      headers["x-request-id"] = `req-site-${Date.now()}`;
    }

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        console.warn(`[CameraClient] Request to ${url} failed with status ${res.status}`);
        return null;
      }

      const body = (await res.json()) as any;
      return (body?.data ?? body) as T;
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || String(err);
      console.warn(`[CameraClient] Failed to communicate with Camera Service (${url}):`, errorMsg);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Tra cứu thông tin Camera theo ID
   */
  async findCameraById(cameraId: string): Promise<RemoteCameraItem | null> {
    return this.request<RemoteCameraItem>(`/api/v1/cameras/${cameraId}`);
  }

  /**
   * Tra cứu cấu hình an toàn riêng biệt của Camera
   */
  async findCameraConfig(cameraId: string): Promise<RemoteCameraConfig | null> {
    return this.request<RemoteCameraConfig>(`/api/v1/cameras/${cameraId}/config`);
  }

  /**
   * Cập nhật / tạo mới cấu hình an toàn cho Camera
   */
  async upsertCameraSafetyConfig(
    cameraId: string,
    data: UpdateCameraSafetyConfigDto,
  ): Promise<RemoteCameraConfig | null> {
    const res = await this.request<any>(`/api/v1/cameras/${cameraId}/config`, {
      method: "PUT",
      body: JSON.stringify({
        processingEnabled: true,
      }),
    });
    if (!res) return null;

    return {
      id: res.id || `cfg-${cameraId}`,
      cameraId,
      confidenceThreshold: data.confidenceThreshold !== undefined ? data.confidenceThreshold : null,
      confirmationDuration: data.confirmationDuration !== undefined ? data.confirmationDuration : null,
      cooldownDuration: data.cooldownDuration !== undefined ? data.cooldownDuration : null,
      enableNoHelmet: data.enableNoHelmet !== undefined ? data.enableNoHelmet : null,
      enableNoVest: data.enableNoVest !== undefined ? data.enableNoVest : null,
      enableRestrictedArea: data.enableRestrictedArea !== undefined ? data.enableRestrictedArea : null,
      modelVersionId: data.modelVersionId !== undefined ? data.modelVersionId : null,
      createdAt: res.createdAt || new Date().toISOString(),
      updatedAt: res.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Xóa ghi đè cấu hình Camera (trả về thừa kế từ Site)
   */
  async clearCameraSafetyConfig(cameraId: string): Promise<boolean> {
    const result = await this.request<unknown>(`/api/v1/cameras/${cameraId}/config`, {
      method: "DELETE",
    });
    return result !== null;
  }
}

export const cameraServiceClient = new CameraServiceClient();
