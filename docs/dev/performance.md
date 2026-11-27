# Performance measurements

## Raspberry Pi 5, Linux aarch64

| Date | Commit | Device | §17 row 1 | Row 2 | Row 3 | Row 4 | Row 5 | Row 6 | Row 7 |
|---|---|---|---|---|---|---|---|---|---|
| 2026-11-17 | 99286649b43569fea9153c9a5ecd6753886f4377 | CPU | 4.173 s | Not measured | Not measured | Not measured | Not measured | Not measured | Not measured |
| 2026-11-18 | a4b37b680e3e14f0d07d244f94f79b349a471814 | CPU | Not measured | 3.5291 s | 71.1 ms | 5.4 ms | 565.9 ms | 43.46 fps | Not measured |
| 2026-11-18 | 600152a00bfe6981c8d9ab0a28ba12cdc3830c42 | CPU | Not measured | Not measured | Not measured | Not measured | Not measured | Not measured | 224.288 ms |
| 2026-11-18 | fbb5061a2828c80f76f844c56225a46db058e8fa | CPU | 4.331 s | 3.3837 s | 63.0 ms | 5.7 ms | 558.9 ms | 43.13 fps | 165.124 ms |
| 2026-11-18 | 8bf040355bfdde2d0333bdfd61d6dbdd39634340 | CPU | 4.459 s | 3.4347 s | 71.3 ms | 6.9 ms | 601.0 ms | 35.74 fps | 139.861 ms |
| 2026-11-27 | befb2cc9fefefd1ed27b66ba460da387a596d4ae | CPU | 4.330 s | 3.2854 s | 64.9 ms | 6.9 ms | 561.5 ms | 41.768 fps | 143.419 ms |

The M7 benchmarks ran on phase tree `5c2694b3a3e5917b092b52a5d4bbedb8ed975cb8`; its tested product/test tree is identical to master commit `befb2cc9fefefd1ed27b66ba460da387a596d4ae`.

Row 1 observations were 4.173, 4.188, and 3.721 seconds on the phase tree, with a median of 4.173 seconds.
This is the first measurement for this platform and device.

Row 7 observations were 224.288, 385.161, 115.964 ms on the phase tree, with a median of 224.288 ms.
This is the first row 7 measurement for this platform and device.
