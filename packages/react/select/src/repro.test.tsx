import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import * as Select from './select';

describe('repro', () => {
  afterEach(cleanup);

  it('repro', async () => {
    const violations: Array<{ element: Element; active: Element | null }> = [];
    const setAttribute = Element.prototype.setAttribute;
    const spy = vi
      .spyOn(Element.prototype, 'setAttribute')
      .mockImplementation(function (this: Element, name: string, value: string) {
        if (name === 'aria-hidden' && value !== 'false') {
          const active = this.ownerDocument.activeElement;
          if (active && this.contains(active)) {
            violations.push({ element: this, active });
          }
        }
        return setAttribute.call(this, name, value);
      });

    render(
      <section>
        <Select.Root defaultValue="apple">
          <Select.Trigger aria-label="Kind">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content>
              <Select.Viewport>
                <Select.Item value="apple">
                  <Select.ItemText>Apple</Select.ItemText>
                </Select.Item>
                <Select.Item value="banana">
                  <Select.ItemText>Banana</Select.ItemText>
                </Select.Item>
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </section>,
    );

    const trigger = screen.getByRole('combobox');
    act(() => trigger.focus());

    await act(async () => {
      fireEvent.keyDown(trigger, { key: 'Enter' });
      fireEvent.keyUp(trigger, { key: 'Enter' });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    spy.mockRestore();
    console.log(
      'VIOLATIONS',
      JSON.stringify(
        violations.map((v) => ({ element: v.element.tagName, active: v.active?.tagName })),
      ),
    );
    expect(violations).toEqual([]);
  });
});
