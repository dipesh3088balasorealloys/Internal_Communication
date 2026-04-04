interface RateLimitEntry {
  timestamps: number[];
}

const rateLimits = new Map<string, RateLimitEntry>();

// Clean up stale entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60000);
    if (entry.timestamps.length === 0) rateLimits.delete(key);
  }
}, 60000);

export function checkRateLimit(
  userId: string,
  event: string,
  maxEvents: number,
  windowMs: number
): { allowed: boolean; retryAfterMs?: number } {
  const key = `${userId}:${event}`;
  const now = Date.now();
  const entry = rateLimits.get(key) || { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxEvents) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return { allowed: false, retryAfterMs };
  }

  entry.timestamps.push(now);
  rateLimits.set(key, entry);
  return { allowed: true };
}
