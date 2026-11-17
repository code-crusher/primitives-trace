import * as React from 'react';
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as RovingFocusGroup from './roving-focus-group';

// Regression tests for https://github.com/radix-ui/primitives/issues/4136
describe('keyboard navigation', () => {
  afterEach(cleanup);

  function renderGroup(props?: React.ComponentProps<typeof RovingFocusGroup.Root>) {
    render(
      <RovingFocusGroup.Root {...props}>
        <RovingFocusGroup.Item>One</RovingFocusGroup.Item>
        <RovingFocusGroup.Item>Two</RovingFocusGroup.Item>
        <RovingFocusGroup.Item>Three</RovingFocusGroup.Item>
      </RovingFocusGroup.Root>,
    );
    return {
      one: screen.getByText('One'),
      two: screen.getByText('Two'),
      three: screen.getByText('Three'),
    };
  }

  it('moves focus to the next item on ArrowRight synchronously within the keydown', () => {
    const { one, two } = renderGroup();

    one.focus();
    fireEvent.keyDown(one, { key: 'ArrowRight' });

    expect(two).toHaveFocus();
  });

  it('moves focus to the previous item on ArrowLeft synchronously within the keydown', () => {
    const { two, one } = renderGroup();

    two.focus();
    fireEvent.keyDown(two, { key: 'ArrowLeft' });

    expect(one).toHaveFocus();
  });

  it('handles consecutive arrow keys dispatched in the same tick', () => {
    const { one, three } = renderGroup();

    one.focus();
    // Two keydowns dispatched synchronously, before any deferred work (and before
    // any re-render triggered by the first key press) has a chance to run.
    fireEvent.keyDown(one, { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByText('Two'), { key: 'ArrowRight' });

    expect(three).toHaveFocus();
  });

  it('moves focus to the last item on End synchronously within the keydown', () => {
    const { one, three } = renderGroup();

    one.focus();
    fireEvent.keyDown(one, { key: 'End' });

    expect(three).toHaveFocus();
  });
});
