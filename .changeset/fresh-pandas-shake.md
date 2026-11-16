---
'@radix-ui/react-dropdown-menu': patch
'radix-ui': patch
---

Fixed `DropdownMenu.Trigger` opening on touch `pointerdown` (and therefore when a scroll started on it). It now opens on `pointerdown` for mouse and on `click` for touch and pen, matching `Select.Trigger`.
