import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('スコアリングフロー', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('担当試合一覧ページが表示される', async ({ page }) => {
        await page.goto('/assigned-matches');
        await expect(page.locator('h1', { hasText: '担当試合一覧' })).toBeVisible({ timeout: 10000 });
    });

    test('存在しない試合IDでスコアリングページにアクセスするとエラー表示', async ({ page }) => {
        await page.goto('/scoring/non-existent-match-id');
        await expect(
            page.locator('text=/見つかりません|not found|エラー/i').first()
        ).toBeVisible({ timeout: 10000 });
    });
});
