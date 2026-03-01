import { test, expect } from '@playwright/test';

test.describe('認証フロー', () => {
    test('無効な認証情報でログイン失敗', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"]', 'invalid@example.com');
        await page.fill('input[type="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        await expect(page.locator('text=/エラー|失敗|無効/').first()).toBeVisible({ timeout: 5000 });
    });

    test('未認証でダッシュボードへアクセスするとログインにリダイレクト', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('未認証でトーナメント一覧へアクセスするとログインにリダイレクト', async ({ page }) => {
        await page.goto('/tournaments');
        await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('ログインページが正しく表示される', async ({ page }) => {
        await page.goto('/login');
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });
});
