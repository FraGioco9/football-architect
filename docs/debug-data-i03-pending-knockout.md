# I03 knockout pending-slot integration

The shared domestic Fixtures validator now admits an explicitly tagged `pendingParticipants:true` slot only when *both* club IDs and scores are null and no tiebreak is present. It retains the existing first/second-leg and final box geometry; unknown opponents appear using the existing neutral TBD identity display. Duplicate pending matches are differentiated by their stable event slot; all fully-known matches still require valid club IDs.

The protected bridge now maps unseen future ties to those pending slots, rather than stopping the entire rendering transaction. Known matches retain their actual participants. The bridge continues to reject ambiguous overtime/penalty conversion until its exact outcome contract is audited.

**Not activated**: experimental controller is still not loaded into the site. The historical/legacy fixtures flow remains unchanged unless an explicit pending tagged slot is passed. Remaining I03: verified ET/penalties semantics, Form tooltip lifecycle, season-aware club registry in shared fixture lookup, integrated atomic context commit and mobile rendering; I06 tests.
