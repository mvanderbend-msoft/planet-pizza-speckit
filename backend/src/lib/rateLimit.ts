import { RequestHandler } from 'express';

const WINDOW_MS = 60_000;
const lookupStates = new Map<string, { windowStart: number; count: number; blockedUntil: number }>();

export const lookupRateLimit: RequestHandler = (req, res, next) => {
  const now = Date.now();

  for (const [ip, state] of lookupStates) {
    if (now >= state.windowStart + WINDOW_MS && now >= state.blockedUntil) {
      lookupStates.delete(ip);
    }
  }

  const ip = req.ip ?? 'unknown';
  let state = lookupStates.get(ip);
  if (!state) {
    state = { windowStart: now, count: 0, blockedUntil: 0 };
    lookupStates.set(ip, state);
  }

  if (now >= state.blockedUntil) {
    if (now >= state.windowStart + WINDOW_MS) {
      state.windowStart = now;
      state.count = 0;
    }
    if (++state.count <= 10) return next();
    state.blockedUntil = now + WINDOW_MS;
  }

  const retryAfterSeconds = Math.ceil((state.blockedUntil - now) / 1000);
  return res
    .set('Retry-After', String(retryAfterSeconds))
    .status(429)
    .json({ error: 'Too many lookups', retry_after_seconds: retryAfterSeconds });
};
