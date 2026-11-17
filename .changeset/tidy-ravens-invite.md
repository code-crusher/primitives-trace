---
'@radix-ui/react-collection': patch
'@radix-ui/react-roving-focus': patch
'@radix-ui/react-radio-group': patch
'radix-ui': patch
---

Fixed arrow-key navigation in roving focus groups (e.g. `Tabs`, `Toolbar`, `RadioGroup`) occasionally being swallowed. Collection items now register in a layout effect so the collection is up to date synchronously after every commit, and roving focus moves focus synchronously during `keydown` instead of deferring it to a macrotask.
