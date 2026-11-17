---
'@radix-ui/react-radio-group': patch
'radix-ui': patch
---

Fixed `RadioGroup` restoring the value it was mounted with instead of the latest `defaultValue` when its form is reset. This made the group lose its selection when React 19 reset a form after an action.
