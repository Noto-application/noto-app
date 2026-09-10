import { describe, expect, it } from 'vitest';

import { buildCollabUrl } from './collab-url';

describe('buildCollabUrl', () => {
  it('http origin → ws + путь /collab', () => {
    expect(buildCollabUrl('http://localhost:8080')).toBe('ws://localhost:8080/collab');
  });

  it('https origin → wss', () => {
    expect(buildCollabUrl('https://noto.app')).toBe('wss://noto.app/collab');
  });

  it('отбрасывает query и hash origin', () => {
    expect(buildCollabUrl('http://localhost:8080/?x=1#h')).toBe('ws://localhost:8080/collab');
  });
});
