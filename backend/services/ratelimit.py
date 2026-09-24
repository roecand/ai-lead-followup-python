import redis.asyncio as redis
from redis.exceptions import RedisError

from backend.config import get_settings


class RedisClient:
    def __init__(self):
        self.redis_client = redis.from_url(get_settings().redis_url, decode_responses=True)
        self.MAX_FAILS_PER_EMAIL = 5
        self.MAX_FAILS_PER_IP = 20
        self.LOGIN_WINDOW_SECONDS = 15 * 60

    async def check_login(self, key: str, limit: int) -> bool:
        try:
            count = await self.redis_client.incr(key)
            if count == 1:
                await self.redis_client.expire(key, self.LOGIN_WINDOW_SECONDS)
            return count > limit
        except RedisError:
            return False

    async def delete(self, key):
        await self.redis_client.delete(key)
