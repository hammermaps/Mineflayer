# Selective upstream update — 2026-09-13

Native 26.2 protocol patches remain unchanged. This is not a switch to the official npm release.

Integrated:
- e54c4017: discard container lid counts when the block at that position changes name. Five regression assertions cover duplicate events, unchanged blocks, unloaded blocks, replacement and close/reopen.
- bdba9566: use ./ for the development self-dependency, accepted as a directory by npm and compatible with upstream pnpm resolution. Full pnpm installation is not claimed.

Not integrated:
- 53049d9a creative statistics acknowledgement: timeout removes the FIFO entry, so a delayed response can be assigned to the next request. Unsolicited statistics packets are another correlation concern. Keep current behavior until independently addressed; do not claim this fixes creative acknowledgement.
- Resource-pack UUID changes are already equivalent in this fork.
- CI-only changes are unnecessary for the native runtime update.

Existing user-deleted upstream test files were not restored or committed. Run tools/block-actions-regression.js and the existing tools/*regression* scripts for focused coverage.
