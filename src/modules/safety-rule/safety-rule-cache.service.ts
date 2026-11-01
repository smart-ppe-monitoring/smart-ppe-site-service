import { EffectiveSafetyConfigResultDto } from "./safety-rule.dto";
import { SAFETY_RULE_CACHE_CONFIG } from "./safety-rule.constant";
import { getSharedRateLimitRedisClient } from "../../middlewares/rate-limit.middleware";

export const SAFETY_RULE_CACHE_PUBSUB_CHANNEL = "safety_rule:cache:invalidate";

export interface CacheInvalidationMessage {
  type: "SITE" | "CAMERA" | "CLEAR";
  id?: string;
  senderId?: string;
}

interface CacheEntry {
  data: EffectiveSafetyConfigResultDto;
  expiresAt: number;
}

export class SafetyRuleCacheService {
  private cache = new Map<string, CacheEntry>();
  private cameraIndex = new Map<string, string>();
  private readonly defaultTtlMs: number;
  private readonly instanceId: string = Math.random().toString(36).substring(2, 10);
  private publisherClient: any = null;
  private subscriberClient: any = null;

  constructor(defaultTtlMs = SAFETY_RULE_CACHE_CONFIG.DEFAULT_TTL_MS) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): EffectiveSafetyConfigResultDto | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.cleanCameraIndexKey(key);
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
          this.cleanCameraIndexKey(k);
        }
      }
      // Nếu vẫn đầy, xóa phần tử cũ nhất
      if (this.cache.size >= SAFETY_RULE_CACHE_CONFIG.MAX_ENTRIES) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
          this.cleanCameraIndexKey(firstKey);
        }
      }
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });

    // SEC-35: Lập chỉ mục camera O(1) để tránh O(N) linear traversal và substring collision
    const cameraMatch = key.match(/:camera:([^:]+)$/);
    if (cameraMatch && cameraMatch[1]) {
      this.cameraIndex.set(cameraMatch[1], key);
    }
  }

  /**
   * SEC-35: Truy xuất cấu hình hiệu lực của camera theo O(1) index,
   * sử dụng exact regex matching thay vì substring key.includes(cameraId).
   */
  getForCamera(cameraId?: string): EffectiveSafetyConfigResultDto | null {
    if (!cameraId) return null;

    // 1. O(1) Direct Index Lookup
    const indexedKey = this.cameraIndex.get(cameraId);
    if (indexedKey) {
      const cached = this.get(indexedKey);
      if (cached) return cached;
      this.cameraIndex.delete(cameraId);
    }

    // 2. Fallback: Exact anchored regex match (:camera:${cameraId}$) để chống collision
    const cameraPattern = new RegExp(`:camera:${cameraId}$`);
    for (const key of this.cache.keys()) {
      if (cameraPattern.test(key)) {
        this.cameraIndex.set(cameraId, key);
        return this.get(key);
      }
    }
    return null;
  }

  /**
   * SEC-35: Vô hiệu hóa cache camera chính xác qua chỉ mục và exact regex match
   */
  invalidateCamera(cameraId?: string, isRemote = false): void {
    if (!cameraId) return;

    // 1. Xóa theo O(1) index
    const indexedKey = this.cameraIndex.get(cameraId);
    if (indexedKey) {
      this.cache.delete(indexedKey);
      this.cameraIndex.delete(cameraId);
    }

    // 2. Quét dọn các key khớp exact pattern :camera:${cameraId}$
    const cameraPattern = new RegExp(`:camera:${cameraId}$`);
    for (const key of this.cache.keys()) {
      if (cameraPattern.test(key)) {
        this.cache.delete(key);
      }
    }

    if (!isRemote) {
      this.broadcastInvalidation({
        type: "CAMERA",
        id: cameraId,
        senderId: this.instanceId,
      });
    }
  }

  invalidateSite(siteId?: string, isRemote = false): void {
    if (!siteId) return;
    for (const key of this.cache.keys()) {
      if (key.includes(siteId)) {
        this.cache.delete(key);
        this.cleanCameraIndexKey(key);
      }
    }
    if (!isRemote) {
      this.broadcastInvalidation({
        type: "SITE",
        id: siteId,
        senderId: this.instanceId,
      });
    }
  }

  clear(isRemote = false): void {
    this.cache.clear();
    this.cameraIndex.clear();
    if (!isRemote) {
      this.broadcastInvalidation({
        type: "CLEAR",
        senderId: this.instanceId,
      });
    }
  }

  private cleanCameraIndexKey(key: string): void {
    for (const [camId, k] of this.cameraIndex.entries()) {
      if (k === key) {
        this.cameraIndex.delete(camId);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  setPublisherClient(client: any): void {
    this.publisherClient = client;
  }

  setSubscriberClient(client: any): void {
    this.subscriberClient = client;
    this.setupSubscriber(client);
  }

  initPubSub(subscriber: any, publisher?: any): void {
    this.subscriberClient = subscriber;
    if (publisher) this.publisherClient = publisher;
    this.setupSubscriber(subscriber);
  }

  private setupSubscriber(subscriber: any): void {
    if (!subscriber) return;
    try {
      if (typeof subscriber.subscribe === "function") {
        subscriber.subscribe(SAFETY_RULE_CACHE_PUBSUB_CHANNEL);
      }
      if (typeof subscriber.on === "function") {
        subscriber.on("message", (channel: string, message: string) => {
          if (channel === SAFETY_RULE_CACHE_PUBSUB_CHANNEL) {
            this.handleRemoteInvalidation(message);
          }
        });
      }
    } catch {
      // Ignore subscriber initialization errors
    }
  }

  public broadcastInvalidation(message: CacheInvalidationMessage): void {
    try {
      const pub = this.publisherClient ?? getSharedRateLimitRedisClient();
      if (pub && typeof pub.publish === "function") {
        void pub
          .publish(SAFETY_RULE_CACHE_PUBSUB_CHANNEL, JSON.stringify(message))
          .catch(() => {});
      }
    } catch {
      // Ignore publish failures during network hiccups
    }
  }

  public handleRemoteInvalidation(payloadString: string): void {
    try {
      const message: CacheInvalidationMessage = JSON.parse(payloadString);
      if (message.senderId && message.senderId === this.instanceId) {
        return; // Ignore messages originating from this exact service instance
      }
      if (message.type === "SITE" && message.id) {
        this.invalidateSite(message.id, true);
      } else if (message.type === "CAMERA" && message.id) {
        this.invalidateCamera(message.id, true);
      } else if (message.type === "CLEAR") {
        this.clear(true);
      }
    } catch {
      // Ignore malformed payloads
    }
  }
}

export const safetyRuleCacheService = new SafetyRuleCacheService();
