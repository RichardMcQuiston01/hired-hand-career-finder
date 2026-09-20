import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Checks the Likert radio labelled `"<value>. <label>"`, e.g. `"4. Like"`. */
export async function answerCurrentQuestion(page: Page, value: number): Promise<void> {
  await page.getByRole('radio', { name: new RegExp(`^${value}\\.`) }).check();
}

/**
 * Starts the 30-question short form and answers every question with the
 * same value, landing on the results step. Every question must be answered
 * — `InterestProfilerPanel`'s submit handler requires exactly 30 answers
 * matching `/^[1-5]{30}$/` before it will call the results/careers
 * endpoints — so this always walks the full form rather than a handful of
 * questions.
 */
export async function completeShortAssessment(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Short form — 30 questions' }).click();
  await expect(page.getByText(/Question 1 of 30/)).toBeVisible();

  for (let index = 0; index < 30; index++) {
    await answerCurrentQuestion(page, 4);
    const isLast = index === 29;
    await page.getByRole('button', { name: isLast ? 'Submit' : 'Next' }).click();
  }

  await expect(page.getByRole('heading', { name: 'Your results', exact: true })).toBeVisible();
}
