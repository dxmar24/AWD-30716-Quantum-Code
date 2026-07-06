class CacheService {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return { hit:false };
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return { hit:false };
    }
    return {
      hit:true,
      value:entry.value,
      ttlSeconds:Math.max(0, Math.ceil((entry.expiresAt - this.now()) / 1000)),
    };
  }

  set(key, value, ttlSeconds, tags = []) {
    this.store.set(key, {
      value,
      tags:new Set(tags),
      expiresAt:this.now() + ttlSeconds * 1000,
    });
    return value;
  }

  async remember(key, ttlSeconds, tags, loader) {
    const cached = this.get(key);
    if (cached.hit) return { ...cached, status:'HIT' };
    const value = await loader();
    this.set(key, value, ttlSeconds, tags);
    return { hit:false, status:'MISS', value, ttlSeconds };
  }

  invalidateTags(tags = []) {
    const tagSet = new Set(tags);
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if ([...entry.tags].some((tag) => tagSet.has(tag))) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear() {
    const size = this.store.size;
    this.store.clear();
    return size;
  }
}

function actorCacheScope(actor) {
  if (!actor) return 'anonymous';
  return `${actor.role || 'unknown'}:${actor.id || actor.email || 'unknown'}`;
}

function setMemoryCacheHeaders(res, result, key) {
  res.set('X-Memory-Cache', result.status || 'BYPASS');
  if (key) res.set('X-Memory-Cache-Key', key);
  if (Number.isFinite(result.ttlSeconds)) res.set('X-Memory-Cache-TTL', String(result.ttlSeconds));
}

module.exports = { CacheService, actorCacheScope, setMemoryCacheHeaders };
