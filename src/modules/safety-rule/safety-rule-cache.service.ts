import { EffectiveSafetyConfigResultDto } from "./safety-rule.dto";
import { SAFETY_RULE_CACHE_CONFIG } from "./safety-rule.constant";

interface CacheEntry {
  data: EffectiveSafetyConfigResultDto;
  expiresAt: number;
}

export class SafetyRuleCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = SAFETY_RULE_CACHE_CONFIG.DEFAULT_TTL_MS) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): EffectiveSafetyConfigResultDto | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(
    key: string,
    data: EffectiveSafetyConfigResultDto,
    ttlMs = this.defaultTtlMs,
  ): void {
    if (this.cache.size >= SAFETY_RULE_CACHE_CONFIG.MAX_ENTRIES) {
      // Dọn dẹp các bản ghi hết hạn trước
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (now > v.expiresAt) {
          this.cache.delete(k);
        }
      }
      // Nếu vẫn đầy, xóa phần tử cũ nhất
      if (this.cache.size >= SAFETY_RULE_CACHE_CONFIG.MAX_ENTRIES) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  getForCamera(cameraId?: string): EffectiveSafetyConfigResultDto | null {
    if (!cameraId) return null;
    for (const key of this.cache.keys()) {
      if (key.includes(cameraId)) {
        return this.get(key);
      }
    }
    return null;
  }

  invalidateCamera(cameraId?: string): void {
    if (!cameraId) return;
    for (const key of this.cache.keys()) {
      if (key.includes(cameraId)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateSite(siteId?: string): void {
    if (!siteId) return;
    for (const key of this.cache.keys()) {
      if (key.includes(siteId)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const safetyRuleCacheService = new SafetyRuleCacheService();
