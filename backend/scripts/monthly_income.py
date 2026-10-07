"""Rebuild a month's educational earnings report without global MySQL privileges."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from baxi.application.services import refresh_monthly_income

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("month", help="Gregorian month, e.g. 2026-10-01")
    args = parser.parse_args()
    refresh_monthly_income(args.month)
