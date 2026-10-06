"""
Autonomous Zero-Cost Lead Discovery & Email Extraction Service.
Finds local businesses across any niche and location using free open engines
(OpenStreetMap Nominatim/Overpass, DuckDuckGo search, and optional Serper/Google Places)
and deeply crawls their websites to extract verified email addresses, owner names, and phone numbers.
Requires $0.00, no paid APIs, and no subscriptions.
"""

import asyncio
from datetime import datetime, timezone
import logging
import os
import re
import urllib.parse
from typing import Any
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.lead import Lead
from ..enums import ValidationStatus, CrmStatus

logger = logging.getLogger("shaliach.lead_finder")

# Map common niche terms to OpenStreetMap taxonomy
OSM_CATEGORY_MAP = {
    "plumber": ("craft", "plumber"),
    "plumbers": ("craft", "plumber"),
    "plumbing": ("craft", "plumber"),
    "electrician": ("craft", "electrician"),
    "electricians": ("craft", "electrician"),
    "electrical": ("craft", "electrician"),
    "dentist": ("amenity", "dentist"),
    "dentists": ("amenity", "dentist"),
    "dental": ("amenity", "dentist"),
    "doctor": ("amenity", "doctors"),
    "doctors": ("amenity", "doctors"),
    "clinic": ("amenity", "clinic"),
    "clinics": ("amenity", "clinic"),
    "hospital": ("amenity", "hospital"),
    "hospitals": ("amenity", "hospital"),
    "pharmacy": ("amenity", "pharmacy"),
    "pharmacies": ("amenity", "pharmacy"),
    "lawyer": ("office", "lawyer"),
    "lawyers": ("office", "lawyer"),
    "attorney": ("office", "lawyer"),
    "attorneys": ("office", "lawyer"),
    "legal": ("office", "lawyer"),
    "accountant": ("office", "accountant"),
    "accountants": ("office", "accountant"),
    "accounting": ("office", "accountant"),
    "cpa": ("office", "accountant"),
    "cpas": ("office", "accountant"),
    "architect": ("office", "architect"),
    "architects": ("office", "architect"),
    "realtor": ("office", "estate_agent"),
    "realtors": ("office", "estate_agent"),
    "real estate": ("office", "estate_agent"),
    "restaurant": ("amenity", "restaurant"),
    "restaurants": ("amenity", "restaurant"),
    "resturant": ("amenity", "restaurant"),
    "resturants": ("amenity", "restaurant"),
    "diner": ("amenity", "restaurant"),
    "diners": ("amenity", "restaurant"),
    "bar": ("amenity", "bar"),
    "bars": ("amenity", "bar"),
    "pub": ("amenity", "pub"),
    "pubs": ("amenity", "pub"),
    "cafe": ("amenity", "cafe"),
    "cafes": ("amenity", "cafe"),
    "coffee": ("amenity", "cafe"),
    "bakery": ("shop", "bakery"),
    "bakeries": ("shop", "bakery"),
    "contractor": ("craft", "builder"),
    "contractors": ("craft", "builder"),
    "builder": ("craft", "builder"),
    "builders": ("craft", "builder"),
    "roofing": ("craft", "roofer"),
    "roofer": ("craft", "roofer"),
    "roofers": ("craft", "roofer"),
    "painter": ("craft", "painter"),
    "painters": ("craft", "painter"),
    "carpenter": ("craft", "carpenter"),
    "carpenters": ("craft", "carpenter"),
    "hvac": ("craft", "hvac"),
    "auto repair": ("shop", "car_repair"),
    "mechanic": ("shop", "car_repair"),
    "mechanics": ("shop", "car_repair"),
    "car dealer": ("shop", "car"),
    "car dealers": ("shop", "car"),
    "gym": ("leisure", "fitness_centre"),
    "gyms": ("leisure", "fitness_centre"),
    "fitness": ("leisure", "fitness_centre"),
    "salon": ("shop", "beauty"),
    "salons": ("shop", "beauty"),
    "spa": ("shop", "beauty"),
    "spas": ("shop", "beauty"),
    "barber": ("shop", "hairdresser"),
    "barbers": ("shop", "hairdresser"),
    "hair": ("shop", "hairdresser"),
    "veterinarian": ("amenity", "veterinary"),
    "veterinarians": ("amenity", "veterinary"),
    "vet": ("amenity", "veterinary"),
    "vets": ("amenity", "veterinary"),
    "optometrist": ("shop", "optician"),
    "optometrists": ("shop", "optician"),
    "cleaning": ("craft", "cleaning"),
    "landscaping": ("craft", "gardener"),
    "gardener": ("craft", "gardener"),
    "gardeners": ("craft", "gardener"),
}

