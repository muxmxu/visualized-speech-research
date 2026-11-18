# 0.1.0 independent mechanical audit 1

**PASS for the local C1 release candidate.**

- The frozen patch adds exactly `CHANGELOG.md` and `docs/acceptance/release-0.1.0.md` on base `c04c7e2a630435141e1e275b61bcc2004843e45e`. An independent reconstruction matched the patch byte for byte, and applying it on the base recovered the candidate tree below. Whitespace and protection checks passed, and the rule checker reported `0 FAIL, 0 REVIEW`.
- Product, dependency, configuration, test, and benchmark files match delivered M3 and its reviewed runtime. The retained regression covers 260 pytest passes, 37 Vitest passes, and 75 distinct Chromium passes across the original run and one targeted locator correction. The final local npm audit evidence records zero runtime findings and 12 high development-toolchain entries under B5.
- Both distribution hashes matched. The wheel passed CRC verification, and all 25 tracked runtime and bundled-skill files and the three production web assets matched their source bytes. The clean-venv dependency check and installed smoke exited zero. The smoke confirmed HTTP 401/200 for unauthenticated/authenticated session access, HTTP 200 for the home page, preset resolution, bundled resource access, and server teardown. Two earlier offline install attempts exited 1 and remain in the evidence.
- All three benchmark scripts exited zero. Independent medians from the three samples per script match the acceptance report. Rows 1–7 are 4.331 s, 3.3837 s, 63.0 ms, 5.7 ms, 558.9 ms, 43.13 fps, and 165.124 ms. The acceptance compares each with the preceding same-platform result.
- The new-document privacy check passed, and the whole-tree preflight found no remaining content matches. Existing commit-metadata findings remain in local evidence for the Human scan. R1.7, B2 licensing and attribution, and the Human publication scan remain pending.

```text
35e8418b682e3c6a76c8b5571ec8d88a4fcff8f9                          frozen tree
1763550487dcf726ad46623c0a0d1228f8b0d23ea32083c0bdfbc21d1f0d0436  release-docs.patch
e22cdb5361f24185d748ba508799435b54e65c50b57f5a3fda5c1ff4c8e9565f  wheel
935dd5de92ea2fc550f2ea7ab312f69d0296d6e52fa8fb414ba575bc8d801d7e  sdist
6c3eb52b24657919863e39f0f1590f76f6796a7df48933b0838d6c0eb38ed852  audit evidence manifest
```
