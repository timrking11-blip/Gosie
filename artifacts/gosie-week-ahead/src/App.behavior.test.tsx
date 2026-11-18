import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

const sampleEventTitles = [
  'Set a gentle intention',
  'Focus block',
  'Project planning hour',
  'Take the longer way home',
  'Catch-up with a teammate',
  'Make something simple for dinner',
  'A little stretch break',
  'Creative work session',
  'Close a few loops',
  'A no-plan evening',
  'Browse the neighborhood market',
  'Room for a good book',
  'Slow breakfast',
  'A soft landing for Monday',
];

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayAbbreviations = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const fourCoreOutings = [
  'A late set in a listening room',
  'Restored film, little theater',
  'Long lunch, shared plates',
  'Riverside walk & small market',
];
const actionStorageKey = 'gosie-week-ahead-actions-v1';

function renderApp(path = '/') {
  window.history.replaceState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  cleanup();
});

describe('Week Ahead sample behavior', () => {
  it('keeps every sample event and all seven day groups in chronological view', () => {
    const { container } = renderApp();

    expect(container.querySelectorAll('.event-line')).toHaveLength(14);
    for (const title of sampleEventTitles) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    for (const weekday of weekdays) {
      expect(screen.getByRole('heading', { name: weekday })).toBeTruthy();
    }
  });

  it('keeps every event and every represented weekday when grouped by category', () => {
    const { container } = renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'By kind' }));

    expect(container.querySelectorAll('.category-event')).toHaveLength(14);
    expect(container.querySelectorAll('.category-group')).toHaveLength(4);
    for (const title of sampleEventTitles) {
      expect(screen.getByText(title)).toBeTruthy();
    }

    const eventTimes = [...container.querySelectorAll('.category-event time')].map((time) => time.textContent ?? '');
    for (const day of dayAbbreviations) {
      expect(eventTimes.some((time) => time.startsWith(`${day} ·`))).toBe(true);
    }
  });

  it('reorders outings for a selected context without removing any sample', async () => {
    const { container } = renderApp('/outings');

    const titlesBefore = [...container.querySelectorAll('.outing-card h4')].map((heading) => heading.textContent);
    expect(titlesBefore).toHaveLength(13);
    for (const title of fourCoreOutings) {
      expect(titlesBefore).toContain(title);
    }
    expect(screen.getByText(/13 in view/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Friends' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save choices on this device' }));

    await waitFor(() => {
      const titlesAfter = [...container.querySelectorAll('.outing-card h4')].map((heading) => heading.textContent);
      expect(titlesAfter).toHaveLength(13);
      expect(new Set(titlesAfter)).toEqual(new Set(titlesBefore));
      for (const title of fourCoreOutings) {
        expect(titlesAfter).toContain(title);
      }
      expect(titlesAfter).not.toEqual(titlesBefore);
      expect(screen.getByText(/Ordered for Friends · 13 in view/)).toBeTruthy();
    });
  });

  it('expands and collapses a sample outing explanation', () => {
    renderApp('/outings');
    const firstCard = screen.getAllByRole('article')[0];
    const card = within(firstCard);
    const openButton = card.getByRole('button', { name: 'Why this sample is ranked here' });

    expect(openButton.getAttribute('aria-expanded')).toBe('false');
    expect(card.queryByText(/fictional .* idea/i)).toBeNull();

    fireEvent.click(openButton);
    expect(card.getByRole('button', { name: 'Close the why' }).getAttribute('aria-expanded')).toBe('true');
    expect(card.getByText(/illustrative—not verified event facts/)).toBeTruthy();

    fireEvent.click(card.getByRole('button', { name: 'Close the why' }));
    expect(card.getByRole('button', { name: 'Why this sample is ranked here' }).getAttribute('aria-expanded')).toBe('false');
    expect(card.queryByText(/illustrative—not verified event facts/)).toBeNull();
  });

  it('saves checklist ticks locally and restores them when the app is mounted again', async () => {
    const firstRender = renderApp();
    const checkbox = screen.getByRole('checkbox', { name: /Choose one thing to make easier/ });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(actionStorageKey) ?? '{}')).toMatchObject({ a1: true });
    });
    expect((checkbox as HTMLInputElement).checked).toBe(true);

    firstRender.unmount();
    renderApp();
    expect((screen.getByRole('checkbox', { name: /Choose one thing to make easier/ }) as HTMLInputElement).checked).toBe(true);
  });
});
