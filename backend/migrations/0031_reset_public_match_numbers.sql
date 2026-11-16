-- Full-world reset is the only operation allowed to discard public match numbers.
-- Historical IDs stay immutable across ordinary season transitions.
-- The reset inserts a scoped permit and rotates world_state.generation in one D1
-- batch before deleting mappings; the trigger remains active everywhere else.
DROP TRIGGER IF EXISTS public_match_numbers_no_delete;
CREATE TRIGGER public_match_numbers_no_delete BEFORE DELETE ON public_match_numbers
WHEN NOT EXISTS (
 SELECT 1 FROM world_reset_permits AS permit
 JOIN world_state AS world ON world.id=1
 WHERE permit.generation <> world.generation
)
BEGIN SELECT RAISE(ABORT,'published numeric match identity cannot be reused'); END;