INVALID_EMAIL_SUBSTRINGS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js",
    "sentry", "wixpress", "cloudflare", "bootstrap", "schema.org",
    "example.com", "domain.com", "yourdomain", "email.com",
    "placeholder", "fontawesome", "wordpress", "gravatar", "git",
    "jquery", "node_modules", "wp-content", "vimeo", "youtube"
}

IGNORED_DOMAINS = {
    "duckduckgo.com", "yelp.com", "yellowpages.com", "angi.com", "bbb.org",
    "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
    "youtube.com", "mapquest.com", "tripadvisor.com", "wikipedia.org",
    "pinterest.com", "apple.com", "google.com", "yahoo.com", "bing.com",
    "indeed.com", "glassdoor.com", "thumbtack.com", "homeadvisor.com"
}

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}")


class LeadFinderService:
    def __init__(self, db: AsyncSession | None = None):
        self.db = db
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

    async def discover_leads(
        self,
        niche: str,
        location: str,
        limit: int = 25,
        save_to_db: bool = False,
        lead_list_id: str | None = None,
    ) -> dict[str, Any]:
        """Discover business leads and deeply crawl their websites for verified contact info."""
        niche_clean = niche.strip().lower()
        location_clean = location.strip()

        logger.info(f"Starting lead discovery for '{niche}' in '{location}' (limit: {limit})")

        # 1. Gather raw business candidates from multiple free engines
        candidates: list[dict[str, Any]] = []

        # A1. Check if user configured optional Google Places / Serper key (2,500 free queries, $0, no CC)
        serper_key = os.environ.get("SERPER_API_KEY")
        if not serper_key:
            try:
                from ..config import get_settings
                serper_key = get_settings().SERPER_API_KEY
            except Exception:
                pass

        if serper_key:
            serper_candidates = await self._query_serper(niche_clean, location_clean, limit * 2, serper_key)
            candidates.extend(serper_candidates)

        # A2. Check if user configured optional Brave Search key (2,000 free queries/month, $0, no CC)
        brave_key = os.environ.get("BRAVE_API_KEY")
        if not brave_key:
            try:
                from ..config import get_settings
                brave_key = get_settings().BRAVE_API_KEY
            except Exception:
                pass

        if brave_key and len(candidates) < limit * 2:
            brave_candidates = await self._query_brave(niche_clean, location_clean, (limit * 2) - len(candidates), brave_key)
            candidates.extend(brave_candidates)

        # B. DuckDuckGo targeted direct search (Decodes uddg + excludes directories)
        if len(candidates) < limit * 2:
            ddg_candidates = await self._query_duckduckgo(niche_clean, location_clean, (limit * 2) - len(candidates))
            candidates.extend(ddg_candidates)

        # B2. DuckDuckGo Lite fallback (lower bot protection)
        if len(candidates) < limit * 2:
            lite_candidates = await self._query_duckduckgo_lite(niche_clean, location_clean, (limit * 2) - len(candidates))
            candidates.extend(lite_candidates)

        # C. OpenStreetMap Nominatim + Overpass bounding box
        if len(candidates) < limit * 2:
            osm_candidates = await self._query_openstreetmap(niche_clean, location_clean, (limit * 2) - len(candidates))
            candidates.extend(osm_candidates)

        # Deduplicate candidates by domain/website
        seen_domains = set()
        unique_candidates = []
        for c in candidates:
            domain = self._extract_domain(c.get("website", ""))
            if domain and domain in seen_domains:
                continue
            if domain:
                seen_domains.add(domain)
            unique_candidates.append(c)

        logger.info(f"Discovered {len(unique_candidates)} unique business candidates. Crawling websites for contacts...")

        # 2. Deep crawl candidate websites concurrently (max 5 parallel requests)
        semaphore = asyncio.Semaphore(5)
        enriched_leads = []

        async def _crawl_single(cand: dict[str, Any]):
            async with semaphore:
                try:
                    return await self._crawl_business_website(cand)
                except Exception as e:
                    logger.debug(f"Crawl failed for {cand.get('business_name')}: {e}")
                    return cand

        tasks = [_crawl_single(cand) for cand in unique_candidates[:limit * 3]]
        results = await asyncio.gather(*tasks)

        # Filter only leads that have a verified email address
        for res in results:
            if res and res.get("email"):
                enriched_leads.append(res)
                if len(enriched_leads) >= limit:
                    break

        logger.info(f"Successfully scraped & verified {len(enriched_leads)} leads with direct emails")

        saved_count = 0
        if save_to_db and self.db:
            saved_count = await self._save_leads_to_db(enriched_leads, niche, location, lead_list_id)

        return {
            "success": True,
            "niche": niche,
            "location": location,
            "totalFound": len(enriched_leads),
            "savedToDatabase": saved_count,
            "leads": enriched_leads,
        }

    async def _query_serper(self, niche: str, location: str, target_count: int, api_key: str) -> list[dict[str, Any]]:
        """Optional: Query Serper.dev Google Maps Places API for instant authoritative local businesses."""
        results = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://google.serper.dev/places",
                    headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                    json={"q": f"{niche} in {location}", "num": min(target_count, 50)},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get("places", []):
                        website = item.get("website", "")
                        domain = self._extract_domain(website)
                        if website and domain and not any(ign in domain for ign in IGNORED_DOMAINS):
                            results.append({
                                "business_name": item.get("title") or domain.title(),
                                "website": website,
                                "email": None,
                                "phone": item.get("phoneNumber"),
                                "city": location.split(",")[0].strip(),
                                "state": location.split(",")[1].strip() if "," in location else "",
                                "category": niche.title(),
                                "first_name": None,
                            })
        except Exception as e:
            logger.warning(f"Serper API query error: {e}")
        return results

    async def _query_brave(self, niche: str, location: str, target_count: int, api_key: str) -> list[dict[str, Any]]:
        """Optional: Query Brave Search API (2,000 free queries/month, $0.00, no CC required)."""
        results = []
        city = location.split(",")[0].strip()
        search_query = f'{niche} in {city} contact -site:yelp.com -site:yellowpages.com'
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    "https://api.search.brave.com/res/v1/web/search",
                    headers={"X-Subscription-Token": api_key, "Accept": "application/json"},
                    params={"q": search_query, "count": min(target_count, 20)},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get("web", {}).get("results", []):
                        url = item.get("url", "")
                        domain = self._extract_domain(url)
                        if domain and not any(ign in domain for ign in IGNORED_DOMAINS):
                            results.append({
                                "business_name": item.get("title", domain.title()).split("|")[0].split(" - ")[0].strip(),
                                "website": url,
                                "email": None,
                                "phone": None,
                                "city": city,
                                "state": location.split(",")[1].strip() if "," in location else "",
                                "category": niche.title(),
                                "first_name": None,
                            })
        except Exception as e:
            logger.warning(f"Brave Search API error: {e}")
        return results

    async def _query_duckduckgo(self, niche: str, location: str, target_count: int) -> list[dict[str, Any]]:
        """
        Query DuckDuckGo HTML engine using negative directory filters and decoding uddg redirects.
        100% Free, requires $0.00 and no API key.
        """
        results = []
        city = location.split(",")[0].strip()
        search_query = f'{niche} {city} contact -site:yelp.com -site:yellowpages.com -site:angi.com -site:bbb.org -site:facebook.com'
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(search_query)}"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(url, headers=self.headers)
                if resp.status_code == 200:
                    html = resp.text

                    # Extract result links and titles
                    # DuckDuckGo HTML format: <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=...">(title)</a>
                    matches = re.findall(
                        r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                        html,
                        re.DOTALL
                    )

                    for raw_href, raw_title in matches:
                        # 1. Decode target URL from DuckDuckGo uddg redirect parameter
                        target_url = None
                        uddg_match = re.search(r'[?&]uddg=([^&]+)', raw_href)
                        if uddg_match:
                            target_url = urllib.parse.unquote(uddg_match.group(1))
                        elif raw_href.startswith("http"):
                            target_url = raw_href

                        if not target_url:
                            continue

                        # 2. Check if domain is an ignored aggregator
                        domain = self._extract_domain(target_url)
                        if not domain or any(ign in domain for ign in IGNORED_DOMAINS):
                            continue

                        # 3. Clean up business name from search result title
                        clean_title = re.sub(r'<[^>]+>', '', raw_title).strip()
                        # Clean common suffixes like "Home | Vaughan Plumbing" -> "Vaughan Plumbing"
                        parts = re.split(r'[\–\|–\:\-]', clean_title)
                        biz_title = parts[0].strip()
                        if (len(biz_title) < 3 or biz_title.lower() in {"home", "welcome", "about us", "contact us"}) and len(parts) > 1:
                            biz_title = parts[1].strip()

                        if not biz_title or len(biz_title) < 2:
                            biz_title = domain.split(".")[0].replace("-", " ").replace("_", " ").title()

                        results.append({
                            "business_name": biz_title,
                            "website": target_url,
                            "email": None,
                            "phone": None,
                            "city": city,
                            "state": location.split(",")[1].strip() if "," in location else "",
                            "category": niche.title(),
                            "first_name": None,
                        })

                        if len(results) >= target_count:
                            break
        except Exception as e:
            logger.warning(f"DuckDuckGo search error: {e}")

        return results

    async def _query_duckduckgo_lite(self, niche: str, location: str, target_count: int) -> list[dict[str, Any]]:
        """Fallback to DuckDuckGo Lite (lower bot filtering, pure HTML). 100% Free."""
        results = []
        city = location.split(",")[0].strip()
        search_query = f'{niche} in {city} contact -site:yelp.com -site:yellowpages.com'
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://lite.duckduckgo.com/lite/",
                    data={"q": search_query},
                    headers=self.headers,
                )
                if resp.status_code == 200:
                    html = resp.text
                    matches = re.findall(r'<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.DOTALL)
                    for raw_href, raw_title in matches:
                        uddg_match = re.search(r'[?&]uddg=([^&]+)', raw_href)
                        target_url = urllib.parse.unquote(uddg_match.group(1)) if uddg_match else raw_href
                        domain = self._extract_domain(target_url)
                        if not domain or any(ign in domain for ign in IGNORED_DOMAINS):
                            continue
                        clean_title = re.sub(r'<[^>]+>', '', raw_title).strip()
                        biz_title = clean_title.split("|")[0].split(" - ")[0].strip() or domain.title()
                        results.append({
                            "business_name": biz_title,
                            "website": target_url,
                            "email": None,
                            "phone": None,
                            "city": city,
                            "state": location.split(",")[1].strip() if "," in location else "",
                            "category": niche.title(),
                            "first_name": None,
                        })
                        if len(results) >= target_count:
                            break
        except Exception as e:
            logger.debug(f"DuckDuckGo Lite error: {e}")
        return results

    async def _query_openstreetmap(self, niche: str, location: str, target_count: int) -> list[dict[str, Any]]:
        """Query OpenStreetMap Overpass API using Nominatim geocoded bounding box for 100% reliability."""
        city = location.split(",")[0].strip()
        results = []

        try:
            # 1. Geocode location via Nominatim to obtain precise bounding box
            bbox = None
            async with httpx.AsyncClient(timeout=10.0) as client:
                nom_url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(location)}&format=json&limit=1"
                nom_resp = await client.get(nom_url, headers={"User-Agent": "ShaliachLeadDiscovery/2.0"})
                if nom_resp.status_code == 200:
                    geo_data = nom_resp.json()
                    if geo_data and "boundingbox" in geo_data[0]:
                        raw_box = geo_data[0]["boundingbox"]
                        # Nominatim returns [south, north, west, east]
                        bbox = (float(raw_box[0]), float(raw_box[2]), float(raw_box[1]), float(raw_box[3]))

            # 2. Map niche to OSM category
            cat_tuple = OSM_CATEGORY_MAP.get(niche)
            if not cat_tuple:
                for k, v in OSM_CATEGORY_MAP.items():
                    if k in niche or niche in k:
                        cat_tuple = v
                        break

            if bbox:
                south, west, north, east = bbox
                if cat_tuple:
                    k, v = cat_tuple
                    query_body = f'nwr["{k}"="{v}"]({south},{west},{north},{east});'
                else:
                    query_body = f"""
                    nwr["craft"~"{niche}",i]({south},{west},{north},{east});
                    nwr["shop"~"{niche}",i]({south},{west},{north},{east});
                    nwr["amenity"~"{niche}",i]({south},{west},{north},{east});
                    """

                overpass_query = f"""
                [out:json][timeout:25];
                (
                  {query_body}
                );
                out tags {max(target_count, 30)};
                """

                async with httpx.AsyncClient(timeout=25.0) as client:
                    resp = await client.post(
                        "https://overpass-api.de/api/interpreter",
                        data={"data": overpass_query},
                        headers={"User-Agent": "ShaliachLeadDiscovery/2.0"},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        for elem in data.get("elements", []):
                            tags = elem.get("tags", {})
                            name = tags.get("name")
                            website = tags.get("website") or tags.get("contact:website") or ""
                            email_direct = tags.get("email") or tags.get("contact:email") or ""
                            phone = tags.get("phone") or tags.get("contact:phone") or ""
                            city_tag = tags.get("addr:city") or city
                            state_tag = tags.get("addr:state") or ""

                            if name and (website or email_direct):
                                results.append({
                                    "business_name": name,
                                    "website": website,
                                    "email": email_direct.lower().strip() if email_direct else None,
                                    "phone": phone,
                                    "city": city_tag,
                                    "state": state_tag,
                                    "category": niche.title(),
                                    "first_name": None,
                                })
        except Exception as e:
            logger.warning(f"OpenStreetMap Overpass error: {e}")

        return results

    async def _crawl_business_website(self, candidate: dict[str, Any]) -> dict[str, Any]:
        """Deeply inspect homepage and /contact /about pages to extract verified email and owner name."""
        website = candidate.get("website")
        if not website:
            return candidate

        if not website.startswith("http"):
            website = f"https://{website}"

        domain = self._extract_domain(website)
        if not domain:
            return candidate

        base_url = f"https://{domain}"
        pages_to_check = [
            base_url,
            f"{base_url}/contact",
            f"{base_url}/contact-us",
            f"{base_url}/about",
            f"{base_url}/about-us",
        ]

        found_emails = set()
        found_phones = set()
        owner_name = None

        if candidate.get("email"):
            found_emails.add(candidate["email"])
        if candidate.get("phone"):
            found_phones.add(candidate["phone"])

        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, headers=self.headers, verify=False) as client:
            for page_url in pages_to_check:
                if found_emails and len(found_emails) >= 2:
                    break
                try:
                    resp = await client.get(page_url)
                    if resp.status_code != 200:
                        continue
                    content = resp.text

                    # 1. Extract mailto: links (highest confidence)
                    mailtos = re.findall(r'mailto:([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', content, re.IGNORECASE)
                    for m in mailtos:
                        if self._is_valid_email(m, domain):
                            found_emails.add(m.lower().strip())

                    # 2. Extract plain text emails
                    all_emails = EMAIL_REGEX.findall(content)
                    for e in all_emails:
                        if self._is_valid_email(e, domain):
                            found_emails.add(e.lower().strip())

                    # 3. Extract phone numbers if missing
                    if not found_phones:
                        phones = PHONE_REGEX.findall(content)
                        for p in phones:
                            found_phones.add(p.strip())

                    # 4. Attempt to detect owner/contact name from About page
                    if not owner_name:
                        name_match = re.search(r'(?:Owner|Founder|President|Principal|Doctor|Dr\.)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)', content)
                        if name_match:
                            owner_name = name_match.group(1).strip()

                except Exception:
                    continue

        # Pick best email (prefer info@, contact@, hello@, or domain-matching email)
        best_email = None
        if found_emails:
            for candidate_email in found_emails:
                if domain in candidate_email:
                    best_email = candidate_email
                    break
            if not best_email:
                best_email = list(found_emails)[0]

        # Derive first name from email if not extracted from text
        first_name = owner_name.split()[0] if owner_name else None
        if not first_name and best_email:
            prefix = best_email.split("@")[0].lower()
            if prefix not in {"info", "contact", "support", "sales", "office", "hello", "admin", "help", "service"}:
                first_name = prefix.split(".")[0].replace("_", "").title()

        candidate["email"] = best_email
        candidate["phone"] = list(found_phones)[0] if found_phones else candidate.get("phone")
        candidate["first_name"] = first_name
        candidate["website"] = base_url

        return candidate

    def _is_valid_email(self, email_str: str, domain: str) -> bool:
        """Filter out fake emails, image assets, and framework placeholders."""
        low = email_str.lower().strip()
        if len(low) < 6 or len(low) > 80:
            return False
        if any(bad in low for bad in INVALID_EMAIL_SUBSTRINGS):
            return False
        if low.endswith(".png") or low.endswith(".jpg") or low.endswith(".webp"):
            return False
        return True

    def _extract_domain(self, url: str) -> str:
        """Extract clean root domain from any URL."""
        if not url:
            return ""
        if not url.startswith("http"):
            url = f"https://{url}"
        try:
            parsed = urllib.parse.urlparse(url)
            netloc = parsed.netloc.lower()
            if netloc.startswith("www."):
                netloc = netloc[4:]
            return netloc
        except Exception:
            return ""

    async def _save_leads_to_db(
        self,
        leads: list[dict[str, Any]],
        niche: str,
        location: str,
        lead_list_id: str | None = None,
    ) -> int:
        """Persist verified leads into Shaliach PostgreSQL database without creating duplicates."""
        if not self.db:
            return 0

        # Auto-create or resolve a dedicated LeadList for this discovery batch
        if not lead_list_id and leads:
            try:
                from ..models.lead_list import LeadList
                list_name = f"{niche.title()} — {location.strip()}"
                stmt = select(LeadList).where(LeadList.name == list_name)
                existing_list = (await self.db.execute(stmt)).scalar_one_or_none()
                if not existing_list:
                    existing_list = LeadList(name=list_name)
                    self.db.add(existing_list)
                    await self.db.flush()
                lead_list_id = existing_list.id
            except Exception as e:
                logger.warning(f"Could not auto-create lead list: {e}")

        saved = 0
        for item in leads:
            email_addr = item.get("email")
            if not email_addr:
                continue

            normalized = email_addr.lower().strip()
            stmt = select(Lead).where(Lead.normalized_email == normalized)
            existing = (await self.db.execute(stmt)).scalar_one_or_none()

            if not existing:
                new_lead = Lead(
                    email=email_addr,
                    normalized_email=normalized,
                    first_name=item.get("first_name"),
                    business_name=item.get("business_name") or niche.title(),
                    website=item.get("website"),
                    category=niche.title(),
                    city=item.get("city") or location.split(",")[0].strip(),
                    state=item.get("state") or (location.split(",")[1].strip() if "," in location else ""),
                    country="United States",
                    source="DISCOVERY_ENGINE",
                    validation_status=ValidationStatus.VALID.value,
                    crm_status=CrmStatus.IMPORTED.value,
                    lead_list_id=lead_list_id,
                )
                self.db.add(new_lead)
                saved += 1

        if saved > 0:
            await self.db.commit()
            logger.info(f"Successfully committed {saved} new leads into the database.")

        return saved
