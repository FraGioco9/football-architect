# I03 protected DOM presentation — lifecycle update

The DEV-only experimental presenter now captures scroll containers and focused element before a protected standings/fixtures update; successful application, rollback and failures restore scroll position and focus where the prior element remains connected.

The experimental controller is still not injected or activated. Its transaction handoff must not be treated as production-ready: simultaneous old/new reversible DOM ownership and Form tooltip listeners require an integrated shared presentation lifecycle. This remains an I03/I06 gate, not an automatic switch to the five-season source.

All changes stay in PR #340 Draft/HOLD, with no production preview, deploy or database writes.
