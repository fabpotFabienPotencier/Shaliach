'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, getAssetUrl } from '@/lib/api';

export function DynamicFavicon() {
  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: () => apiFetch('/api/settings/branding'),
    staleTime: 1000 * 60, // 1 minute
  });

  useEffect(() => {
    if (!branding) return;

    // Dynamically update document title if custom appName is provided
    if (branding.appName && typeof document !== 'undefined') {
      const currentTitle = document.title;
      if (!currentTitle || currentTitle.includes('Shaliach AI') || currentTitle.includes('SHALIACH AI')) {
        document.title = `${branding.appName} — Outreach & Sales Intelligence`;
      }
    }

    if (!branding.logoUrl || typeof document === 'undefined') return;

    const fullLogoUrl = getAssetUrl(branding.logoUrl);
    if (!fullLogoUrl) return;

    // Dynamically update or create favicon link tags in document head
    const iconRels = ['icon', 'shortcut icon', 'apple-touch-icon'];

    iconRels.forEach((rel) => {
      let link = document.querySelector(`link[rel='${rel}']`) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = fullLogoUrl;

      const lower = fullLogoUrl.toLowerCase();
      if (lower.includes('.svg')) {
        link.type = 'image/svg+xml';
      } else if (lower.includes('.png')) {
        link.type = 'image/png';
      } else if (lower.includes('.jpg') || lower.includes('.jpeg')) {
        link.type = 'image/jpeg';
      } else if (lower.includes('.webp')) {
        link.type = 'image/webp';
      } else if (lower.includes('.ico')) {
        link.type = 'image/x-icon';
      }
    });
  }, [branding]);

  return null;
}
