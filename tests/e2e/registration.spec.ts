
import { expect, type Locator, type Page } from '@playwright/test';

export class RegistrationPage {
  readonly page: Page;

  // Registration form
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Form fields: prefer accessible labels, then common HTML attributes
    this.nameInput = page.getByRole('textbox', {
      name: /full name|name|ชื่อ-นามสกุล|ชื่อ/i,
    }).first();

    this.emailInput = page.getByRole('textbox', {
      name: /email|อีเมล/i,
    }).first();

    this.passwordInput = page.locator(
      'input[type="password"]'
    ).nth(0);

    this.confirmPasswordInput = page.locator(
      'input[type="password"]'
    ).nth(1);

    this.submitButton = page.getByRole('button', {
      name: /sign up|register|create account|สมัครสมาชิก|ลงทะเบียน/i,
    }).first();
  }

  /**
   * Open the registration page.
   */
  async goto(): Promise<void> {
    await this.page.goto('/register');

    await expect(this.nameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
  }

  /**
   * Fill all registration fields.
   */
  async fillForm(
    name: string,
    email: string,
    password: string,
    confirmPassword: string
  ): Promise<void> {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
  }

  /**
   * Submit the registration form.
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Verify that all four password policy rules are displayed.
   *
   * Rule order expected by the supplied test:
   * 0 = at least 8 characters
   * 1 = uppercase letter A-Z
   * 2 = lowercase letter a-z
   * 3 = digit 0-9
   */
  async expectPasswordPolicyVisible(): Promise<void> {
    const rules = [
      /8 characters|8 ตัวอักษร|อย่างน้อย 8/i,
      /uppercase|capital letter|ตัวพิมพ์ใหญ่|A-Z/i,
      /lowercase|ตัวพิมพ์เล็ก|a-z/i,
      /number|digit|ตัวเลข|0-9/i,
    ];

    for (const rule of rules) {
      await expect(
        this.page.getByText(rule).first()
      ).toBeVisible();
    }
  }

  /**
   * Check whether a password rule currently passes.
   *
   * This implementation supports common visual indicators.
   * Adjust selectors to match the real application's markup.
   */
  async passwordRulePassed(ruleIndex: number): Promise<boolean> {
    if (ruleIndex < 0 || ruleIndex > 3) {
      throw new Error(
        `Invalid password rule index: ${ruleIndex}. Expected 0-3.`
      );
    }

    const rules = [
      /8 characters|8 ตัวอักษร|อย่างน้อย 8/i,
      /uppercase|capital letter|ตัวพิมพ์ใหญ่|A-Z/i,
      /lowercase|ตัวพิมพ์เล็ก|a-z/i,
      /number|digit|ตัวเลข|0-9/i,
    ];

    const ruleLocator = this.page.getByText(rules[ruleIndex]).first();

    await expect(ruleLocator).toBeVisible();

    const className = await ruleLocator.getAttribute('class');
    const dataState = await ruleLocator.getAttribute('data-state');
    const ariaLabel = await ruleLocator.getAttribute('aria-label');

    const stateText = [
      className ?? '',
      dataState ?? '',
      ariaLabel ?? '',
    ].join(' ').toLowerCase();

    // Common success-state class names and accessible states.
    if (
      /text-green|text-success|valid|passed|success|check-circle/.test(
        stateText
      ) ||
      dataState === 'checked'
    ) {
      return true;
    }

    if (
      /text-red|text-error|invalid|failed|error/.test(stateText) ||
      dataState === 'unchecked'
    ) {
      return false;
    }

    // Fallback: inspect a nearby element for common success styling.
    const parent = ruleLocator.locator('..');
    const parentClass = (
      (await parent.getAttribute('class')) ?? ''
    ).toLowerCase();

    if (
      /text-green|text-success|valid|passed|success/.test(parentClass)
    ) {
      return true;
    }

    if (
      /text-red|text-error|invalid|failed|error/.test(parentClass)
    ) {
      return false;
    }

    throw new Error(
      `Cannot determine password rule ${ruleIndex + 1} state. ` +
      'Inspect the actual registration page DOM and update the success/failure selectors.'
    );
  }

  /**
   * Verify successful registration.
   *
   * Accepts a success message or navigation away from /register.
   * Update the expected destination if the application uses another flow.
   */
  async expectRegistrationSuccess(): Promise<void> {
    const successMessage = this.page
      .locator(
        '[role="status"], [role="alert"], [data-testid*="success" i]'
      )
      .filter({
        hasText:
          /registered successfully|registration successful|account created|สมัครสมาชิกสำเร็จ|ลงทะเบียนสำเร็จ/i,
      })
      .first();

    const successMessageVisible = await successMessage
      .isVisible()
      .catch(() => false);

    if (successMessageVisible) {
      await expect(successMessage).toBeVisible();
      return;
    }

    await expect(this.page).not.toHaveURL(/\/register(?:[/?#]|$)/);
  }
}
