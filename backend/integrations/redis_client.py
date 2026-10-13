import redis.asyncio as redis
from redis.exceptions import RedisError

from backend.core.config import get_settings


class RedisClient:
    PENDING_TTL_SECONDS = 20 * 60   # whole signup, then they start over
    CODE_TTL_SECONDS = 5 * 60       # one emailed code
    COOLDOWN_SECONDS = 30           # wait between sending codes
    MAX_CODE_ATTEMPTS = 10

    def __init__(self):
        self.redis_client = redis.from_url(get_settings().redis_url, decode_responses=True)


    @staticmethod
    def _pending_key(email: str) -> str:
        return f"pending_signup_{email.lower()}"

    @staticmethod
    def _code_key(email: str) -> str:
        return f"pending_code_{email.lower()}"

    @staticmethod
    def _attempts_key(email: str) -> str:
        return f"code_attempts_{email.lower()}"

    @staticmethod
    def _cooldown_key(email: str) -> str:
        return f"code_cooldown_{email.lower()}"


    async def hit(self, key: str, limit: int, lockout_time: int) -> bool:
        try:
            count = await self.redis_client.incr(key)
            if count == 1 or count == limit + 1:
                await self.redis_client.expire(key, lockout_time)
            return count > limit
        except RedisError:
            return False

    async def delete(self, key: str) -> None:
        await self.redis_client.delete(key)


    async def save_pending(self, email: str, payload: dict) -> None:
        key = self._pending_key(email)
        async with self.redis_client.pipeline() as pipe:
            pipe.hset(key, mapping=payload)  # noqa
            pipe.expire(key, self.PENDING_TTL_SECONDS)  # noqa
            await pipe.execute()

    async def get_pending(self, email: str) -> dict[str, str]:
        return await self.redis_client.hgetall(self._pending_key(email))


    async def save_code(self, email: str, code_hash: str) -> None:
        """Stores a new code hash and gives the person a fresh set of guesses."""
        async with self.redis_client.pipeline() as pipe:
            pipe.set(self._code_key(email), code_hash, ex=self.CODE_TTL_SECONDS)  # noqa
            pipe.delete(self._attempts_key(email))  # noqa
            await pipe.execute()

    async def get_code(self, email: str) -> str | None:
        return await self.redis_client.get(self._code_key(email))

    async def too_many_attempts(self, email: str) -> bool:
        return await self.hit(
            self._attempts_key(email),
            limit=self.MAX_CODE_ATTEMPTS,
            lockout_time=self.CODE_TTL_SECONDS,
        )

    # ---- resend cooldown

    async def start_cooldown(self, email: str) -> None:
        await self.redis_client.set(self._cooldown_key(email), "1", ex=self.COOLDOWN_SECONDS)

    async def cooldown_active(self, email: str) -> bool:
        return bool(await self.redis_client.exists(self._cooldown_key(email)))

    # ---- cleanup ----

    async def delete_pending(self, email: str) -> None:
        await self.redis_client.delete(
            self._pending_key(email),
            self._code_key(email),
            self._attempts_key(email),
        )

    async def delete_code(self, email: str) -> None:
        await self.redis_client.delete(
            self._code_key(email),
            self._attempts_key(email),
        )
