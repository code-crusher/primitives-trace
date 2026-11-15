/**
 * Regression test for https://github.com/radix-ui/primitives/issues/4228
 *
 * React < 18 throws "Nothing was returned from render" when a component
 * returns `undefined`. `Slottable` used to return `props.children` as-is, so a
 * self-closing `<Slottable />` crashed hosts (e.g. `NavigationMenu.Viewport`)
 * on React 17. It now falls back to rendering `null`.
 */
import * as React from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import * as Slot from './slot';

describe('Slottable without children', () => {
  afterEach(cleanup);

  it('returns `null` (not `undefined`) when given no children or child', () => {
    const Slottable = Slot.createSlottable('Test');
    // React < 18 throws "Nothing was returned from render" for `undefined`.
    expect((Slottable as (props: object) => unknown)({})).toBe(null);
    expect((Slottable as (props: object) => unknown)({ children: undefined })).toBe(null);
  });

  it('renders nothing and does not throw', () => {
    const Slottable = Slot.createSlottable('Test');
    const { container } = render(
      <div>
        <Slottable />
      </div>,
    );
    expect(container.innerHTML).toBe('<div></div>');
  });
});
