import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ContextMenu from './context-menu';

describe('repro #4095', () => {
  afterEach(cleanup);

  it('clicking item inside nested sub fires onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    const describeEl = (el: EventTarget | null | undefined) => {
      if (!(el instanceof HTMLElement)) return String(el);
      const role = el.getAttribute('role');
      const label = el.getAttribute('aria-label') ?? el.getAttribute('id') ?? '';
      return `<${el.tagName.toLowerCase()} role=${role} id=${label} text=${JSON.stringify(
        el.textContent?.slice(0, 30),
      )}>`;
    };

    let itemRef: HTMLElement | null = null;
    let subContentRef: HTMLElement | null = null;

    render(
      <ContextMenu.Root>
        <ContextMenu.Trigger>Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content>
            <ContextMenu.Sub>
              <ContextMenu.SubTrigger>Actions</ContextMenu.SubTrigger>
              <ContextMenu.Portal>
                <ContextMenu.SubContent
                  ref={(node: HTMLElement | null) => {
                    subContentRef = node;
                  }}
                  onFocusOutside={(e) => {
                    const orig = e.detail?.originalEvent as FocusEvent;
                    console.log(
                      'SUB onFocusOutside: e.target=',
                      describeEl(e.target),
                      'origTarget=',
                      describeEl(orig?.target),
                      'relatedTarget=',
                      describeEl(orig?.relatedTarget),
                    );
                  }}
                >
                  <ContextMenu.Item
                    ref={(node: HTMLElement | null) => {
                      itemRef = node;
                    }}
                    onClick={onClick}
                  >
                    Do the thing
                  </ContextMenu.Item>
                </ContextMenu.SubContent>
              </ContextMenu.Portal>
            </ContextMenu.Sub>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>,
    );

    await user.pointer([{ keys: '[MouseRight]', target: screen.getByText('Right click me') }]);
    const subTrigger = await screen.findByText('Actions');
    await user.hover(subTrigger);
    const item = await screen.findByText('Do the thing');
    await waitFor(() => expect(item).toBeVisible());

    const logFocus = (event: FocusEvent) => {
      console.log(
        `DOC ${event.type}: target=${describeEl(event.target)} related=${describeEl(
          event.relatedTarget,
        )}`,
      );
    };
    document.addEventListener('focusin', logFocus, true);
    document.addEventListener('focusout', logFocus, true);

    console.log('--- CLICK --- item=', describeEl(item), 'subContent=', describeEl(subContentRef));
    await user.click(item);
    console.log('--- onClick calls:', onClick.mock.calls.length);
  });
});
