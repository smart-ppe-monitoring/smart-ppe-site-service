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

  invalidateCamera(cameraId?: string, isRemote = false): void {
    if (!cameraId) return;
    for (const key of this.cache.keys()) {
      if (key.includes(cameraId)) {
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
    if (!isRemote) {
      this.broadcastInvalidation({
        type: "CLEAR",
        senderId: this.instanceId,
      });
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
