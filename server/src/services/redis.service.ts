import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

let redisClient: RedisClientType;
let redisSub: RedisClientType;

export async function initRedis() {
  const redisOptions = config.redis.password
    ? { url: `redis://:${config.redis.password}@${config.redis.host}:${config.redis.port}` }
    : { url: `redis://${config.redis.host}:${config.redis.port}` };

  redisClient = createClient(redisOptions);
  redisSub = redisClient.duplicate();

  redisClient.on('error', (err) => console.error('[REDIS] Client error:', err.message));
  redisSub.on('error', (err) => console.error('[REDIS] Sub error:', err.message));

  await redisClient.connect();
  await redisSub.connect();

  console.log('[REDIS] Connected to Redis at', config.redis.host);
  return { redisClient, redisSub };
}

export function getRedis(): RedisClientType {
  if (!redisClient) throw new Error('Redis not initialized');
  return redisClient;
}

export function getRedisSub(): RedisClientType {
  if (!redisSub) throw new Error('Redis subscriber not initialized');
  return redisSub;
}

// Presence helpers
export async function setUserOnline(userId: string) {
  await redisClient.set(`presence:${userId}`, 'online', { EX: 300 });
  await redisClient.sAdd('online_users', userId);
}

export async function setUserOffline(userId: string) {
  await redisClient.del(`presence:${userId}`);
  await redisClient.sRem('online_users', userId);
}

export async function setUserStatus(userId: string, status: string) {
  await redisClient.set(`presence:${userId}`, status, { EX: 300 });
}

export async function getUserStatus(userId: string): Promise<string> {
  return (await redisClient.get(`presence:${userId}`)) || 'offline';
}

export async function getOnlineUsers(): Promise<string[]> {
  return await redisClient.sMembers('online_users');
}

export async function clearAllPresence() {
  await redisClient.del('online_users');
  // Clear all presence:* keys
  const keys = await redisClient.keys('presence:*');
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
}

export async function refreshPresence(userId: string) {
  const status = await getUserStatus(userId);
  if (status !== 'offline') {
    await redisClient.expire(`presence:${userId}`, 300);
  }
}

// Typing indicators
export async function setTyping(userId: string, conversationId: string) {
  await redisClient.set(`typing:${conversationId}:${userId}`, '1', { EX: 5 });
}

export async function clearTyping(userId: string, conversationId: string) {
  await redisClient.del(`typing:${conversationId}:${userId}`);
}
