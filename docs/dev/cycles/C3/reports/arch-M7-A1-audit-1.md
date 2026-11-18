# Arch M7 draft mechanical preflight

Verdict: PASS for the frozen bytes; repeat the hash comparison before reuse after M6 delivery.
The phase/M6 DESIGN source SHA-256 is `8d12d6abb93d8acf678786c1d5860510b3c96250c67ae532acd0f66fe6904489`.
The patch SHA-256 is `1426f549194cdc345937187420163bc2f677e92e350760a0393b7be7acff64f5` and the insertion SHA-256 is `66b523827a5dac0ea807b067e4e0dd352df22abf0899211de8b49f45eba9ab01`.
`patch --batch --fuzz=0 -p1` applied successfully to a temporary copy, producing candidate SHA-256 `15a1078507ace932cc8c1e7038361f17038ac4b23d65741a8b781c2d477a33fe`.
All four hashes match `arch-M7-freeze.txt`.
The patch adds exactly three §14.1 bullets matching the frozen insertion and one D55 line in §21, with no removals; prior §21 is an exact prefix.
Only sections 14 and 21 differ; the preamble, H2 headings, all previous lines and protected §§0, 1, 16, 17 and 19 remain unchanged.
The added text describes the H48/B4 coefficient-delay display and refers to the existing waveform route and framed format; it adds no route or configuration.
A scan of additions for the host-contract private vocabulary, home paths, email addresses, IPv4 addresses and HTTP links found no matches.
This is a mechanical preflight, not an independent semantic review or an authorization to persist the patch.
