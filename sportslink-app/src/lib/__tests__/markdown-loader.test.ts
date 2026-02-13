import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted でモックを定義し、vi.mock ファクトリとテストで同じ参照を使う
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockReaddirSync = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  default: {
    readFileSync: mockReadFileSync,
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
  },
}));

vi.mock('path', () => ({
  default: {
    join: (...args: string[]) => args.join('/'),
  },
  join: (...args: string[]) => args.join('/'),
}));

import { loadMarkdownDocument, getAvailableVersions } from '../markdown-loader';

describe('markdown-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadMarkdownDocument', () => {
    it('should load markdown document successfully', async () => {
      const mockContent = '# Terms of Service\n\n**バージョン**: 1.0.0\n\n**最終更新日**: 2024年1月1日\n\nContent here.';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(mockContent);

      const result = await loadMarkdownDocument('terms', '1.0.0');

      expect(result.content).toBe(mockContent);
      expect(result.version).toBe('1.0.0');
      expect(result.lastUpdated).toBe('2024年1月1日');
    });

    it('should extract version from content', async () => {
      const mockContent = '# Privacy Policy\n\n**バージョン**: 2.1.0\n\nContent here.';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(mockContent);

      const result = await loadMarkdownDocument('privacy', 'latest');

      expect(result.version).toBe('2.1.0');
    });

    it('should extract last updated date from content', async () => {
      const mockContent = '# Terms\n\n**最終更新日**: 2024年12月31日\n\nContent.';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(mockContent);

      const result = await loadMarkdownDocument('terms', '1.0.0');

      expect(result.lastUpdated).toBe('2024年12月31日');
    });

    it('should throw error when file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(loadMarkdownDocument('terms', '999.0.0')).rejects.toThrow('Document not found');
    });

    it('should handle missing version in content', async () => {
      const mockContent = '# Terms\n\nContent without version.';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(mockContent);

      const result = await loadMarkdownDocument('terms', '1.0.0');

      expect(result.version).toBe('1.0.0');
      expect(result.lastUpdated).toBeNull();
    });

    it('should handle missing last updated date', async () => {
      const mockContent = '# Terms\n\nContent without date.';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(mockContent);

      const result = await loadMarkdownDocument('terms', '1.0.0');

      expect(result.lastUpdated).toBeNull();
    });
  });

  describe('getAvailableVersions', () => {
    it('should return sorted versions in descending order', async () => {
      mockReaddirSync.mockReturnValue([
        '1.0.0.md',
        '2.0.0.md',
        '1.5.0.md',
        'latest.md',
        '2.1.0.md',
      ]);

      const versions = await getAvailableVersions('terms');

      expect(versions).toEqual(['2.1.0', '2.0.0', '1.5.0', '1.0.0']);
      expect(versions).not.toContain('latest');
    });

    it('should exclude latest.md from versions', async () => {
      mockReaddirSync.mockReturnValue([
        '1.0.0.md',
        'latest.md',
      ]);

      const versions = await getAvailableVersions('privacy');

      expect(versions).toEqual(['1.0.0']);
      expect(versions).not.toContain('latest');
    });

    it('should return empty array on error', async () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error('Directory not found');
      });

      const versions = await getAvailableVersions('terms');

      expect(versions).toEqual([]);
    });

    it('should handle single version', async () => {
      mockReaddirSync.mockReturnValue(['1.0.0.md']);

      const versions = await getAvailableVersions('privacy');

      expect(versions).toEqual(['1.0.0']);
    });

    it('should sort versions correctly with different lengths', async () => {
      mockReaddirSync.mockReturnValue([
        '1.0.0.md',
        '1.0.md',
        '2.0.0.0.md',
        '1.0.0.1.md',
      ]);

      const versions = await getAvailableVersions('terms');

      expect(versions[0]).toBe('2.0.0.0');
      expect(versions[1]).toBe('1.0.0.1');
      expect(versions[2]).toBe('1.0.0');
      expect(versions[3]).toBe('1.0');
    });
  });
});
