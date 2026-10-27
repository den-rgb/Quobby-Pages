CREATE TABLE IF NOT EXISTS public.qurator_game_daily_challenges (
    puzzle_date DATE NOT NULL,
    game_key TEXT NOT NULL CHECK (game_key IN ('letter-ledger', 'number-trail', 'riddle-master')),
    challenge_id TEXT NOT NULL UNIQUE,
    public_data JSONB NOT NULL,
    private_solution JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (puzzle_date, game_key)
);

ALTER TABLE public.qurator_game_daily_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qurator_game_daily_challenges FROM anon, authenticated;
GRANT ALL ON public.qurator_game_daily_challenges TO service_role;

CREATE TABLE IF NOT EXISTS public.qurator_game_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    puzzle_date DATE NOT NULL,
    game_key TEXT NOT NULL CHECK (game_key IN ('letter-ledger', 'number-trail', 'riddle-master')),
    outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost')),
    xp_awarded INTEGER NOT NULL DEFAULT 25 CHECK (xp_awarded = 25),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, game_key, puzzle_date)
);

CREATE INDEX IF NOT EXISTS qurator_game_completions_profile_date_idx
    ON public.qurator_game_completions (profile_id, puzzle_date DESC);

ALTER TABLE public.qurator_game_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qurator_game_completions FROM anon, authenticated;
GRANT ALL ON public.qurator_game_completions TO service_role;

CREATE TABLE IF NOT EXISTS public.qurator_game_profile_stats (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
    best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
    total_completed INTEGER NOT NULL DEFAULT 0 CHECK (total_completed >= 0),
    last_completed_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.qurator_game_profile_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qurator_game_profile_stats FROM anon, authenticated;
GRANT ALL ON public.qurator_game_profile_stats TO service_role;

CREATE OR REPLACE FUNCTION public.qurator_award_game_completion(
    p_profile_id UUID,
    p_game_key TEXT,
    p_puzzle_date DATE,
    p_outcome TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_completion_id UUID;
    v_total_xp INTEGER;
    v_level INTEGER;
    v_remaining INTEGER;
    v_level_cost INTEGER;
    v_current_streak INTEGER;
    v_best_streak INTEGER;
    v_total_completed INTEGER;
    v_last_completed_date DATE;
    v_awarded BOOLEAN := FALSE;
BEGIN
    IF p_profile_id IS NULL THEN
        RAISE EXCEPTION 'A profile is required';
    END IF;
    IF p_game_key NOT IN ('letter-ledger', 'number-trail', 'riddle-master') THEN
        RAISE EXCEPTION 'Unknown game key';
    END IF;
    IF p_outcome NOT IN ('won', 'lost') THEN
        RAISE EXCEPTION 'Unknown game outcome';
    END IF;

    -- Serialise profile XP and streak updates across simultaneous game claims.
    SELECT COALESCE(total_xp, 0), COALESCE(level, 1)
    INTO v_total_xp, v_level
    FROM public.profiles
    WHERE id = p_profile_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile does not exist';
    END IF;

    INSERT INTO public.qurator_game_completions (profile_id, puzzle_date, game_key, outcome)
    VALUES (p_profile_id, p_puzzle_date, p_game_key, p_outcome)
    ON CONFLICT (profile_id, game_key, puzzle_date) DO NOTHING
    RETURNING id INTO v_completion_id;

    IF v_completion_id IS NULL THEN
        SELECT current_streak, best_streak, total_completed, last_completed_date
        INTO v_current_streak, v_best_streak, v_total_completed, v_last_completed_date
        FROM public.qurator_game_profile_stats
        WHERE profile_id = p_profile_id;

        RETURN jsonb_build_object(
            'awarded', FALSE,
            'xpAwarded', 0,
            'totalXp', v_total_xp,
            'level', v_level,
            'currentStreak', COALESCE(v_current_streak, 0),
            'bestStreak', COALESCE(v_best_streak, 0),
            'totalCompleted', COALESCE(v_total_completed, 0)
        );
    END IF;

    v_total_xp := v_total_xp + 25;
    v_remaining := v_total_xp;
    v_level := 1;
    LOOP
        IF v_level <= 10 THEN
            v_level_cost := 100 * v_level * v_level;
        ELSE
            v_level_cost := 10000 + 1000 * (v_level - 10);
        END IF;
        EXIT WHEN v_remaining < v_level_cost;
        v_remaining := v_remaining - v_level_cost;
        v_level := v_level + 1;
    END LOOP;

    UPDATE public.profiles
    SET total_xp = v_total_xp,
        level = v_level,
        updated_at = NOW()
    WHERE id = p_profile_id;

    INSERT INTO public.qurator_game_profile_stats (profile_id)
    VALUES (p_profile_id)
    ON CONFLICT (profile_id) DO NOTHING;

    SELECT current_streak, best_streak, total_completed, last_completed_date
    INTO v_current_streak, v_best_streak, v_total_completed, v_last_completed_date
    FROM public.qurator_game_profile_stats
    WHERE profile_id = p_profile_id
    FOR UPDATE;

    IF v_last_completed_date IS NULL THEN
        v_current_streak := 1;
        v_last_completed_date := p_puzzle_date;
    ELSIF p_puzzle_date > v_last_completed_date THEN
        IF p_puzzle_date = v_last_completed_date + 1 THEN
            v_current_streak := v_current_streak + 1;
        ELSE
            v_current_streak := 1;
        END IF;
        v_last_completed_date := p_puzzle_date;
    END IF;

    v_best_streak := GREATEST(v_best_streak, v_current_streak);
    v_total_completed := v_total_completed + 1;

    UPDATE public.qurator_game_profile_stats
    SET current_streak = v_current_streak,
        best_streak = v_best_streak,
        total_completed = v_total_completed,
        last_completed_date = v_last_completed_date,
        updated_at = NOW()
    WHERE profile_id = p_profile_id;

    v_awarded := TRUE;
    RETURN jsonb_build_object(
        'awarded', v_awarded,
        'xpAwarded', 25,
        'totalXp', v_total_xp,
        'level', v_level,
        'currentStreak', v_current_streak,
        'bestStreak', v_best_streak,
        'totalCompleted', v_total_completed
    );
END;
$$;

REVOKE ALL ON FUNCTION public.qurator_award_game_completion(UUID, TEXT, DATE, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qurator_award_game_completion(UUID, TEXT, DATE, TEXT)
    TO service_role;
