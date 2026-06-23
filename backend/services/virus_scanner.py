"""
Virus scanner service — wraps ClamAV via pyclamd.
Falls back to a lightweight byte-pattern check when ClamAV is unavailable,
logging a warning so ops teams know scanning is degraded.

To enable full scanning in production:
  1. Install ClamAV: apt-get install clamav clamav-daemon
  2. Start daemon: freshclam && service clamav-daemon start
  3. pip install pyclamd
"""

import logging
import os

logger = logging.getLogger(__name__)

# Known malware/exploit byte patterns (defence-in-depth fallback only)
_DANGER_PATTERNS = [
    b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE",   # EICAR test string
    b"\x4d\x5a\x90\x00",                     # MZ header — Windows PE executable
    b"#!/",                                   # shebang — script file
    b"<script",                               # HTML/JS injection in disguised file
    b"<?php",                                 # PHP webshell
]

_clamav_available: bool | None = None  # lazily initialised


def _get_clamd():
    """Return a connected pyclamd socket client, or None if unavailable."""
    global _clamav_available
    if _clamav_available is False:
        return None
    try:
        import pyclamd  # type: ignore
        cd = pyclamd.ClamdUnixSocket()
        cd.ping()
        _clamav_available = True
        return cd
    except Exception:
        try:
            import pyclamd  # type: ignore
            cd = pyclamd.ClamdNetworkSocket()
            cd.ping()
            _clamav_available = True
            return cd
        except Exception as e:
            if _clamav_available is None:
                logger.warning(
                    "ClamAV daemon not reachable (%s). "
                    "Falling back to pattern-based scanning. "
                    "Install and start clamav-daemon for full protection.",
                    e,
                )
            _clamav_available = False
            return None


def _pattern_scan(content: bytes) -> str | None:
    """Return a threat name string if a known-bad pattern is found, else None."""
    # Scan up to 1 MB — avoids missing late-embedded payloads while staying performant
    scan_content = content[:1_048_576].lower()
    for pattern in _DANGER_PATTERNS:
        if pattern.lower() in scan_content:
            return f"PatternMatch:{pattern[:20]!r}"
    return None


async def scan_bytes(content: bytes) -> tuple[bool, str]:
    """
    Scan file content for malware.

    Returns:
        (is_clean, message) — is_clean=True means safe to store.
    """
    # 1. Try ClamAV first
    cd = _get_clamd()
    if cd is not None:
        try:
            result = cd.scan_stream(content)
            if result is None:
                return True, "clean"
            # result format: {None: ('FOUND', 'Eicar-Test-Signature')}
            threat = next(iter(result.values()), ("UNKNOWN", "unknown"))[1]
            logger.warning("ClamAV detected threat: %s", threat)
            return False, f"Malware detected: {threat}"
        except Exception as e:
            logger.error("ClamAV scan error: %s — falling through to pattern scan", e)

    # 2. Pattern-based fallback
    threat = _pattern_scan(content)
    if threat:
        logger.warning("Pattern scan detected threat: %s", threat)
        return False, f"Suspicious content detected: {threat}"

    return True, "clean"
