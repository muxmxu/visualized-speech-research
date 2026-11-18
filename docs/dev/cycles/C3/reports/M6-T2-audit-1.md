# M6-T2 independent mechanical audit 1

**PASS for the frozen dataset frontend task.**

- HEAD and index matched `8d602fdc42eb8e98ad7d2d8920e271050aa7a36c`. Only the eight approved paths changed. Their hashes matched, and independent reconstruction and application of the frozen patch produced the same candidate tree. Reverse application and whitespace passed. Backend, locked dependencies, and protected configuration were unchanged.
- The rule checker returned `0 FAIL, 4 REVIEW`. The four C1 entries cover result readback, scan, cancel, and LTAS readback under V1#1. Each reports failed requests at the authenticated HTTP boundary. The public-scope scan of 705 additions found no private content.
- Retained `npm ci`, typecheck, and ESLint exited zero. The initial type and lint failures remain in the logs. The real-browser dataset case runs with the accepted backend in T3. No passing checks were repeated for this audit.

```text
964cf6f5a70a51666f4f8ef825ab09c693e79325                          candidate tree
9d8dbc8860e9c24cd9577efd2d1b5b74f4ac72be6ada10240fff5a522a8d9b97  worker.patch
f6887296357a78dd728b8a1e04f0883df5a5de06773901485e40e7b05f7defb1  audit evidence manifest
```
