/**
 * Regression test for https://github.com/radix-ui/primitives/issues/4228
 *
 * React 17 has no `React.startTransition`. The provider used to fall back to an
 * empty function in that case, which silently dropped its state updates, so the
 * viewport never mounted and no toast ever rendered. This simulates a React
 * build without `startTransition` and asserts the toast still renders.
 */
import * as React from 'react';
import type * as ReactTypes from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  // Simulate React 17, which has no `startTransition` export.
  const mocked = { ...(actual as unknown as Record<string, unknown>), startTransition: undefined };
  return { ...mocked, default: mocked };
});

import * as Toast from './toast';

describe('react without `startTransition` (e.g. React 17)', () => {
  afterEach(cleanup);

  it('renders the toast', () => {
    render(
      <Toast.Provider>
        <Toast.Root open duration={Infinity}>
          <Toast.Title>Hello</Toast.Title>
        </Toast.Root>
        <Toast.Viewport />
      </Toast.Provider>,
    );
    expect(screen.getByText('Hello')).toBeTruthy();
  });
});
