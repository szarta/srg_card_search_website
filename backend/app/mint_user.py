"""
@copyright Copyright 2025, Brandon Arrendondo
See LICENSE.txt for details.

Admin CLI: mint an invite-only Run It Back access key for a user.

There is no self-service signup and no admin UI — the sole administrator runs
this on the box. It creates (or, with --rotate, re-keys) a user and prints the
raw access key exactly ONCE. Only the SHA-256 hash is stored; the raw key
cannot be recovered later, so copy it now and hand it to the user.

Usage (from backend/app):
    python mint_user.py --email alice@example.com
    python mint_user.py --email alice@example.com --rotate    # new key, same user
    python mint_user.py --email alice@example.com --deactivate # disable login
"""

import argparse
import sys

from database import SessionLocal
from models.base import User
from rib_security import generate_key, hash_key


def _print_key(email: str, raw_key: str, *, rotated: bool):
    verb = "Rotated key for" if rotated else "Created"
    print(f"{verb} user: {email}")
    print("")
    print("  Access key (shown ONCE — copy it now, it is not stored):")
    print(f"    {raw_key}")
    print("")
    print("  The user pastes this key on the Run It Back login screen.")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Mint a Run It Back access key.")
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument(
        "--rotate",
        action="store_true",
        help="Issue a new key for an existing user (invalidates the old one)",
    )
    parser.add_argument(
        "--deactivate",
        action="store_true",
        help="Deactivate the user (blocks login) instead of minting a key",
    )
    args = parser.parse_args(argv)

    email = args.email.strip().lower()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).one_or_none()

        if args.deactivate:
            if user is None:
                print(f"No such user: {email}", file=sys.stderr)
                return 1
            user.active = False
            db.commit()
            print(f"Deactivated user: {email}")
            return 0

        if user is not None and not args.rotate:
            print(
                f"User already exists: {email}\n"
                "Pass --rotate to issue a new key, or --deactivate to disable.",
                file=sys.stderr,
            )
            return 1

        raw_key = generate_key()
        if user is None:
            user = User(email=email, key_hash=hash_key(raw_key), active=True)
            db.add(user)
            rotated = False
        else:
            user.key_hash = hash_key(raw_key)
            user.active = True
            rotated = True
        db.commit()

        _print_key(email, raw_key, rotated=rotated)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
