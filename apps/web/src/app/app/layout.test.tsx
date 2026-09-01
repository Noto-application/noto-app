// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import AppLayout from './layout';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/src/widgets/sidebar', () => ({
  Sidebar: () => <aside>Sidebar</aside>,
  useSidebarStore: <T,>(selector: (state: { setDrawerOpen: () => void }) => T) =>
    selector({ setDrawerOpen: vi.fn() }),
}));

vi.mock('@/src/widgets/topbar', () => ({
  Topbar: () => <header>Topbar</header>,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppLayout', () => {
  it('показывает один общий alert, если список проектов не загрузился', async () => {
    vi.spyOn(apiClient.projects, 'list').mockRejectedValue(new TypeError('Network error'));

    render(
      <AppLayout>
        <div>Содержимое страницы</div>
      </AppLayout>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить проекты');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
