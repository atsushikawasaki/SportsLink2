import { type Page } from '@playwright/test';

export async function loginAs(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|tournaments)/, { timeout: 10000 });
}

export async function loginAsAdmin(page: Page) {
    const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
    const password = process.env.E2E_ADMIN_PASSWORD ?? 'password123';
    await loginAs(page, email, password);
}
