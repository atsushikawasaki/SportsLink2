import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('大会管理フロー', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('大会一覧ページが表示される', async ({ page }) => {
        await page.goto('/tournaments');
        await expect(page.locator('h1', { hasText: '大会一覧' })).toBeVisible({ timeout: 10000 });
    });

    test('大会作成フォームが表示される', async ({ page }) => {
        await page.goto('/tournaments/new');
        await expect(page.locator('input[name="name"], input[placeholder*="大会名"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('大会名なしで作成しようとするとエラー', async ({ page }) => {
        await page.goto('/tournaments/new');
        await page.locator('button[type="submit"]').first().click();
        await expect(page.locator('text=/必須|required|入力/i').first()).toBeVisible({ timeout: 5000 });
    });
});
