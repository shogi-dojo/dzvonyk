import { test, expect } from '@playwright/test';
import path from 'path';

test('Teacher rename in real roz file produces exactly 1 history entry', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  // 1. Upload ROZ file from notes
  const rozPath = path.resolve('../notes/Останній 1_b8aedb47-5e1d-4adc-814c-f2ab51729012.roz');
  const fileInput = page.locator('input[accept=".roz"]');
  await fileInput.setInputFiles(rozPath);

  // Verify preview dialog opens
  const dialogTitle = page.getByText(/попередній перегляд імпорту/i);
  await expect(dialogTitle).toBeVisible({ timeout: 10_000 });

  // Confirm import
  const confirmBtn = page.getByRole('button', { name: /^імпортувати$/i });
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();
  await expect(dialogTitle).not.toBeVisible({ timeout: 10_000 });

  // Open history drawer to see count after import
  const historyTrigger = page.getByRole('button', { name: /історія змін/i });
  await expect(historyTrigger).toBeVisible();
  await historyTrigger.click();
  
  const drawer = page.locator('aside[aria-label="Історія змін"]').or(page.getByRole('complementary')).or(page.locator('aside').last());
  await expect(drawer).toBeVisible();
  
  const headerCount = await drawer.locator('span', { hasText: /\d+\s*\/\s*100/ }).textContent();
  console.log('Initial history count after import:', headerCount);
  const initialCount = parseInt(headerCount?.split('/')[0].trim() || '0', 10);

  // Close history drawer by clicking close button
  await drawer.getByRole('button', { name: /закрити історію/i }).or(drawer.locator('button:has(svg.lucide-x)')).click();

  // 2. Click sidebar link to go to Teachers page
  await page.locator('aside').first().getByRole('link', { name: /вчителі/i }).click();
  await expect(page.getByText('Вчителі').first()).toBeVisible();

  // Wait for teacher cards
  const editTeacherBtn = page.locator('button:has(svg.lucide-pencil)').first();
  await expect(editTeacherBtn).toBeVisible({ timeout: 10_000 });
  await editTeacherBtn.click();

  // Edit dialog should appear
  const nameInput = page.getByLabel(/прізвище та ім'я|ім'я/i).or(page.locator('input[name="name"]')).or(page.locator('form input').first());
  await expect(nameInput).toBeVisible();
  const oldName = await nameInput.inputValue();
  const newName = oldName + ' Тест';
  await nameInput.fill(newName);

  // Click Submit (Оновити)
  await page.getByRole('button', { name: /оновити|зберегти/i }).click();
  await expect(page.getByText(newName).first()).toBeVisible();

  // 3. Open history drawer and inspect entries
  await historyTrigger.click();
  await expect(drawer).toBeVisible();

  const updatedHeaderCount = await drawer.locator('span', { hasText: /\d+\s*\/\s*100/ }).textContent();
  console.log('Updated history count after rename:', updatedHeaderCount);
  const updatedCount = parseInt(updatedHeaderCount?.split('/')[0].trim() || '0', 10);

  // Collect all history items
  const items = await drawer.locator('.rounded-lg.border.p-3').allTextContents();
  console.log('History entries after rename:');
  items.slice(0, 10).forEach((item, idx) => console.log(` [${idx}] ${item.replace(/\s+/g, ' ')}`));

  // The count should have increased by EXACTLY 1!
  expect(updatedCount).toBe(initialCount + 1);
});
