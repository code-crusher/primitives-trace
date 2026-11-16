import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertStableComposedRef } from '@repo/test-utils/ref-stability';
import * as DismissableLayer from './dismissable-layer';

async function waitForDocumentPointerDownListener() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function renderDismissableLayer(
  props: React.ComponentProps<typeof DismissableLayer.Root> = {},
  extraContent?: React.ReactNode,
) {
  return render(
    <>
      <DismissableLayer.Root {...props}>
        <button type="button">inside</button>
      </DismissableLayer.Root>
      {extraContent}
      <button type="button">outside</button>
    </>,
  );
}

function dispatchComposedPointerDown(target: Element) {
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      composed: true,
      pointerType: 'mouse',
    }),
  );
}

function firePointerMouseClick(target: Element) {
  fireEvent.pointerDown(target, { pointerType: 'mouse' });
  fireEvent.mouseDown(target);
  fireEvent.pointerUp(target, { pointerType: 'mouse' });
  fireEvent.mouseUp(target);
  fireEvent.click(target);
}

// A separate window like a `window.open` popup. Its elements come from
// another realm: `instanceof Node` is false for them even though they are
// regular DOM nodes.
// See https://github.com/radix-ui/primitives/issues/4219
const popupDom = new JSDOM('<!doctype html><html><body></body></html>');
const popupWindow = popupDom.window;
const popupDocument = popupWindow.document;

function createPopupElement(tagName: string, textContent: string) {
  const element = popupDocument.createElement(tagName);
  element.textContent = textContent;
  return element;
}

/**
 * Renders a layer into the popup window's document (like content portalled
 * into a `window.open` popup) and returns its container plus a cleanup
 * function.
 */
async function renderLayerIntoPopup(
  onDismiss: () => void,
  options: { deferPointerDownOutside?: boolean; extraContent?: React.ReactNode } = {},
) {
  const { deferPointerDownOutside = false, extraContent } = options;
  const container = popupDocument.createElement('div');
  popupDocument.body.append(container);

  const root = createRoot(container);
  await act(async () => {
    root.render(
      <>
        <DismissableLayer.Root
          deferPointerDownOutside={deferPointerDownOutside}
          onDismiss={onDismiss}
        >
          <button type="button">inside</button>
        </DismissableLayer.Root>
        {extraContent}
      </>,
    );
  });

  return {
    container,
    cleanupPopup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/**
 * Waits for the layer rendered into the popup window to register its
 * outside event listeners.
 */
async function waitForPopupPointerDownListener() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function ShadowButton() {
  const hostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || host.shadowRoot) {
      return;
    }

    const shadowRoot = host.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'inside shadow';
    shadowRoot.append(button);
  }, []);

  return <div data-testid="inside-shadow-host" ref={hostRef} />;
}

