"""
Secure configuration store — admin-managed keys backed by MongoDB with
AES-256-GCM encryption.

Lookup order: MongoDB → os.environ

Encryption design
-----------------
Each stored value gets:
  • 16-byte random salt  (unique per entry, re-randomised on every write)
  • 12-byte random nonce (fresh on every write)
  • PBKDF2-HMAC-SHA256 key derivation: master_key + salt → 32-byte AES key
  • AES-256-GCM authenticated encryption: tampering is detected on decrypt

Master key is read once from CONFIG_ENCRYPTION_KEY env-var.
If the var is absent a random ephemeral key is generated — values written in
that session will be unreadable after restart, so always set the env-var in
production.
"""

import base64
import logging
import os
import secrets
from datetime import datetime

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from database import get_db

logger = logging.getLogger(__name__)

# ── Master key ────────────────────────────────────────────────────────────────

_RAW_MASTER = os.environ.get("CONFIG_ENCRYPTION_KEY", "")
if not _RAW_MASTER:
    _RAW_MASTER = secrets.token_hex(32)  # ephemeral — values won't survive restart
    logger.warning(
        "CONFIG_ENCRYPTION_KEY not set — using ephemeral key. "
        "DB config values will be unreadable after restart. "
        "Set CONFIG_ENCRYPTION_KEY to a stable 32+ hex-char secret."
    )

_MASTER_KEY_BYTES: bytes = _RAW_MASTER.encode()


# ── Crypto helpers ─────────────────────────────────────────────────────────────

_PBKDF2_ITERATIONS = 100_000
_NONCE_LEN = 12
_SALT_LEN = 16


def _derive_key(salt: bytes) -> bytes:
    """Derive a 256-bit AES key from the master key + per-entry salt."""
    kdf = PBKDF2HMAC(
        algorithm=SHA256(),
        length=32,
        salt=salt,
        iterations=_PBKDF2_ITERATIONS,
    )
    return kdf.derive(_MASTER_KEY_BYTES)


def _encrypt(plaintext: str) -> tuple[str, str]:
    """
    Encrypt *plaintext* with a fresh salt + nonce.
    Returns (value_enc_b64, salt_b64).
    value_enc_b64 encodes  nonce || GCM-ciphertext.
    """
    salt = secrets.token_bytes(_SALT_LEN)
    nonce = secrets.token_bytes(_NONCE_LEN)
    key = _derive_key(salt)
    aesgcm = AESGCM(key)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    payload = nonce + ct  # nonce is not secret; store it prepended to ciphertext
    return base64.b64encode(payload).decode(), base64.b64encode(salt).decode()


def _decrypt(value_enc_b64: str, salt_b64: str) -> str:
    """Decrypt and authenticate a stored value. Raises ValueError on tamper."""
    salt = base64.b64decode(salt_b64)
    key = _derive_key(salt)
    payload = base64.b64decode(value_enc_b64)
    nonce, ct = payload[:_NONCE_LEN], payload[_NONCE_LEN:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ct, None).decode("utf-8")


# ── Public API ─────────────────────────────────────────────────────────────────

async def get_config(key: str) -> str | None:
    """
    Return the value for *key*.
    Checks MongoDB first; falls back to os.environ.
    Returns None if not set anywhere.
    """
    db = get_db()
    doc = await db.app_config.find_one({"key": key})
    if doc:
        try:
            return _decrypt(doc["value_enc"], doc["salt"])
        except Exception as exc:
            logger.error("Failed to decrypt config key=%s: %s", key, exc)
            # Fall through to env-var fallback
    return os.environ.get(key) or None


async def set_config(key: str, value: str, admin_id: str) -> None:
    """Upsert *key* → encrypted *value* in the DB."""
    value_enc, salt = _encrypt(value)
    db = get_db()
    await db.app_config.update_one(
        {"key": key},
        {
            "$set": {
                "key": key,
                "value_enc": value_enc,
                "salt": salt,
                "updated_by": admin_id,
                "updated_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )
    logger.info("Config key set: key=%s admin=%s", key, admin_id)


async def delete_config(key: str, admin_id: str) -> bool:
    """Remove *key* from the DB (falls back to env-var after deletion). Returns True if found."""
    db = get_db()
    result = await db.app_config.delete_one({"key": key})
    if result.deleted_count:
        logger.info("Config key deleted: key=%s admin=%s", key, admin_id)
        return True
    return False


async def list_config_keys() -> list[dict]:
    """
    Return all keys stored in DB with masked values and source info.
    Never returns plaintext values — masks to first 4 + last 4 chars.
    """
    db = get_db()
    rows = []
    async for doc in db.app_config.find({}, {"key": 1, "value_enc": 1, "salt": 1, "updated_by": 1, "updated_at": 1}):
        try:
            plaintext = _decrypt(doc["value_enc"], doc["salt"])
            masked = _mask(plaintext)
            decrypted_ok = True
        except Exception:
            masked = "*** (decryption error) ***"
            decrypted_ok = False
        rows.append({
            "key": doc["key"],
            "source": "db",
            "masked_value": masked,
            "decrypted_ok": decrypted_ok,
            "updated_by": doc.get("updated_by"),
            "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
        })
    return rows


def _mask(value: str) -> str:
    """Show first 4 + last 4 chars for long strings, otherwise full asterisks."""
    if not value:
        return ""
    if len(value) <= 8:
        return "*" * len(value)
    return value[:4] + "****" + value[-4:]
