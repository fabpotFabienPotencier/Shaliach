import { renderFixHubTechHtmlEmail, renderFixHubTechTextEmail, FixHubTechEmailTemplateParams } from './fixhubtech-outreach.template';

export function renderFixHubTechFollowUpHtml(params: FixHubTechEmailTemplateParams): string {
  return renderFixHubTechHtmlEmail(params);
}

export function renderFixHubTechFollowUpText(params: FixHubTechEmailTemplateParams): string {
  return renderFixHubTechTextEmail(params);
}
