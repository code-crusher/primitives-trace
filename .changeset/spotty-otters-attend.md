---
"@radix-ui/react-toast": patch
"@radix-ui/react-slot": patch
"radix-ui": patch
---

Fixed toasts not rendering on React 17. The provider fell back to a no-op when `React.startTransition` was unavailable, which silently dropped the viewport and toast-count updates. The `Slottable` helper also returned `undefined` when rendered without children, which React < 18 rejects.
