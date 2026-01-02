import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';

/**
 * Markdownファイルを読み込む
 * @param documentType 'terms' | 'privacy'
 * @param version バージョン番号（'latest' の場合は最新版）
 * @returns Markdownコンテンツとメタデータ
 */
export async function loadMarkdownDocument(
    documentType: 'terms' | 'privacy',
    version: string = 'latest'
): Promise<{ content: string; version: string; lastUpdated: string | null }> {
    try {
        const filePath = path.join(
            process.cwd(),
            'src',
            'content',
            documentType,
            `${version}.md`
        );

        // ファイルが存在しない場合はエラー
        if (!existsSync(filePath)) {
            throw new Error(`Document not found: ${documentType}/${version}.md`);
        }

        const content = readFileSync(filePath, 'utf-8');

        // メタデータを抽出（frontmatter形式または本文から）
        const lastUpdated = extractLastUpdated(content);
        const docVersion = extractVersion(content) || version;

        return {
            content,
            version: docVersion,
            lastUpdated,
        };
    } catch (error) {
        console.error(`Failed to load ${documentType} document:`, error);
        throw error;
    }
}

/**
 * Markdownコンテンツから最終更新日を抽出
 */
function extractLastUpdated(content: string): string | null {
    const match = content.match(/\*\*最終更新日\*\*:\s*(\d{4}年\d{1,2}月\d{1,2}日)/);
    return match ? match[1] : null;
}

/**
 * Markdownコンテンツからバージョンを抽出
 */
function extractVersion(content: string): string | null {
    const match = content.match(/\*\*バージョン\*\*:\s*([\d.]+)/);
    return match ? match[1] : null;
}

/**
 * 利用可能なバージョン一覧を取得
 */
export async function getAvailableVersions(
    documentType: 'terms' | 'privacy'
): Promise<string[]> {
    try {
        const dirPath = path.join(process.cwd(), 'src', 'content', documentType);
        const files = readdirSync(dirPath);
        return files
            .filter((file) => file.endsWith('.md') && file !== 'latest.md')
            .map((file) => file.replace('.md', ''))
            .sort((a, b) => {
                // バージョン番号でソート（降順）
                const aParts = a.split('.').map(Number);
                const bParts = b.split('.').map(Number);
                for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                    const aVal = aParts[i] || 0;
                    const bVal = bParts[i] || 0;
                    if (bVal !== aVal) return bVal - aVal;
                }
                return 0;
            });
    } catch (error) {
        console.error(`Failed to get versions for ${documentType}:`, error);
        return [];
    }
}

