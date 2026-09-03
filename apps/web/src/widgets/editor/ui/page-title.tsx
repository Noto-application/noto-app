'use client';

import { PAGE_TITLE_MAX_LENGTH } from '@noto/shared';
import { useState } from 'react';

import { usePageTitleAutosave } from '../model/use-page-title-autosave';

type PageTitleProps = {
  pageId: string;
  projectId: string;
  title: string;
};

export function PageTitle({ pageId, projectId, title }: PageTitleProps) {
  const [value, setValue] = useState(title);
  const { onChange } = usePageTitleAutosave(pageId, projectId);

  return (
    <input
      aria-label="Заголовок страницы"
      className="text-page-title text-foreground w-full bg-transparent outline-none"
      value={value}
      maxLength={PAGE_TITLE_MAX_LENGTH}
      onChange={(event) => {
        setValue(event.target.value);
        onChange(event.target.value);
      }}
    />
  );
}
