from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: download-source.py <url> <output>")
    url, output = sys.argv[1], Path(sys.argv[2])
    output.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "CIVIC-MAP/0.1 data import"})
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = response.read()
    output.write_bytes(payload)
    print(f"{output}\t{len(payload)} bytes\tsha256={hashlib.sha256(payload).hexdigest()}")


if __name__ == "__main__":
    main()
