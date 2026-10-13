import { envConfig } from "../config/env.config";
import { ResolvedAiModelVersionDto } from "../modules/safety-rule/safety-rule.dto";

/**
 * ReportingServiceClient — Inter-Service HTTP Client kết nối tới Reporting Microservice (:8894)
 *
 * Tuân thủ Clean Architecture & Database-per-Service:
 * - Không import Prisma Client của Reporting Service
 * - Lấy Base URL động từ envConfig.reporting.serviceUrl
 * - Cung cấp timeout, logging và graceful fallback an toàn
 */
export class ReportingServiceClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl?: string, timeoutMs = 5000) {
    this.baseUrl = (baseUrl || envConfig.reporting.serviceUrl).replace(/\/+$/, "");
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
        console.warn(`[ReportingClient] Request to ${url} failed with status ${res.status}`);
        return null;
      }

      const body = (await res.json()) as any;
      return (body?.data ?? body) as T;
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || String(err);
      console.warn(`[ReportingClient] Failed to communicate with Reporting Service (${url}):`, errorMsg);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Tra cứu phiên bản AI Model đã triển khai (Active Deployed Version) hoặc theo modelVersionId cụ thể
   */
  async findActiveModelVersion(
    modelVersionId?: string | null,
  ): Promise<ResolvedAiModelVersionDto | null> {
    const endpoint = modelVersionId
      ? `/api/v1/ai-models/versions/${modelVersionId}`
      : `/api/v1/ai-models/active-version`;

    const result = await this.request<ResolvedAiModelVersionDto>(endpoint);
    if (result) return result;

    // Nếu tìm kiếm theo modelVersionId cụ thể mà không thấy -> trả về null để báo lỗi không tồn tại
    if (modelVersionId) {
      return null;
    }

    // Graceful Fallback CHỈ dành cho trường hợp lấy Active Deployed Version mặc định khi Reporting Service tạm thời offline
    return {
      id: "0192e210-0000-7000-8000-000000000001",
      modelId: "model-1",
      modelName: "PPE YOLO11 Detector",
      modelCode: "YOLO_PPE",
      version: "1.0.0",
      framework: "PyTorch",
      inputSize: "640x640",
      status: "DEPLOYED",
      metrics: { mAP50: 0.9307 },
    };
  }
}

export const reportingServiceClient = new ReportingServiceClient();
