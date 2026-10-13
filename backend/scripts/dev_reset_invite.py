"""
Dev helper. Wipes one test email and gives it a fresh invite, so you can run the
signup flow again and again.

Run it from the project root with the stack up:

    docker compose exec backend uv run --frozen python -m backend.dev_reset_invite you@example.com

Optional:  --role owner   (default is staff)

What it does, in order:
  1. Deletes the user with that email (and their refresh tokens)
  2. Deletes every invite for that email
  3. Clears the signup keys for that email in Redis (pending signup, code,
     attempts, resend cooldown) and that email's login failure counter
  4. Creates a new invite and prints the invite code to use on the signup page

It never touches any other user, and it keeps the company.
"""
import argparse
import asyncio

from sqlalchemy import delete, or_, select

from backend.database import Company, Invite, RefreshToken, SessionLocal, User
from backend.integrations.redis_client import RedisClient


def reset_database(email: str, role: str) -> str:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))

        if user:
            db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
            # invites point at users through used_by, so they go before the user does
            db.execute(delete(Invite).where(or_(Invite.email == email, Invite.used_by == user.id)))
            db.delete(user)
            print(f"Deleted user {email}")
        else:
            db.execute(delete(Invite).where(Invite.email == email))
            print(f"No user for {email}")

        company = db.scalar(select(Company).order_by(Company.created_at))
        if not company:
            company = Company(name="Dev Company", twilio_number="+15555550100")
            db.add(company)
            db.flush()
            print("No company existed, created Dev Company")

        invite = Invite(company_id=company.id, email=email, role=role)
        db.add(invite)
        db.commit()
        print(f"Company  {company.name}")
        return invite.join_code


async def reset_redis(email: str) -> None:
    store = RedisClient()
    await store.delete_pending(email)
    await store.delete(store._cooldown_key(email))
    await store.delete(f"login_fail:email:{email}")
    print("Cleared Redis keys")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument("--role", default="staff")
    args = parser.parse_args()

    email = args.email.strip().lower()
    join_code = reset_database(email, args.role)
    asyncio.run(reset_redis(email))

    print()
    print(f"Email        {email}")
    print(f"Invite code  {join_code}")
    print(f"Role         {args.role}")


if __name__ == "__main__":
    main()
