ALTER TABLE public.qurator_game_completions
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER;

ALTER TABLE public.qurator_game_completions
    DROP CONSTRAINT IF EXISTS qurator_game_completions_attempt_count_check;

ALTER TABLE public.qurator_game_completions
    ADD CONSTRAINT qurator_game_completions_attempt_count_check
    CHECK (attempt_count IS NULL OR attempt_count BETWEEN 1 AND 8);

CREATE INDEX IF NOT EXISTS qurator_game_completions_letter_ledger_distribution_idx
    ON public.qurator_game_completions (profile_id, attempt_count)
    WHERE game_key = 'letter-ledger' AND outcome = 'won';

CREATE OR REPLACE FUNCTION public.qurator_award_game_completion(
    p_profile_id UUID,
    p_game_key TEXT,
    p_puzzle_date DATE,
    p_outcome TEXT,
    p_attempt_count INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF p_attempt_count IS NOT NULL AND (p_attempt_count < 1 OR p_attempt_count > 8) THEN
        RAISE EXCEPTION 'Attempt count must be between one and eight';
    END IF;

    v_result := public.qurator_award_game_completion(
        p_profile_id,
        p_game_key,
        p_puzzle_date,
        p_outcome
    );

    IF p_game_key = 'letter-ledger' AND p_outcome = 'won' THEN
        UPDATE public.qurator_game_completions
        SET attempt_count = COALESCE(attempt_count, p_attempt_count)
        WHERE profile_id = p_profile_id
          AND game_key = p_game_key
          AND puzzle_date = p_puzzle_date;
    END IF;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.qurator_award_game_completion(UUID, TEXT, DATE, TEXT, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qurator_award_game_completion(UUID, TEXT, DATE, TEXT, INTEGER)
    TO service_role;
