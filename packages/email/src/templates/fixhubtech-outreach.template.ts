export interface FixHubTechEmailTemplateParams {
  bodyHtml: string;
  bodyText: string;
  senderName?: string;
  senderTitle?: string;
  companyName?: string;
  websiteUrl?: string;
  postalAddress?: string;
  unsubscribeUrl?: string;
}

export function renderFixHubTechHtmlEmail(params: FixHubTechEmailTemplateParams): string {
  const senderName = params.senderName || 'Joshua Caleb';
  const senderTitle = params.senderTitle || 'Founder & Web Developer';
  const companyName = params.companyName || 'FixHubTech';
  const websiteUrl = params.websiteUrl || 'https://fixhubtech.com';
  const postalAddress = params.postalAddress || 'FixHubTech Digital Solutions, United States';
  const unsubscribeUrl = params.unsubscribeUrl || '#';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
    }
    .wrapper {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      padding: 24px 32px 16px 32px;
      border-bottom: 2px solid #0f172a;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #0f172a;
      margin: 0;
    }
    .brand-subtitle {
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .content {
      padding: 32px;
      font-size: 15px;
      color: #334155;
    }
    .content p {
      margin-top: 0;
      margin-bottom: 16px;
    }
    .content a {
      color: #2563eb;
      text-decoration: underline;
    }
    .signature {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #f1f5f9;
    }
    .sig-name {
      font-weight: 700;
      font-size: 15px;
      color: #0f172a;
      margin: 0;
    }
    .sig-title {
      font-size: 13px;
      color: #64748b;
      margin: 2px 0;
    }
    .sig-link {
      font-size: 13px;
      color: #2563eb;
      text-decoration: none;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 32px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.5;
    }
    .footer a {
      color: #64748b;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-title">${companyName.toUpperCase()}</div>
      <div class="brand-subtitle">Web Design &amp; Digital Solutions</div>
    </div>
    <div class="content">
      ${params.bodyHtml}
      
      <div class="signature">
        <p class="sig-name">${senderName}</p>
        <p class="sig-title">${senderTitle}</p>
        <p class="sig-title">${companyName}</p>
        <a class="sig-link" href="${websiteUrl}">${websiteUrl.replace(/^https?:\/\//, '')}</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px 0;">${postalAddress}</p>
      <p style="margin: 0;">
        If you prefer not to receive future emails, you can 
        <a href="${unsubscribeUrl}" target="_blank">unsubscribe here</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function renderFixHubTechTextEmail(params: FixHubTechEmailTemplateParams): string {
  const senderName = params.senderName || 'Joshua Caleb';
  const senderTitle = params.senderTitle || 'Founder & Web Developer';
  const companyName = params.companyName || 'FixHubTech';
  const websiteUrl = params.websiteUrl || 'https://fixhubtech.com';
  const postalAddress = params.postalAddress || 'FixHubTech Digital Solutions, United States';
  const unsubscribeUrl = params.unsubscribeUrl || 'https://app.fixhubtech.com/unsubscribe';

  return `${companyName.toUpperCase()}
Web Design & Digital Solutions
────────────────────────────────────────────

${params.bodyText.trim()}

--
${senderName}
${senderTitle}
${companyName}
${websiteUrl.replace(/^https?:\/\//, '')}

────────────────────────────────────────────
${postalAddress}
Unsubscribe: ${unsubscribeUrl}
`;
}
