#!/usr/bin/env python3
"""
Shaliach AI — Zero-Cost Business Lead Discovery CLI.
Finds verified business leads with emails, websites, phone numbers, and owner names
for $0.00 without paying any subscriptions or data vendors.

Usage:
    python scripts/find_leads.py --niche "plumbing" --location "Boston, MA" --limit 25
    python scripts/find_leads.py --niche "accountants" --location "Austin, TX" --save-db
"""

import argparse
import asyncio
import csv
import logging
import os
import sys

# Configure clean progress logging
logging.basicConfig(level=logging.INFO, format="[+] %(message)s")

# Ensure apps/api is in Python path for model imports
script_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.dirname(script_dir)
api_dir = os.path.join(repo_root, "apps", "api")
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from app.services.lead_finder import LeadFinderService


def print_banner():
    banner = r"""
  =============================================================
     SHALIACH AI — ZERO-COST BUSINESS LEAD DISCOVERY ENGINE
     Source: OpenStreetMap Global Registry + Deep Website Crawler
     Cost: $0.00 | No Subscriptions | Direct Verified Contacts
  =============================================================
"""
    print(banner)


async def main_async():
    parser = argparse.ArgumentParser(
        description="Scrape and extract verified local business leads with emails."
    )
    parser.add_argument("--niche", "-n", required=True, help="Business niche (e.g. plumbers, accountants, dentists, roofers)")
    parser.add_argument("--location", "-l", required=True, help="City and State/Country (e.g. 'Boston, MA', 'Dallas, TX', 'Miami')")
    parser.add_argument("--limit", type=int, default=25, help="Number of leads to retrieve (default: 25)")
    parser.add_argument("--save-db", action="store_true", help="Automatically commit new leads directly into Shaliach PostgreSQL database")
    parser.add_argument("--output", "-o", default=None, help="Output CSV filename")

    args = parser.parse_args()
    print_banner()

    niche = args.niche
    location = args.location
    limit = args.limit

    print(f"[*] Target Niche:    {niche.title()}")
    print(f"[*] Target Location: {location}")
    print(f"[*] Requested Count: {limit} leads")
    print(f"[*] Searching open registries and crawling business websites...")
    print("-" * 65)

    db_session = None
    if args.save_db:
        try:
            from app.database import async_session_factory
            db_session = async_session_factory()
            print("[+] Database connection established. Leads will be committed directly.")
        except Exception as e:
            print(f"[!] Warning: Could not connect to database ({e}). Will export to CSV only.")

    service = LeadFinderService(db=db_session)
    result = await service.discover_leads(
        niche=niche,
        location=location,
        limit=limit,
        save_to_db=bool(db_session),
    )

    leads = result.get("leads", [])
    if not leads:
        print("\n[!] No leads with verified emails were found for this query.")
        print("[!] Tip: Try broadening your location or using related keywords (e.g. 'plumber' vs 'plumbing').")
        return

    # Print summary table
    print(f"\n[+] Successfully extracted {len(leads)} verified leads:\n")
    print(f"{'#':<3} {'BUSINESS NAME':<26} {'FIRST NAME':<12} {'EMAIL':<30} {'PHONE'}")
    print("=" * 90)

    for idx, lead in enumerate(leads, 1):
        biz = (lead.get("business_name") or "Unknown")[:25]
        fn = (lead.get("first_name") or "-")[:11]
        em = (lead.get("email") or "-")[:29]
        ph = lead.get("phone") or "-"
        print(f"{idx:<3} {biz:<26} {fn:<12} {em:<30} {ph}")

    # Export to CSV
    sanitized_niche = "".join(c for c in niche if c.isalnum() or c in (" ", "_")).replace(" ", "_")
    sanitized_loc = "".join(c for c in location if c.isalnum() or c in (" ", "_")).replace(" ", "_")
    output_filename = args.output or f"leads_{sanitized_niche}_{sanitized_loc}.csv"
    output_path = os.path.join(repo_root, output_filename)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["business_name", "first_name", "email", "website", "phone", "city", "state", "category"],
        )
        writer.writeheader()
        for l in leads:
            writer.writerow({
                "business_name": l.get("business_name") or "",
                "first_name": l.get("first_name") or "",
                "email": l.get("email") or "",
                "website": l.get("website") or "",
                "phone": l.get("phone") or "",
                "city": l.get("city") or "",
                "state": l.get("state") or "",
                "category": l.get("category") or niche.title(),
            })

    print("=" * 90)
    print(f"\n[+] Saved {len(leads)} leads to CSV: {output_filename}")
    if args.save_db and result.get("savedToDatabase", 0) > 0:
        print(f"[+] Committed {result['savedToDatabase']} new leads directly into Shaliach PostgreSQL database!")
    print("\n[✓] Done! You can now launch an outreach campaign to these prospects.")


def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
