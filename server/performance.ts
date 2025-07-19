// Server-side performance optimizations

export class CacheManager {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = 5 * 60 * 1000) { // Default 5 minutes
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

export const cache = new CacheManager();

// Performance monitoring
export const performanceMonitor = {
  startTime: (label: string) => {
    console.time(label);
  },

  endTime: (label: string) => {
    console.timeEnd(label);
  },

  logMemoryUsage: () => {
    const used = process.memoryUsage();
    console.log('Memory usage:', {
      rss: Math.round(used.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(used.external / 1024 / 1024) + ' MB'
    });
  }
};

// Database query optimization
export const optimizeQuery = <T>(
  queryFn: () => Promise<T>,
  cacheKey: string,
  ttl: number = 2 * 60 * 1000 // 2 minutes default
): Promise<T> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log(`Cache HIT for key: ${cacheKey}`);
        resolve(cached);
        return;
      }

      // Execute query and cache result
      console.log(`Cache MISS for key: ${cacheKey} - executing query`);
      const startTime = Date.now();
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      console.log(`Query executed in ${duration}ms for key: ${cacheKey}`);
      cache.set(cacheKey, result, ttl);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
};

// Request batching utility
export class RequestBatcher {
  private batches = new Map<string, { requests: Function[]; timer: NodeJS.Timeout }>();
  private batchDelay: number;

  constructor(batchDelay: number = 100) {
    this.batchDelay = batchDelay;
  }

  batch(key: string, requestFn: Function) {
    if (!this.batches.has(key)) {
      this.batches.set(key, {
        requests: [],
        timer: setTimeout(() => this.executeBatch(key), this.batchDelay)
      });
    }

    const batch = this.batches.get(key)!;
    batch.requests.push(requestFn);
  }

  private async executeBatch(key: string) {
    const batch = this.batches.get(key);
    if (!batch) return;

    console.log(`Executing batch for ${key} with ${batch.requests.length} requests`);
    
    try {
      await Promise.all(batch.requests.map(fn => fn()));
    } catch (error) {
      console.error(`Batch execution failed for ${key}:`, error);
    }

    this.batches.delete(key);
  }
}

export const batcher = new RequestBatcher();