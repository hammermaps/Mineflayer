# September 15 upstream integration

Reviewed master 91204b2a; retained native 26.2 protocol, metadata, team field and reconnect fixes.

Included: 5b246f72 login resets; 124a9cb4 bounded physics backlog; ed62ffb2 enumerable controls; 91204b2a non-enumerable scoreboard aliases; 401bd0d6 descriptive pre-login chat errors; 2b2505b8 abilities state/API; 5e686a8c ChatMessage window titles.

Adapted f0c6d014: upstream calls the sending helper inside the clientbound handler, still echoing changed selections. This fork instead assigns carriedIndex directly for authoritative server updates. Invalid slots are ignored; local choices send once.

Abilities exposes server-granted flags/speeds and entity state. The pinned physics engine does not consume creative flying state; this update does NOT claim automatic creative-flight simulation. Existing flyTo behavior is unchanged.

Validation: existing eight regression scripts passed (22 reported cases/assertions), plus 14 new tests covering 1.8.9, 1.21.11 and native 26.2, real abilities wire serialization, inventory selections/titles, login reset, physics accumulator and control/chat behavior. Lint passed. Candidate Paper 26.2-92 isolated 29565 gate 8/8, both processes exited normally. No ViaVersion or production access.

No CI/mock-server-only commits or creative statistics acknowledgement changes imported. Existing user-deleted tests are not restored or staged.
