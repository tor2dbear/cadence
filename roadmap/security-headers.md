---
title: Security-header-härdning
status: later
tags: [backend, config]
updated: 2026-08-15
order: 20
---

## Mål
CSP + `frame-ancestors 'self'` på `demo.html` (så ingen annan kan iframe:a demon),
striktare `Cache-Control`.

## Research
Billigt, rör inte appen — sätts på Cloudflare-lagret (Pages kan inte skicka egna
headers). Egentligen en config-uppgift, parkerad här så den inte glöms.
