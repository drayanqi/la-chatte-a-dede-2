/**
 * GuidePage Component Unit Tests
 *
 * Tests the dedicated /guide documentation page (story 8.4):
 * - Renders every topic section with its visual and code blocks
 * - moveToward shows its warning law; versus shows both scripts
 * - Copy button uses the clipboard and shows the "Copié !" feedback
 * - TOC click activates the topic
 *
 * @see Epic 8: Scripting Documentation Cookbook
 * @see Story 8.4: Dedicated Documentation Page
 * @priority P1
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GuidePage } from '@/pages/GuidePage';
import { GUIDE_TOPICS } from '@/lib/scriptingGuide';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

describe('GuidePage Component', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    useThemeStore.setState({ theme: 'light' });
    useAuthStore.getState().reset();
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'user-1',
        username: 'Pelo',
        email: 'pelo@example.com',
        points: 1240,
      },
    });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <GuidePage />
      </MemoryRouter>,
    );

  it('renders every topic section with its visual', () => {
    renderPage();

    for (const topic of GUIDE_TOPICS) {
      expect(screen.getByRole('heading', { name: topic.title })).toBeTruthy();
      expect(screen.getByTestId(`guide-toc-${topic.id}`)).toBeTruthy();
    }
    // Visuals: 6 topics carry a gif/svg (all but "lire le jeu")
    const visuals = GUIDE_TOPICS.filter((topic) => topic.gif);
    expect(visuals.length).toBe(6);
    for (const topic of visuals) {
      expect(screen.getByTestId(`guide-visual-${topic.id}`)).toBeTruthy();
    }
  });

  it('shows the moveToward warning law and both versus scripts', () => {
    renderPage();

    expect(screen.getByTestId('guide-warning-move-toward').textContent).toContain('RELÂCHE');

    const versusCodes = screen.getAllByTestId('guide-code-versus');
    expect(versusCodes.length).toBe(2);
    expect(versusCodes[0]?.textContent).toContain('moveToward');
    // The dribbler plays the opponent seat: its ego-frame target (30) is the
    // mirrored world x=70 shown in the GIF — never the raw world literal.
    expect(versusCodes[1]?.textContent).toContain('dribble(30, 25)');
    expect(versusCodes[1]?.textContent).not.toContain('dribble(70, 25)');
  });

  it('teaches the v3.0 mirror law with no removed v2 vocabulary', () => {
    renderPage();

    // The mirror law opens the terrain topic, in plain terms.
    const terrain = GUIDE_TOPICS.find((topic) => topic.id === 'terrain');
    expect(terrain?.paragraphs[0]).toContain('TON but à x=0');
    expect(terrain?.paragraphs[0]).toContain('aucun script');

    // No topic may USE a removed v2 member (the removal itself is named on
    // purpose in the facts list, to teach the replacement).
    const serialized = JSON.stringify(GUIDE_TOPICS);
    expect(serialized).not.toContain('me.hasBall');
    expect(serialized).not.toContain('me.isClosestToBall');
    expect(serialized).not.toContain('me.team');
    expect(serialized).toContain('ball.owner === me');
    expect(serialized).toContain('isTeammate');
  });

  it('copies an example to the clipboard with feedback', async () => {
    renderPage();

    fireEvent.click(screen.getByTestId('guide-copy-move-toward'));
    await vi.waitFor(() => {
      expect(screen.getByTestId('guide-copy-move-toward').textContent).toBe('Copié !');
    });
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('me.moveToward(70, 25)'),
    );
  });

  it('activates a TOC entry on click', () => {
    renderPage();

    const entry = screen.getByTestId('guide-toc-dribble');
    expect(entry.getAttribute('style')).not.toContain('1.5px var(--corail)');
    fireEvent.click(entry);
    // Active state draws the coral ring (scrollIntoView is a no-op in jsdom)
    expect(entry.getAttribute('style')).toContain('1.5px var(--corail)');
  });
});
