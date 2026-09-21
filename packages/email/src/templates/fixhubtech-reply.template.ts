import { renderFixHubTechHtmlEmail, renderFixHubTechTextEmail, FixHubTechEmailTemplateParams } from './fixhubtech-outreach.template';

export function renderFixHubTechReplyHtml(params: FixHubTechEmailTemplateParams): string {
  return renderFixHubTechHtmlEmail(params);
}

export function renderFixHubTechReplyText(params: FixHubTechEmailTemplateParams): string {
  return renderFixHubTechTextEmail(params);
}
