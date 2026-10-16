import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 32,
  height: 32,
};
export const revalidate = 60; // Cache for 60s
export const contentType = 'image/png';

export default async function Icon() {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || 'https://api.shaliach.fixhubtech.com';

  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/settings/branding`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.logoUrl) {
        let logoUrl = data.logoUrl;
        if (logoUrl.startsWith('/')) {
          logoUrl = `${apiUrl.replace(/\/+$/, '')}${logoUrl}`;
        }
        return new ImageResponse(
          (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
              }}
            >
              <img
                src={logoUrl}
                alt="Workspace Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
          ),
          {
            ...size,
          }
        );
      }
    }
  } catch (err) {
    // Fall back to brand initial
  }

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 20,
          background: '#4f46e5',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '8px',
          fontWeight: 900,
        }}
      >
        S
      </div>
    ),
    {
      ...size,
    }
  );
}