describe('DismissableLayer', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('dismisses on an outside pointer interaction', async () => {
    const onPointerDownOutside = vi.fn();
    const onInteractOutside = vi.fn();
    const onDismiss = vi.fn();

    renderDismissableLayer({ onPointerDownOutside, onInteractOutside, onDismiss });
    await waitForDocumentPointerDownListener();

    firePointerMouseClick(screen.getByText('outside'));

    expect(onPointerDownOutside).toHaveBeenCalledTimes(1);
    expect(onInteractOutside).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses immediately on pointer down outside by default', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({ onDismiss });
    await waitForDocumentPointerDownListener();

    fireEvent.pointerDown(screen.getByText('outside'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss on pointer down inside', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({ onDismiss });
    await waitForDocumentPointerDownListener();

    fireEvent.pointerDown(screen.getByText('inside'));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does not dismiss when pointer down outside is prevented', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({
      onPointerDownOutside: (event) => event.preventDefault(),
      onDismiss,
    });
    await waitForDocumentPointerDownListener();

    firePointerMouseClick(screen.getByText('outside'));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does not dismiss when interact outside is prevented for a pointer down outside event', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({
      onInteractOutside: (event) => event.preventDefault(),
      onDismiss,
    });
    await waitForDocumentPointerDownListener();

    firePointerMouseClick(screen.getByText('outside'));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  // Regression test for https://github.com/radix-ui/primitives/issues/4219
  it('dismisses on a pointer down outside in another window', async () => {
    const onDismiss = vi.fn();

    const { cleanupPopup } = await renderLayerIntoPopup(onDismiss);
    await waitForPopupPointerDownListener();

    const outside = createPopupElement('button', 'popup outside');
    popupDocument.body.append(outside);
    outside.dispatchEvent(new popupWindow.MouseEvent('pointerdown', { bubbles: true }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    cleanupPopup();
    outside.remove();
  });

  // Regression test for https://github.com/radix-ui/primitives/issues/4219
  it('dismisses on a deferred outside tap on a dismiss surface in another window', async () => {
    const onDismiss = vi.fn();

    function Surface() {
      const registerSurface = DismissableLayer.useDismissableLayerSurface();
      return (
        <div
          ref={registerSurface}
          data-popup-surface=""
          onClick={(event) => event.stopPropagation()}
        >
          surface
        </div>
      );
    }

    const { container, cleanupPopup } = await renderLayerIntoPopup(onDismiss, {
      deferPointerDownOutside: true,
      extraContent: <Surface />,
    });
    await waitForPopupPointerDownListener();

    const surface = container.querySelector('[data-popup-surface]')!;
    surface.dispatchEvent(new popupWindow.MouseEvent('pointerdown', { bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();

    await act(async () => {
      surface.dispatchEvent(new popupWindow.MouseEvent('click', { bubbles: true }));
    });
    await waitForPopupPointerDownListener();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    cleanupPopup();
  });

  // Regression test for https://github.com/radix-ui/primitives/issues/4219
  it('does not exempt a stopped interaction outside in another window without a dismiss surface', async () => {
    const onDismiss = vi.fn();

    const { cleanupPopup } = await renderLayerIntoPopup(onDismiss, {
      deferPointerDownOutside: true,
    });
    await waitForPopupPointerDownListener();

    const outside = createPopupElement('button', 'popup outside');
    popupDocument.body.append(outside);
    for (const eventName of ['mousedown', 'mouseup', 'click'] as const) {
      outside.addEventListener(eventName, (event) => event.stopPropagation());
    }

    outside.dispatchEvent(new popupWindow.MouseEvent('pointerdown', { bubbles: true }));
    outside.dispatchEvent(new popupWindow.MouseEvent('mousedown', { bubbles: true }));
    outside.dispatchEvent(new popupWindow.MouseEvent('mouseup', { bubbles: true }));
    outside.dispatchEvent(new popupWindow.MouseEvent('click', { bubbles: true }));
    await waitForPopupPointerDownListener();

    expect(onDismiss).not.toHaveBeenCalled();
    cleanupPopup();
    outside.remove();
  });

  it('dismisses on focus outside', () => {
    const onFocusOutside = vi.fn();
    const onInteractOutside = vi.fn();
    const onDismiss = vi.fn();

    renderDismissableLayer({ onFocusOutside, onInteractOutside, onDismiss });

    fireEvent.focusIn(screen.getByText('outside'));

    expect(onFocusOutside).toHaveBeenCalledTimes(1);
    expect(onInteractOutside).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss on focus inside', () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({ onDismiss });

    fireEvent.focusIn(screen.getByText('inside'));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does not dismiss when interacting with a branch', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer(
      { onDismiss },
      <DismissableLayer.Branch>
        <button type="button">branch</button>
      </DismissableLayer.Branch>,
    );
    await waitForDocumentPointerDownListener();

    fireEvent.pointerDown(screen.getByText('branch'));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('defers touch pointer down outside dismissal until click', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({ deferPointerDownOutside: true, onDismiss });
    await waitForDocumentPointerDownListener();

    fireEvent.pointerDown(screen.getByText('outside'), { pointerType: 'touch' });
    expect(onDismiss).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('outside'));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not flush sync when a deferred outside click is dispatched from a passive effect', async () => {
    const onDismiss = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    function DispatchClickOnMount({
      targetRef,
    }: {
      targetRef: React.RefObject<HTMLButtonElement | null>;
    }) {
      React.useEffect(() => {
        targetRef.current?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, [targetRef]);

      return null;
    }

    function Test({ dispatchClick }: { dispatchClick: boolean }) {
      const outsideRef = React.useRef<HTMLButtonElement>(null);

      return (
        <form>
          <DismissableLayer.Root deferPointerDownOutside onDismiss={onDismiss}>
            <button type="button">inside</button>
          </DismissableLayer.Root>
          <button type="button" ref={outsideRef}>
            outside
          </button>
          {dispatchClick && <DispatchClickOnMount targetRef={outsideRef} />}
        </form>
      );
    }

    const rendered = render(<Test dispatchClick={false} />);
    await waitForDocumentPointerDownListener();

    fireEvent.pointerDown(screen.getByText('outside'));

    await act(async () => {
      rendered.rerender(<Test dispatchClick />);
    });

    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining('flushSync was called from inside a lifecycle method'),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses immediately on non-primary mouse pointer down outside', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({ onDismiss });
    await waitForDocumentPointerDownListener();

    fireEvent.pointerDown(screen.getByText('outside'), { button: 2, pointerType: 'mouse' });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses immediately on non-primary pen pointer down outside', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({ onDismiss });
    await waitForDocumentPointerDownListener();

    fireEvent.pointerDown(screen.getByText('outside'), { button: 2, pointerType: 'pen' });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('cancels pending touch outside dismissal when pointer down moves back inside', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({ deferPointerDownOutside: true, onDismiss });
    await waitForDocumentPointerDownListener();

    fireEvent.pointerDown(screen.getByText('outside'), { pointerType: 'touch' });
    fireEvent.pointerDown(screen.getByText('inside'));
    fireEvent.click(screen.getByText('outside'));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('treats a shadow tree inside the layer as inside', async () => {
    const onDismiss = vi.fn();

    render(
      <>
        <DismissableLayer.Root onDismiss={onDismiss}>
          <ShadowButton />
        </DismissableLayer.Root>
        <button type="button">outside</button>
      </>,
    );
    await waitForDocumentPointerDownListener();

    const shadowButton = screen
      .getByTestId('inside-shadow-host')
      .shadowRoot?.querySelector('button');
    expect(shadowButton).toBeInstanceOf(HTMLButtonElement);

    dispatchComposedPointerDown(shadowButton!);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses when a later outside interaction event is stopped by default', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({ onDismiss });
    await waitForDocumentPointerDownListener();

    const outside = screen.getByText('outside');
    const stopPropagation = (event: Event) => event.stopPropagation();
    outside.addEventListener('mousedown', stopPropagation);
    outside.addEventListener('mouseup', stopPropagation);
    outside.addEventListener('click', stopPropagation);

    fireEvent.pointerDown(outside);
    fireEvent.mouseDown(outside);
    fireEvent.mouseUp(outside);
    fireEvent.click(outside);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when a later outside interaction event is stopped and pointer down outside is deferred', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({ deferPointerDownOutside: true, onDismiss });
    await waitForDocumentPointerDownListener();

    const outside = screen.getByText('outside');
    const stopPropagation = (event: Event) => event.stopPropagation();
    outside.addEventListener('mousedown', stopPropagation);
    outside.addEventListener('mouseup', stopPropagation);
    outside.addEventListener('click', stopPropagation);

    fireEvent.pointerDown(outside);
    fireEvent.mouseDown(outside);
    fireEvent.mouseUp(outside);
    fireEvent.click(outside);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses when a registered dismiss surface stops propagation', async () => {
    const onDismiss = vi.fn();

    function Surface() {
      const registerSurface = DismissableLayer.useDismissableLayerSurface();
      return (
        <div ref={registerSurface} onClick={(event) => event.stopPropagation()}>
          surface
        </div>
      );
    }

    render(
      <>
        <DismissableLayer.Root deferPointerDownOutside onDismiss={onDismiss}>
          <button type="button">inside</button>
        </DismissableLayer.Root>
        <Surface />
      </>,
    );
    await waitForDocumentPointerDownListener();

    firePointerMouseClick(screen.getByText('surface'));
    await waitForDocumentPointerDownListener();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses when a registered dismiss surface stops propagation without deferring', async () => {
    const onDismiss = vi.fn();

    function Surface() {
      const registerSurface = DismissableLayer.useDismissableLayerSurface();
      return (
        <div ref={registerSurface} onClick={(event) => event.stopPropagation()}>
          surface
        </div>
      );
    }

    render(
      <>
        <DismissableLayer.Root onDismiss={onDismiss}>
          <button type="button">inside</button>
        </DismissableLayer.Root>
        <Surface />
      </>,
    );
    await waitForDocumentPointerDownListener();

    firePointerMouseClick(screen.getByText('surface'));
    await waitForDocumentPointerDownListener();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('only exempts registered dismiss surfaces from stopped propagation', async () => {
    const onDismiss = vi.fn();

    function Surface() {
      const registerSurface = DismissableLayer.useDismissableLayerSurface();
      return (
        <div ref={registerSurface} onClick={(event) => event.stopPropagation()}>
          surface
        </div>
      );
    }

    render(
      <>
        <DismissableLayer.Root deferPointerDownOutside onDismiss={onDismiss}>
          <button type="button">inside</button>
        </DismissableLayer.Root>
        <Surface />
        <button type="button">outside</button>
      </>,
    );
    await waitForDocumentPointerDownListener();

    // A non-surface outside element that stops propagation should still block
    // dismissal.
    const outside = screen.getByText('outside');
    const stopPropagation = (event: Event) => event.stopPropagation();
    outside.addEventListener('mousedown', stopPropagation);
    outside.addEventListener('mouseup', stopPropagation);
    outside.addEventListener('click', stopPropagation);

    firePointerMouseClick(outside);
    await waitForDocumentPointerDownListener();
    expect(onDismiss).not.toHaveBeenCalled();

    firePointerMouseClick(screen.getByText('surface'));
    await waitForDocumentPointerDownListener();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('gives a registered dismiss surface a click listener of its own until it unmounts so iOS Safari dispatches click for taps on it', () => {
    const addEventListener = vi.spyOn(EventTarget.prototype, 'addEventListener');
    const removeEventListener = vi.spyOn(EventTarget.prototype, 'removeEventListener');

    function Surface() {
      const registerSurface = DismissableLayer.useDismissableLayerSurface();
      return <div ref={registerSurface}>surface</div>;
    }

    const rendered = render(<Surface />);
    const surface = screen.getByText('surface');

    const addedClickListeners = addEventListener.mock.calls
      .filter(
        ([type], index) => type === 'click' && addEventListener.mock.contexts[index] === surface,
      )
      .map(([, listener]) => listener);
    expect(addedClickListeners).toHaveLength(1);

    rendered.unmount();

    const removedClickListeners = removeEventListener.mock.calls
      .filter(
        ([type], index) => type === 'click' && removeEventListener.mock.contexts[index] === surface,
      )
      .map(([, listener]) => listener);
    expect(removedClickListeners).toEqual(addedClickListeners);
  });

  it('does not dismiss when focus moves outside during a deferred stopped interaction', async () => {
    const onDismiss = vi.fn();

    renderDismissableLayer({ deferPointerDownOutside: true, onDismiss });
    await waitForDocumentPointerDownListener();

    const outside = screen.getByText('outside');
    const stopPropagation = (event: Event) => event.stopPropagation();
    outside.addEventListener('mousedown', stopPropagation);
    outside.addEventListener('mouseup', stopPropagation);
    outside.addEventListener('click', stopPropagation);

    fireEvent.pointerDown(outside);
    fireEvent.mouseDown(outside);
    fireEvent.focusIn(outside);
    fireEvent.mouseUp(outside);
    fireEvent.click(outside);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  // Regression test for https://github.com/radix-ui/primitives/issues/3971
  it('does not dismiss a deferred parent when a child layer dismisses first', async () => {
    const onParentDismiss = vi.fn();
    const onChildDismiss = vi.fn();

    render(
      <>
        <DismissableLayer.Root
          disableOutsidePointerEvents
          deferPointerDownOutside
          onDismiss={onParentDismiss}
        >
          <button type="button">parent</button>
        </DismissableLayer.Root>
        <DismissableLayer.Root disableOutsidePointerEvents onDismiss={onChildDismiss}>
          <button type="button">child</button>
        </DismissableLayer.Root>
        <button type="button">outside</button>
      </>,
    );
    await waitForDocumentPointerDownListener();

    firePointerMouseClick(screen.getByText('outside'));
    await waitForDocumentPointerDownListener();

    expect(onChildDismiss).toHaveBeenCalledTimes(1);
    expect(onParentDismiss).not.toHaveBeenCalled();
  });

  // Regression test for https://github.com/radix-ui/primitives/issues/3461
  it('does not dismiss a deferred modal parent when a nested layer is dismissed by an outside touch tap', async () => {
    const onParentDismiss = vi.fn();
    const onChildDismiss = vi.fn();

    render(
      <>
        <DismissableLayer.Root
          disableOutsidePointerEvents
          deferPointerDownOutside
          onDismiss={onParentDismiss}
        >
          <button type="button">parent</button>
        </DismissableLayer.Root>
        <DismissableLayer.Root disableOutsidePointerEvents onDismiss={onChildDismiss}>
          <button type="button">child</button>
        </DismissableLayer.Root>
        <button type="button">outside</button>
      </>,
    );
    await waitForDocumentPointerDownListener();

    const outside = screen.getByText('outside');
    fireEvent.pointerDown(outside, { pointerType: 'touch' });
    fireEvent.touchStart(outside);
    fireEvent.touchEnd(outside);
    fireEvent.click(outside);
    await waitForDocumentPointerDownListener();

    expect(onChildDismiss).toHaveBeenCalledTimes(1);
    expect(onParentDismiss).not.toHaveBeenCalled();
  });

  // Regression test for https://github.com/radix-ui/primitives/issues/3963
  it('keeps a stable composed ref (no infinite render loop)', () => {
    assertStableComposedRef((ref) => (
      <DismissableLayer.Root ref={ref}>
        <button type="button">inside</button>
      </DismissableLayer.Root>
    ));
  });

  // Regression test for https://github.com/radix-ui/primitives/issues/4014
  it('calls the latest escape key handler after re-rendering', () => {
    const onEscapeKeyDown = vi.fn();

    function Test() {
      const [count, setCount] = React.useState(0);
      return (
        <DismissableLayer.Root onEscapeKeyDown={() => onEscapeKeyDown(count)}>
          <button type="button" onClick={() => setCount((value) => value + 1)}>
            increment
          </button>
        </DismissableLayer.Root>
      );
    }

    render(<Test />);

    fireEvent.click(screen.getByText('increment'));
    fireEvent.click(screen.getByText('increment'));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onEscapeKeyDown).toHaveBeenLastCalledWith(2);
  });

  // Regression test for https://github.com/radix-ui/primitives/issues/4014
  it('observes the latest state when preventing escape dismissal', () => {
    const onDismiss = vi.fn();

    function Test() {
      const [blocked, setBlocked] = React.useState(false);
      return (
        <DismissableLayer.Root
          onEscapeKeyDown={(event) => {
            if (blocked) event.preventDefault();
          }}
          onDismiss={onDismiss}
        >
          <button type="button" onClick={() => setBlocked(true)}>
            block
          </button>
        </DismissableLayer.Root>
      );
    }

    render(<Test />);

    fireEvent.click(screen.getByText('block'));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('leaves an escape key that belongs to an IME composition to the input method', () => {
    const onEscapeKeyDown = vi.fn();
    const onDismiss = vi.fn();

    renderDismissableLayer({ onEscapeKeyDown, onDismiss });

    const notCancelled = fireEvent.keyDown(document, { key: 'Escape', isComposing: true });

    expect(notCancelled).toBe(true);
    expect(onEscapeKeyDown).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('leaves an escape key the IME processed (keyCode 229) to the input method', () => {
    const onEscapeKeyDown = vi.fn();
    const onDismiss = vi.fn();

    renderDismissableLayer({ onEscapeKeyDown, onDismiss });

    const notCancelled = fireEvent.keyDown(document, { key: 'Escape', keyCode: 229 });

    expect(notCancelled).toBe(true);
    expect(onEscapeKeyDown).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses on the escape key that follows a finished composition', () => {
    const onEscapeKeyDown = vi.fn();
    const onDismiss = vi.fn();

    renderDismissableLayer({ onEscapeKeyDown, onDismiss });

    fireEvent.keyDown(document, { key: 'Escape', isComposing: true });
    fireEvent.keyDown(document, { key: 'Escape', keyCode: 27 });

    expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('DismissableLayer.Root', () => {
  afterEach(cleanupLayer);

  it('spreads props it does not consume onto the element it renders', () => {
    const ref = React.createRef<HTMLDivElement>();
    const onClick = vi.fn();

    render(
      <DismissableLayer.Root
        ref={ref}
        data-testid="layer"
        className="custom-class"
        style={{ outlineColor: 'rgb(1, 2, 3)' }}
        onClick={onClick}
      >
        Layer
      </DismissableLayer.Root>,
    );

    const layer = screen.getByTestId('layer');
    expect(layer.tagName).toBe('DIV');
    expect(layer).toHaveClass('custom-class');
    expect(layer.style.outlineColor).toBe('rgb(1, 2, 3)');
    expect(ref.current).toBe(layer);

    fireEvent.click(layer);
    expect(onClick).toHaveBeenCalled();
  });

  it('forwards props to the child element when `asChild` is set', () => {
    const ref = React.createRef<HTMLDivElement>();
    const onClick = vi.fn();

    render(
      <DismissableLayer.Root
        asChild
        ref={ref}
        data-testid="layer"
        className="custom-class"
        style={{ outlineColor: 'rgb(1, 2, 3)' }}
        onClick={onClick}
      >
        <article>Layer</article>
      </DismissableLayer.Root>,
    );

    const layer = screen.getByTestId('layer');
    expect(layer.tagName).toBe('ARTICLE');
    expect(layer).toHaveClass('custom-class');
    expect(layer.style.outlineColor).toBe('rgb(1, 2, 3)');
    expect(ref.current).toBe(layer);

    fireEvent.click(layer);
    expect(onClick).toHaveBeenCalled();
  });

  // With outside pointer events disabled the layer sets `pointerEvents` itself, which is the case
  // where a naive `style` assignment would drop the consumer's `style`.
  it('merges its own `pointerEvents` into the consumer’s `style`', () => {
    const ref = React.createRef<HTMLDivElement>();
    const onClick = vi.fn();

    render(
      <DismissableLayer.Root
        disableOutsidePointerEvents
        ref={ref}
        data-testid="layer"
        className="custom-class"
        style={{ outlineColor: 'rgb(1, 2, 3)' }}
        onClick={onClick}
      >
        Layer
      </DismissableLayer.Root>,
    );

    const layer = screen.getByTestId('layer');
    expect(layer.style.pointerEvents).toBe('auto');
    expect(layer).toHaveClass('custom-class');
    expect(layer.style.outlineColor).toBe('rgb(1, 2, 3)');
    expect(ref.current).toBe(layer);

    fireEvent.click(layer);
    expect(onClick).toHaveBeenCalled();
  });

  // Regression test for httpp://github.com/radix-ui/primitives/issues/4093
  it('renders pointer-events auto override before the body is disabled', () => {
    let bodyPointerEvents = '';
    let layerPointerEvents = '';
    const handleUpdate = () => {
      bodyPointerEvents = document.body.style.pointerEvents;
      layerPointerEvents = screen.getByTestId('layer').style.pointerEvents;
    };
    document.addEventListener('dismissableLayer.update', handleUpdate);

    render(
      <DismissableLayer.Root disableOutsidePointerEvents data-testid="layer">
        <button type="button">inside</button>
      </DismissableLayer.Root>,
    );

    document.removeEventListener('dismissableLayer.update', handleUpdate);
    expect(bodyPointerEvents).toBe('none');
    expect(layerPointerEvents).toBe('auto');
  });
});

describe('DismissableLayer.Branch', () => {
  afterEach(cleanupLayer);

  it('spreads props it does not consume onto the element it renders', () => {
    const ref = React.createRef<HTMLDivElement>();
    const onClick = vi.fn();

    render(
      <DismissableLayer.Root>
        <DismissableLayer.Branch
          ref={ref}
          data-testid="branch"
          className="custom-class"
          style={{ outlineColor: 'rgb(1, 2, 3)' }}
          onClick={onClick}
        >
          Branch
        </DismissableLayer.Branch>
      </DismissableLayer.Root>,
    );

    const branch = screen.getByTestId('branch');
    expect(branch.tagName).toBe('DIV');
    expect(branch).toHaveClass('custom-class');
    expect(branch.style.outlineColor).toBe('rgb(1, 2, 3)');
    expect(ref.current).toBe(branch);

    fireEvent.click(branch);
    expect(onClick).toHaveBeenCalled();
  });

  it('forwards props to the child element when `asChild` is set', () => {
    const ref = React.createRef<HTMLDivElement>();
    const onClick = vi.fn();

    render(
      <DismissableLayer.Root>
        <DismissableLayer.Branch
          asChild
          ref={ref}
          data-testid="branch"
          className="custom-class"
          style={{ outlineColor: 'rgb(1, 2, 3)' }}
          onClick={onClick}
        >
          <article>Branch</article>
        </DismissableLayer.Branch>
      </DismissableLayer.Root>,
    );

    const branch = screen.getByTestId('branch');
    expect(branch.tagName).toBe('ARTICLE');
    expect(branch).toHaveClass('custom-class');
    expect(branch.style.outlineColor).toBe('rgb(1, 2, 3)');
    expect(ref.current).toBe(branch);

    fireEvent.click(branch);
    expect(onClick).toHaveBeenCalled();
  });
});

function cleanupLayer() {
  cleanup();
  // A layer that disables outside pointer events sets this on the `body`.
  document.body.style.pointerEvents = '';
}
