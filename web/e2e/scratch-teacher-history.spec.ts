import { test, expect } from '@playwright/test';
import path from 'path';

test('Teacher rename and direct block click rollback in history', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });

  // 1. Upload ROZ file from notes
  const rozPath = path.resolve('../notes/Останній 1_b8aedb47-5e1d-4adc-814c-f2ab51729012.roz');
  const fileInput = page.locator('input[accept=".roz"]');
  await fileInput.setInputFiles(rozPath);

  // Confirm import
  const confirmBtn = page.getByRole('button', { name: /^імпортувати$/i });
  await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
  await confirmBtn.click();

  // 2. Navigate to Teachers page
  await page.locator('aside').first().getByRole('link', { name: /вчителі/i }).click();
  await expect(page.getByText('Вчителі').first()).toBeVisible();

  // Find first teacher card and click edit
  const editTeacherBtn = page.locator('button:has(svg.lucide-pencil)').first();
  await expect(editTeacherBtn).toBeVisible({ timeout: 10_000 });
  await editTeacherBtn.click();

  // Change name
  const nameInput = page.getByLabel(/прізвище та ім'я|ім'я/i).or(page.locator('input[name="name"]')).or(page.locator('form input').first());
  await expect(nameInput).toBeVisible();
  const oldName = await nameInput.inputValue();
  const newName = oldName + ' Тест';
  await nameInput.fill(newName);

  // Click Submit (Оновити)
  await page.getByRole('button', { name: /оновити|зберегти/i }).click();
  await expect(page.getByText(newName).first()).toBeVisible();

  // 3. Open history drawer
  const historyTrigger = page.getByRole('button', { name: /історія змін/i });
  await historyTrigger.click();
  
  const drawer = page.locator('aside[aria-label="Історія змін"]').or(page.getByRole('complementary')).or(page.locator('aside').last());
  await expect(drawer).toBeVisible();

  // Previous entry block should be clickable
  const previousBlock = drawer.locator('[role="button"]').first();
  await expect(previousBlock).toBeVisible();
  
  // Click directly on the block to rollback!
  await previousBlock.click();

  // Close history drawer
  await drawer.getByRole('button', { name: /закрити/i }).click();

  // Teacher name should be reverted back to oldName!
  await expect(page.getByText(oldName).first()).toBeVisible();
  await expect(page.getByText(newName)).not.toBeVisible();
});
