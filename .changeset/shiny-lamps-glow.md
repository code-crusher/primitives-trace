---
'@radix-ui/react-select': patch
---

Fixed Chrome warning `Blocked aria-hidden on an element because its descendant retained focus` when opening a `Select` with the keyboard. Outside content is now hidden after focus has moved into the content instead of before.
