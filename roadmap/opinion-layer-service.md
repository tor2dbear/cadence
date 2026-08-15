---
title: Opinion-lagret som tjänst (Worker + MCP)
status: later
tags: [backend]
updated: 2026-08-15
order: 10
---

## Mål
Göra system-read-kritiken anropbar från CI eller en agent — "blocka bygget om exit är
långsammare än enter".

## Research
Extrahera den *rena* logiken (resolve + system-read-checkarna) ur `cadence.js` till en
huvudlös modul (`tokens.js`, ingen DOM), exponera som en serverless-endpoint. Given
stacken (Cloudflare framför Pages) är en **Cloudflare Worker** den naturliga värden
(gratisnivå ~100k req/dag) framför Netlify Functions. En **MCP-wrapper** över samma
funktion gör kritiken anropbar från editor/agent — den enda genuint agent-formade delen
av Cadence.

## Öppna frågor
- Bryter "plain static site, no build"-regeln — medvetet sidospår, inte default-scope.
