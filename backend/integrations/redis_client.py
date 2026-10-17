import redis.asyncio as redis
from redis.exceptions import RedisError

from backend.core.config import get_settings


class RedisClient:
    PENDING_TTL_SECONDS = 20 * 60   # whole signup, then they start over
    CODE_TTL_SECONDS = 5 * 60       # one emailed code
    COOLDOWN_SECONDS = 30           # wait between sending codes
    MAX_CODE_ATTEMPTS = 10

    TOTP_PENDING_TTL_SECONDS = 10 * 60
    TOTP_USED_TTL_SECONDS = 2 * 60
    TOTP_LIMIT = 5
    TOTP_LOCKOUT = 10 * 60

    LOGIN_CHALLENGE_TTL_SECONDS = 5 * 60

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

    @staticmethod
    def _challenge_key(challenge: str) -> str:
        return f"login_challenge_{challenge}"

    @staticmethod
    def email_key(email: str) -> str:
        return f"login_fail:email:{email}"

    @staticmethod
    def ip_key(ip: str) -> str:
        return f"login_fail:ip:{ip}"


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

    # ---- Email varification on signup
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

    # ---- Totp setup
    async def save_totp_pending(self, user_id, secret: str) -> None:
        await self.redis_client.set(f"totp_pending_{user_id}", secret, ex=self.TOTP_PENDING_TTL_SECONDS)

    async def get_totp_pending(self, user_id: str) -> str | None:
        return await self.redis_client.get(f"totp_pending_{user_id}")

    async def delete_totp_pending(self, user_id: str) -> None:
        await self.redis_client.delete(f"totp_pending_{user_id}")

    async def claim_totp_step(self, user_id: str, step: int) -> bool:
        """True the first time a 30 second step is used, False if it was already used. Prevents using the same code twice"""
        return bool(await self.redis_client.set(f"totp_used_{user_id}_{step}", "1", nx=True, ex=self.TOTP_USED_TTL_SECONDS))


    async def save_login_challenge(self, challenge: str, user_id: str) -> None:
        await self.redis_client.set(self._challenge_key(challenge), user_id, ex=self.LOGIN_CHALLENGE_TTL_SECONDS)

    async def get_login_challenge(self, challenge: str) -> str | None:
        return await self.redis_client.get(self._challenge_key(challenge))

    async def delete_login_challenge(self, challenge: str) -> None:
        await self.redis_client.delete(self._challenge_key(challenge))