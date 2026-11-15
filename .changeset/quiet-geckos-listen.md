---
"@radix-ui/react-dismissable-layer": patch
"radix-ui": patch
---

Fixed the escape key being ignored (or dismissing the wrong layer) when the top-most layer registered after its last render, eg when a menu mounts inside a discrete update within a dialog.
