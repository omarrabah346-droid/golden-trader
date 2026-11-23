"""Run V2 SQL using a fresh standalone PostgreSQL backend and synthetic data."""
import argparse
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--pg-bin", required=True, type=Path)
parser.add_argument("--scratch", required=True, type=Path)
args = parser.parse_args()

test = Path(__file__).resolve().parent
review = test.parents[1] / "docs/security/subscriptions-v2"
migration_files = [
    test / "bootstrap.sql",
    review / "001-core.review.sql",
    review / "002-review-and-provider-work.review.sql",
    review / "003-feature-access.review.sql",
    review / "004-legacy-clearance.review.sql",
    review / "005-shared-settlement.review.sql",
    test / "fixtures.sql",
]
blocks = [re.sub(r"(?m)^[ \t]*\n", "", path.read_text(encoding="utf-8"))
          for path in migration_files]
blocks.append((test / "single-user-smoke.sql").read_text(encoding="utf-8"))
script = "\n\n".join(block.strip() for block in blocks) + "\n\n"

with TemporaryDirectory(prefix="vexora-sub-test-", dir=args.scratch) as cluster:
    subprocess.run([args.pg_bin / "initdb", "-D", cluster, "-U", "vx_test_admin",
                    "-A", "trust", "-E", "UTF8", "--no-locale", "--no-sync"], check=True)
    result = subprocess.run([args.pg_bin / "postgres", "--single", "-j", "-D", cluster,
                             "postgres"], input=script.encode(), capture_output=True)
    if (result.returncode or re.search(rb"\b(?:ERROR|FATAL|PANIC):", result.stderr)
            or b' = "VEXORA_SINGLE_USER_SMOKE_PASSED"' not in result.stdout):
        raise SystemExit(result.stderr.decode(errors="replace"))
    print("VEXORA_SINGLE_USER_SMOKE_PASSED")
