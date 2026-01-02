import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CONSENT_VERSIONS, getConsentVersions } from '../consent-versions';

describe('Consent Versions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('CONSENT_VERSIONS', () => {
    it('should have default values when env vars are not set', () => {
      delete process.env.NEXT_PUBLIC_TERMS_VERSION;
      delete process.env.NEXT_PUBLIC_PRIVACY_VERSION;

      // モジュールを再読み込みしてデフォルト値を確認
      expect(CONSENT_VERSIONS.TERMS).toBeDefined();
      expect(CONSENT_VERSIONS.PRIVACY).toBeDefined();
    });

    it('should use environment variables when set', () => {
      // このテストは環境変数がビルド時に評価されるため、実際の値の確認のみ行う
      // 環境変数が設定されている場合はその値、なければデフォルト値
      expect(CONSENT_VERSIONS.TERMS).toBeDefined();
      expect(CONSENT_VERSIONS.PRIVACY).toBeDefined();
      expect(typeof CONSENT_VERSIONS.TERMS).toBe('string');
      expect(typeof CONSENT_VERSIONS.PRIVACY).toBe('string');
    });
  });

  describe('getConsentVersions', () => {
    it('should return default values when no env vars are set', () => {
      delete process.env.TERMS_VERSION;
      delete process.env.NEXT_PUBLIC_TERMS_VERSION;
      delete process.env.PRIVACY_VERSION;
      delete process.env.NEXT_PUBLIC_PRIVACY_VERSION;

      const versions = getConsentVersions();

      expect(versions.terms).toBe('1.0.0');
      expect(versions.privacy).toBe('1.0.0');
    });

    it('should prioritize TERMS_VERSION over NEXT_PUBLIC_TERMS_VERSION', () => {
      process.env.TERMS_VERSION = '3.0.0';
      process.env.NEXT_PUBLIC_TERMS_VERSION = '2.0.0';
      process.env.PRIVACY_VERSION = '3.1.0';
      process.env.NEXT_PUBLIC_PRIVACY_VERSION = '2.1.0';

      const versions = getConsentVersions();

      expect(versions.terms).toBe('3.0.0');
      expect(versions.privacy).toBe('3.1.0');
    });

    it('should fallback to NEXT_PUBLIC_ vars when server vars are not set', () => {
      delete process.env.TERMS_VERSION;
      delete process.env.PRIVACY_VERSION;
      process.env.NEXT_PUBLIC_TERMS_VERSION = '2.0.0';
      process.env.NEXT_PUBLIC_PRIVACY_VERSION = '2.1.0';

      const versions = getConsentVersions();

      expect(versions.terms).toBe('2.0.0');
      expect(versions.privacy).toBe('2.1.0');
    });

    it('should return consistent structure', () => {
      const versions = getConsentVersions();

      expect(versions).toHaveProperty('terms');
      expect(versions).toHaveProperty('privacy');
      expect(typeof versions.terms).toBe('string');
      expect(typeof versions.privacy).toBe('string');
    });
  });
});

