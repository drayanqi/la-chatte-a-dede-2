/**
 * Panel Layout E2E Tests (collapsible & resizable workspace panels)
 *
 * Tests the user-facing promise end to end: dragging a divider resizes a
 * workspace panel and the width survives a reload; collapsing a panel
 * leaves a thin strip that also survives a reload and expands back to the
 * stored width; double-click resets. Everything persists through the
 * `panel_layout` localStorage key.
 *
 * @see Feature: Collapsible & Resizable Workspace Panels
 */
import { test, expect, type Page } from '../support/fixtures';
import { seedAuthToken } from '../support/helpers/auth';

/** Drag a divider by dx px with raw mouse events (pointer capture path) */
const dragDivider = async (page: Page, testId: string, dx: number): Promise<void> => {
  const divider = page.getByTestId(testId);
  const box = await divider.boundingBox();
  if (!box) throw new Error(`Divider ${testId} not visible`);

  // Grab at 25% height: the chevron button sits vertically centered
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 4;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY, { steps: 10 });
  await page.mouse.up();
};

/** Read the inline width style of a panel element */
const getInlineWidth = async (page: Page, testId: string): Promise<string> => {
  return page.getByTestId(testId).evaluate((element) => (element as HTMLElement).style.width);
};

test.describe('Panel Layout', () => {
  test('should resize the left panel by dragging and restore the width after reload @P0', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/workspace');
    await expect(page.getByTestId('tab-bar')).toBeVisible();

    // Fresh workspace: panels at defaults and no key until first change
    const leftPanel = page.getByTestId('left-panel');
    await expect(leftPanel).toBeVisible();
    await expect(leftPanel).toHaveCSS('width', '280px');
    expect(await page.evaluate(() => localStorage.getItem('panel_layout'))).toBeNull();

    // Drag the left divider +120px: width follows the pointer live
    await dragDivider(page, 'panel-divider-left', 120);
    await expect(leftPanel).toHaveCSS('width', '400px');
    expect(await getInlineWidth(page, 'left-panel')).toBe('400px');

    // Persisted on pointer-up
    const stored = await page.evaluate(() => localStorage.getItem('panel_layout'));
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '{}')).toMatchObject({
      leftWidth: 400,
      rightWidth: 300,
      leftCollapsed: false,
      rightCollapsed: false,
    });

    // Reload: the width is restored exactly
    await page.reload();
    const reloadedPanel = page.getByTestId('left-panel');
    await expect(reloadedPanel).toBeVisible();
    await expect(reloadedPanel).toHaveCSS('width', '400px');
    expect(await getInlineWidth(page, 'left-panel')).toBe('400px');
  });

  test('should resize the right panel with inverted direction and restore after reload @P1', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/workspace');
    await expect(page.getByTestId('tab-bar')).toBeVisible();

    const rightPanel = page.getByTestId('right-panel');
    await expect(rightPanel).toBeVisible();
    await expect(rightPanel).toHaveCSS('width', '300px');

    // Dragging the right divider LEFT (-120px) WIDENS the right panel
    await dragDivider(page, 'panel-divider-right', -120);
    await expect(rightPanel).toHaveCSS('width', '420px');
    expect(await getInlineWidth(page, 'right-panel')).toBe('420px');

    await page.reload();
    const reloadedPanel = page.getByTestId('right-panel');
    await expect(reloadedPanel).toBeVisible();
    await expect(reloadedPanel).toHaveCSS('width', '420px');
    expect(await getInlineWidth(page, 'right-panel')).toBe('420px');
  });

  test('should reset the width on divider double-click @P1', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/workspace');
    await expect(page.getByTestId('tab-bar')).toBeVisible();

    await dragDivider(page, 'panel-divider-left', 120);
    const leftPanel = page.getByTestId('left-panel');
    await expect(leftPanel).toHaveCSS('width', '400px');

    // Double-click the divider body (away from the chevron) -> default width
    const divider = page.getByTestId('panel-divider-left');
    const box = await divider.boundingBox();
    if (!box) throw new Error('Divider not visible');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 4, { clickCount: 2 });

    await expect(leftPanel).toHaveCSS('width', '280px');
    const stored = await page.evaluate(() => localStorage.getItem('panel_layout'));
    expect(JSON.parse(stored ?? '{}')).toMatchObject({ leftWidth: 280 });
  });

  test('should collapse panels to strips, persist across reloads and expand @P0', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/workspace');
    await expect(page.getByTestId('tab-bar')).toBeVisible();

    // Collapse the left panel via its divider chevron
    await page.getByTestId('panel-divider-left-toggle').click();

    const leftStrip = page.getByTestId('panel-strip-left');
    await expect(leftStrip).toBeVisible();
    await expect(page.getByTestId('left-panel')).toHaveCount(0);
    expect(await getInlineWidth(page, 'panel-strip-left')).toBe('28px');

    const stored = await page.evaluate(() => localStorage.getItem('panel_layout'));
    expect(JSON.parse(stored ?? '{}')).toMatchObject({
      leftCollapsed: true,
      leftWidth: 280,
    });

    // Collapse the right panel too, then reload: both strips persist
    await page.getByTestId('panel-divider-right-toggle').click();
    await expect(page.getByTestId('panel-strip-right')).toBeVisible();
    await expect(page.getByTestId('right-panel')).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('panel-strip-left')).toBeVisible();
    await expect(page.getByTestId('panel-strip-right')).toBeVisible();
    await expect(page.getByTestId('left-panel')).toHaveCount(0);
    await expect(page.getByTestId('right-panel')).toHaveCount(0);

    // Expand from the strip: the panel reappears at its stored width
    await page.getByTestId('panel-strip-left').click();
    const leftPanel = page.getByTestId('left-panel');
    await expect(leftPanel).toBeVisible();
    await expect(leftPanel).toHaveCSS('width', '280px');
    await expect(page.getByTestId('panel-strip-left')).toHaveCount(0);
  });
});
