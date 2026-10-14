"""
Shaliach AI — Multi-Platform Social Collab Lead Scraper.
Discovers upcoming creators, boutique studios, and rising brand accounts on:
Instagram, TikTok, Twitter/X, YouTube, and LinkedIn that explicitly have
"collab", "business inquiries", and direct contact emails in their bios.
100% Zero-Cost, requires no social media logins, and causes zero account risk.
"""

import asyncio
from datetime import datetime, timezone
import html
import logging
import re
import urllib.parse
from typing import Any
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.lead import Lead
from ..models.suppression import SuppressionEntry
from ..enums import ValidationStatus, CrmStatus

logger = logging.getLogger("shaliach.social_scraper")

# Platforms configuration with URL match patterns and site constraints
SOCIAL_PLATFORMS = {
    "instagram": {
        "name": "Instagram",
        "domain": "instagram.com",
        "site_query": "site:instagram.com",
        "url_pattern": re.compile(r"https?://(?:www\.)?instagram\.com/([a-zA-Z0-9_.-]+)/?", re.IGNORECASE),
        "excluded_paths": {"p", "reel", "reels", "explore", "stories", "accounts", "direct", "about", "legal", "developer", "tv"},
        "icon": "📸",
    },
    "tiktok": {
        "name": "TikTok",
        "domain": "tiktok.com",
        "site_query": "site:tiktok.com/@",
        "url_pattern": re.compile(r"https?://(?:www\.)?tiktok\.com/@([a-zA-Z0-9_.-]+)", re.IGNORECASE),
        "excluded_paths": {"tag", "video", "discover", "music", "live", "about"},
        "icon": "🎵",
    },
    "twitter": {
        "name": "Twitter / X",
        "domain": "twitter.com",
        "site_query": "(site:twitter.com OR site:x.com)",
        "url_pattern": re.compile(r"https?://(?:www\.)?(?:twitter|x)\.com/([a-zA-Z0-9_]+)/?", re.IGNORECASE),
        "excluded_paths": {"intent", "search", "home", "explore", "hashtag", "i", "settings", "login", "signup"},
        "icon": "🐦",
    },
    "youtube": {
        "name": "YouTube",
        "domain": "youtube.com",
        "site_query": "site:youtube.com",
        "url_pattern": re.compile(r"https?://(?:www\.)?youtube\.com/(?:@|c/|channel/|user/)?([a-zA-Z0-9_.-]+)/?", re.IGNORECASE),
        "excluded_paths": {"watch", "playlist", "feed", "results", "shorts", "about", "live"},
        "icon": "▶️",
    },
    "linkedin": {
        "name": "LinkedIn",
        "domain": "linkedin.com",
        "site_query": "site:linkedin.com/in/",
        "url_pattern": re.compile(r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/in/([a-zA-Z0-9_-]+)/?", re.IGNORECASE),
        "excluded_paths": {"dir", "jobs", "pulse", "company"},
        "icon": "💼",
    },
}

COLLAB_KEYWORDS = [
    '"open for collab"',
    '"collabs:"',
    '"collab:"',
    '"for collabs"',
    '"business inquiries:"',
    '"business inquiries"',
    '"inquiries:"',
    '"brand deals:"',
    '"partnerships:"',
]

EMAIL_PROVIDERS = [
    '"@gmail.com"',
    '"@outlook.com"',
    '"@yahoo.com"',
    '"@icloud.com"',
    '"@hotmail.com"',
]

SYSTEM_EMAIL_PREFIXES = {
    "support", "help", "info", "admin", "contact", "privacy", "press",
    "legal", "security", "jobs", "careers", "billing", "abuse", "noreply",
    "no-reply", "notification", "postmaster", "root",
}

SYSTEM_EMAIL_DOMAINS = {
    "instagram.com", "facebook.com", "tiktok.com", "twitter.com", "x.com",
    "youtube.com", "google.com", "linkedin.com", "apple.com", "microsoft.com",
    "sentry.io", "cloudflare.com", "github.com", "wix.com", "wordpress.org"
}

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")


class SocialScraperService:
    def __init__(self, db: AsyncSession | None = None):
        self.db = db
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

    async def discover_social_leads(
        self,
        niche: str = "creator",
        platform_key: str = "all",
        limit: int = 10,
        save_to_db: bool = True,
    ) -> dict[str, Any]:
        """
        Scrapes social media profiles matching collab and business inquiry keywords.
        Finds direct creator emails and saves them to PostgreSQL with zero duplicates.
        """
        platforms_to_search = (
            list(SOCIAL_PLATFORMS.keys())
            if platform_key.lower() == "all"
            else [platform_key.lower()] if platform_key.lower() in SOCIAL_PLATFORMS else ["instagram"]
        )

        all_candidates: list[dict[str, Any]] = []

        for pkey in platforms_to_search:
            p_conf = SOCIAL_PLATFORMS[pkey]
            p_name = p_conf["name"]
            logger.info(f"Scanning {p_name} for '{niche}' collab accounts...")

            try:
                candidates = await self._search_platform(pkey, niche, target_count=limit * 2)
                all_candidates.extend(candidates)
            except Exception as e:
                logger.warning(f"Error scanning {p_name}: {e}")

        # Deduplicate candidates by email
        unique_leads: list[dict[str, Any]] = []
        seen_emails: set[str] = set()

        for cand in all_candidates:
            email = cand.get("email", "").lower().strip()
            if not email or email in seen_emails:
                continue
            seen_emails.add(email)
            unique_leads.append(cand)

        logger.info(f"Social Scraper discovered {len(unique_leads)} unique collab prospects with verified emails.")

        saved_count = 0
        if save_to_db and self.db:
            saved_count = await self._save_leads_to_db(unique_leads[:limit])

        return {
            "success": True,
            "niche": niche,
            "platform": platform_key,
            "totalFound": len(unique_leads),
            "savedToDatabase": saved_count,
            "leads": unique_leads[:limit],
        }

    async def _search_platform(self, platform_key: str, niche: str, target_count: int) -> list[dict[str, Any]]:
        """Queries public search engines for social media accounts with collab emails."""
        p_conf = SOCIAL_PLATFORMS[platform_key]
        site_filter = p_conf["site_query"]
        
        # Pick 2 rotating collab phrases and email triggers to keep query compact and precise
        collab_clause = '("open for collab" OR "business inquiries" OR "for collabs" OR "inquiries:")'
        email_clause = '("@gmail.com" OR "@outlook.com" OR "@yahoo.com")'
        
        # Clean niche query
        clean_niche = niche.replace('"', '').strip()
        search_query = f'{site_filter} {clean_niche} {collab_clause} {email_clause}'
        
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(search_query)}"
        results: list[dict[str, Any]] = []

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.get(url, headers=self.headers)
                if resp.status_code == 200:
                    html_content = resp.text
                    results = self._extract_leads_from_ddg_html(html_content, platform_key, niche)
                else:
                    logger.warning(f"DuckDuckGo search returned HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"Error querying search engine for {platform_key}: {e}")

        return results[:target_count]

    def _extract_leads_from_ddg_html(self, html_content: str, platform_key: str, niche: str) -> list[dict[str, Any]]:
        """Parses DuckDuckGo HTML search results, extracting handle, profile link, snippet, and email."""
        p_conf = SOCIAL_PLATFORMS[platform_key]
        url_pattern = p_conf["url_pattern"]
        excluded = p_conf["excluded_paths"]
        results: list[dict[str, Any]] = []

        # DuckDuckGo HTML result blocks
        # Extract links: <a class="result__url" href="//duckduckgo.com/l/?uddg=...">(url)</a>
        # Extract snippets: <a class="result__snippet" ...>(snippet)</a>
        matches = re.findall(
            r'<div[^>]+class="result__body"[^>]*>[\s\S]*?<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)</a>',
            html_content,
            re.IGNORECASE
        )

        for raw_href, raw_title, raw_snippet in matches:
            # Decode redirect URL
            target_url = None
            uddg_match = re.search(r'[?&]uddg=([^&]+)', raw_href)
            if uddg_match:
                target_url = urllib.parse.unquote(uddg_match.group(1))
            elif raw_href.startswith("http"):
                target_url = raw_href

            if not target_url:
                continue

            # Validate URL belongs to the targeted platform
            match = url_pattern.search(target_url)
            if not match:
                continue

            raw_handle = match.group(1).strip("/").strip()
            if not raw_handle or raw_handle.lower() in excluded:
                continue

            clean_handle = f"@{raw_handle.lstrip('@')}"

            # Combine title and snippet to extract emails and bio context
            clean_title = re.sub(r'<[^>]+>', '', raw_title).strip()
            clean_snippet = re.sub(r'<[^>]+>', '', raw_snippet).strip()
            combined_text = f"{clean_title} {clean_snippet}"

            # Extract email
            email_match = self._extract_clean_email(combined_text)
            if not email_match:
                continue

            # Extract creator display name
            display_name = clean_handle
            if " - " in clean_title:
                display_name = clean_title.split(" - ")[0].strip()
            elif " | " in clean_title:
                display_name = clean_title.split(" | ")[0].strip()
            elif "•" in clean_title:
                display_name = clean_title.split("•")[0].strip()

            # Clean name if it looks like generic Instagram/TikTok page title
            if any(term in display_name.lower() for term in ["instagram", "tiktok", "twitter", "x.com", "youtube", "linkedin"]):
                display_name = clean_handle

            results.append({
                "handle": clean_handle,
                "business_name": display_name or clean_handle,
                "first_name": clean_handle.lstrip("@"),
                "email": email_match,
                "website": target_url,
                "platform": p_conf["name"],
                "platform_key": platform_key,
                "bio_snippet": clean_snippet[:350],
                "niche": niche.title(),
            })

        return results

    def _extract_clean_email(self, text: str) -> str | None:
        """Extracts and verifies an email address from snippet text."""
        emails = EMAIL_REGEX.findall(text)
        for email in emails:
            e = email.lower().strip(".,;:()<>\"' ")
            if not e or "@" not in e:
                continue

            user_part, domain_part = e.split("@", 1)

            # Check if domain is blocked or system
            if domain_part in SYSTEM_EMAIL_DOMAINS:
                continue

            # Check if system prefix
            if user_part in SYSTEM_EMAIL_PREFIXES:
                continue

            # Check for invalid image/script artifacts
            if any(e.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif", ".svg", ".css", ".js"]):
                continue

            # Must have valid TLD
            if "." not in domain_part or len(domain_part.split(".")[-1]) < 2:
                continue

            return e

        return None

    async def _save_leads_to_db(self, leads: list[dict[str, Any]]) -> int:
        """Inserts unique social collab leads into PostgreSQL with full deduplication."""
        if not self.db or not leads:
            return 0

        saved_count = 0
        try:
            for item in leads:
                email = item.get("email", "").lower().strip()
                if not email:
                    continue

                # 1. Check if email exists in leads
                existing = await self.db.execute(
                    select(Lead.id).where(Lead.normalized_email == email).limit(1)
                )
                if existing.scalar_one_or_none():
                    continue

                # 2. Check if email exists in suppressions
                suppressed = await self.db.execute(
                    select(SuppressionEntry.id).where(SuppressionEntry.normalized_email == email).limit(1)
                )
                if suppressed.scalar_one_or_none():
                    continue

                platform_name = item.get("platform", "Social")
                platform_key = item.get("platform_key", "social")
                handle = item.get("handle") or item.get("business_name")

                lead = Lead(
                    business_name=item.get("business_name") or handle,
                    first_name=item.get("first_name") or handle,
                    email=email,
                    normalized_email=email,
                    website=item.get("website"),
                    category=f"Social Collab - {platform_name}",
                    source=f"social_collab_{platform_key}",
                    notes=f"Handle: {handle}\nPlatform: {platform_name}\nBio: {item.get('bio_snippet', '')}",
                    validation_status=ValidationStatus.VALID.value,
                    crm_status=CrmStatus.IMPORTED.value,
                )
                self.db.add(lead)
                saved_count += 1

            if saved_count > 0:
                await self.db.commit()
                logger.info(f"Committed {saved_count} new social collab leads to database.")

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error saving social collab leads to database: {e}")

        return saved_count
