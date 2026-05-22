const buckets = new Map();

function sweepExpired(key, windowMs) {
  const now = Date.now();
  const entries = buckets.get(key) || [];
  const activeEntries = entries.filter((timestamp) => now - timestamp < windowMs);

  if (activeEntries.length) {
    buckets.set(key, activeEntries);
  } else {
    buckets.delete(key);
  }

  return activeEntries;
}

function checkRateLimit(key, { limit, windowMs }) {
  const activeEntries = sweepExpired(key, windowMs);

  if (activeEntries.length >= limit) {
    return {
      allowed: false,
      retryAfterMs: windowMs - (Date.now() - activeEntries[0])
    };
  }

  activeEntries.push(Date.now());
  buckets.set(key, activeEntries);

  return {
    allowed: true,
    retryAfterMs: 0
  };
}

module.exports = {
  checkRateLimit
};
