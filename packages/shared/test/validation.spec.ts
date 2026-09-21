import {
  isValidEmailSyntax,
  normalizeEmail,
  normalizeWebsite,
} from '../src/validation/email.validation';

describe('Shared Validation Utilities', () => {
  describe('isValidEmailSyntax', () => {
    it('should validate valid email formats', () => {
      expect(isValidEmailSyntax('joshua@fixhubtech.com')).toBe(true);
      expect(isValidEmailSyntax('client.name+tag@example.co.uk')).toBe(true);
      expect(isValidEmailSyntax('info@sub.domain.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmailSyntax('plainaddress')).toBe(false);
      expect(isValidEmailSyntax('@missingusername.com')).toBe(false);
      expect(isValidEmailSyntax('username@.com')).toBe(false);
      expect(isValidEmailSyntax('spaces in email@domain.com')).toBe(false);
      expect(isValidEmailSyntax('')).toBe(false);
    });
  });

  describe('normalizeEmail', () => {
    it('should trim and lowercase emails', () => {
      expect(normalizeEmail('  Joshua@FixHubTech.COM ')).toBe('joshua@fixhubtech.com');
    });
  });

  describe('normalizeWebsite', () => {
    it('should normalize URLs with https protocol', () => {
      expect(normalizeWebsite('fixhubtech.com')).toBe('https://fixhubtech.com');
      expect(normalizeWebsite('http://fixhubtech.com/')).toBe('https://fixhubtech.com');
      expect(normalizeWebsite('')).toBeNull();
    });
  });
});
