CREATE TABLE IF NOT EXISTS public.qurator_game_verified_words (
    word TEXT PRIMARY KEY CHECK (word ~ '^[a-z]{5}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.qurator_game_verified_words ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qurator_game_verified_words FROM anon, authenticated;
GRANT ALL ON public.qurator_game_verified_words TO service_role;
