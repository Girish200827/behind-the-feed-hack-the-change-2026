"""Download a model file once, the way pip does it.

Plain Python on Windows sometimes fails with CERTIFICATE_VERIFY_FAILED on
university or company networks. pip avoids that by trusting the Windows
certificate store through the "truststore" library; this does the same, then
falls back to the "certifi" bundle, then to Python's default.
"""
from __future__ import annotations

import os
import ssl
import sys
import urllib.request


def _contexts():
    try:
        import truststore
        yield "Windows certificate store", truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    except Exception:  # noqa: BLE001
        pass
    try:
        import certifi
        yield "certifi bundle", ssl.create_default_context(cafile=certifi.where())
    except Exception:  # noqa: BLE001
        pass
    yield "Python default", ssl.create_default_context()


def download_file(url: str, path: str, min_bytes: int, what: str) -> None:
    """Save url to path, trying each certificate source in turn. Raises with a clear message on failure."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".part"
    errors = []
    for name, ctx in _contexts():
        try:
            print(f"Downloading {what} (using the {name})...", file=sys.stderr, flush=True)
            req = urllib.request.Request(url, headers={"User-Agent": "scroll-mood-hackathon"})
            with urllib.request.urlopen(req, context=ctx, timeout=20) as r, open(tmp, "wb") as f:
                while True:
                    chunk = r.read(1 << 16)
                    if not chunk:
                        break
                    f.write(chunk)
            if os.path.getsize(tmp) < min_bytes:
                raise IOError("the download was too small to be the model file")
            os.replace(tmp, path)
            print(f"Saved {what} to {path}", file=sys.stderr, flush=True)
            return
        except Exception as err:  # noqa: BLE001
            errors.append(f"{name}: {err}")
            if os.path.exists(tmp):
                os.remove(tmp)
    raise RuntimeError(
        f"Could not download {what}.\n  " + "\n  ".join(errors) +
        f"\n\nDownload it in your web browser instead:\n  {url}\n"
        f"and save it as:\n  {path}\nthen run again.")
