---
"@radix-ui/react-dismissable-layer": patch
"radix-ui": patch
---

Fix a regression where pressing escape while a newly opened layer was still registering could also dismiss the layer underneath it (eg. both of two stacked modal dialogs closing at once).
