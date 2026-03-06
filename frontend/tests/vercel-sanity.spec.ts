import { test, expect } from '@playwright/test';

// Get URL from environment or fallback
const VERCEL_URL = process.env.VERCEL_URL || 'https://administracion-medica-industrial.vercel.app';

test.describe('Vercel Sanity Checks', () => {

    test('Login and Navigate to Dashboard', async ({ page }) => {
        // Debug
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('requestfailed', request => console.log('REQ FAILED:', request.url(), request.failure()?.errorText));
        page.on('response', response => {
            if (response.status() >= 400) {
                console.log('HTTP ERROR:', response.status(), response.url());
            }
        });

        console.log(`Navigating to ${VERCEL_URL}/login...`);
        await page.goto(`${VERCEL_URL}/login`);
        
        // Wait for potential redirect if session exists
        await page.waitForTimeout(2000);

        if (page.url().includes('/dashboard')) {
             console.log('Already logged in!');
        } else {
             console.log('Filling login form...');
             // Ensure inputs are ready
             await page.waitForSelector('input[type="email"]');
             
             await page.fill('input[type="email"]', 'admin@sistema.com');
             await page.fill('input[type="password"]', 'Admin@123');
             
             console.log('Clicking submit...');
             await page.click('button[type="submit"]');
             
             // Wait for response (either dashboard or error)
             try {
                // Wait for URL change OR error message
                await Promise.race([
                    page.waitForURL(/.*dashboard/, { timeout: 10000 }),
                    page.waitForSelector('.text-red-700', { timeout: 10000 }), // Common Tailwind error class
                    page.waitForSelector('.text-red-500', { timeout: 10000 }),
                    page.waitForSelector('.bg-red-50', { timeout: 10000 })
                ]);
             } catch (e) {
                console.log('Timeout waiting for login response.');
             }
        }
        
        // Diagnostic
        if (page.url().includes('login')) {
            console.log('STILL ON LOGIN PAGE. Checking for errors...');
            
            // Check for specific error messages
            const errorLocator = page.locator('.text-red-700, .text-red-500, [role="alert"], .bg-red-50');
            if (await errorLocator.count() > 0) {
                const errorText = await errorLocator.first().textContent();
                console.log('LOGIN ERROR DETECTED:', errorText);
            } else {
                console.log('No error message visible.');
            }
            
            // Check button state
            const btn = page.locator('button[type="submit"]');
            if (await btn.isDisabled()) {
                console.log('Submit button is disabled.');
            } else {
                console.log('Submit button is enabled.');
            }
        
             // Check requests (maybe 401?)
             // Not easy without network mocking, but we can assume credentials mismatch if UI error says so
        }

        // Final Assertion
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 5000 });
        console.log('Dashboard access confirmed.');
        
        /* 
           If login succeeds, we want to verify the dynamic route.
           Since we don't have a known ID, let's list appointments and try to click one if available.
        */
        console.log('Navigating to Appointments List...');
        await page.goto(`${VERCEL_URL}/admin/appointments`);
        await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
        console.log('Appointments list loaded successfully.');

    });

});
