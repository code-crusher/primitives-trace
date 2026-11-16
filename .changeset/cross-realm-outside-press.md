---
'@radix-ui/react-dismissable-layer': patch
'radix-ui': patch
---

Fixed `DismissableLayer` not dismissing on outside pointer interactions when rendered into another window (e.g. a `window.open` popup). `instanceof Node` is realm-bound, so targets created by the popup's document were ignored.
