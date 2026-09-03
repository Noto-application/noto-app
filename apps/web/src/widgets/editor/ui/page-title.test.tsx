// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { autosaveOnChange } = vi.hoisted(() => ({
  autosaveOnChange: vi.fn(),
}));

vi.mock('../model/use-page-title-autosave', () => ({
  usePageTitleAutosave: () => ({ onChange: autosaveOnChange }),
}));

import { PageTitle } from './page-title';

const pageId = '00000000-0000-4000-8000-000000000001';
const projectId = '00000000-0000-4000-8000-000000000002';

afterEach(() => {
  vi.clearAllMocks();
});

describe('PageTitle', () => {
  it('показывает переданный title как значение поля', () => {
    render(<PageTitle pageId={pageId} projectId={projectId} title="Overview" />);

    expect(screen.getByRole('textbox', { name: 'Заголовок страницы' })).toHaveValue('Overview');
  });

  it('отдаёт новое значение в usePageTitleAutosave.onChange при вводе', async () => {
    const user = userEvent.setup();
    render(<PageTitle pageId={pageId} projectId={projectId} title="Overview" />);

    await user.type(screen.getByRole('textbox', { name: 'Заголовок страницы' }), '!');

    expect(autosaveOnChange).toHaveBeenLastCalledWith('Overview!');
  });
});
