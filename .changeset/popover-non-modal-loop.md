---
'@radix-ui/react-popover': patch
'radix-ui': patch
---

Fixed `Tab` not being able to leave a non-modal `Popover.Content`. Focus now only loops at the edges of a modal popover, and `Popover.Content` accepts a `loop` prop to opt back in.
