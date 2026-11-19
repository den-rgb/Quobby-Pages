-- Qurator Content Studio control plane. Apply manually in the Supabase SQL Editor.
-- Keep this migration separate from the shared mobile schema.
-- Checked server routes use the service role. Provider credentials belong only
-- in the worker Keychain; this migration grants no browser access.

BEGIN;

CREATE TABLE IF NOT EXISTS public.content_studio_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    template_id text NOT NULL,
    template_version integer NOT NULL DEFAULT 1 CHECK (template_version > 0),
    requires_approval boolean NOT NULL DEFAULT true,
    approved_at timestamptz,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','queued','rendering','review','scheduled','publishing','published','failed','rejected')),
    render_spec jsonb NOT NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_studio_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Uploads may be confirmed before their campaign is created.
    campaign_id uuid REFERENCES public.content_studio_campaigns(id) ON DELETE CASCADE,
    storage_path text NOT NULL UNIQUE,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 262144000),
    original_filename text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_studio_renders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES public.content_studio_campaigns(id) ON DELETE CASCADE,
    render_spec jsonb NOT NULL,
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('draft','queued','rendering','review','scheduled','publishing','published','failed','rejected')),
    output_path text,
    duration_ms integer CHECK (duration_ms >= 0),
    lease_owner text,
    lease_expires_at timestamptz,
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    error_code text,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_studio_publications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    render_id uuid NOT NULL REFERENCES public.content_studio_renders(id) ON DELETE CASCADE,
    platform text NOT NULL CHECK (platform IN ('instagram','tiktok','youtube')),
    copy_json jsonb NOT NULL,
    scheduled_for timestamptz,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','queued','rendering','review','scheduled','publishing','published','failed','rejected')),
    external_post_id text,
    public_url text,
    published_at timestamptz,
    lease_owner text,
    lease_expires_at timestamptz,
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    error_code text,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_studio_worker_heartbeats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id text NOT NULL UNIQUE,
    version text NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    -- A job can be either a render or a publication; it is an opaque queue ID.
    current_job_id uuid,
    status_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_studio_audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid REFERENCES public.content_studio_campaigns(id) ON DELETE CASCADE,
    render_id uuid REFERENCES public.content_studio_renders(id) ON DELETE CASCADE,
    publication_id uuid REFERENCES public.content_studio_publications(id) ON DELETE CASCADE,
    actor_type text NOT NULL,
    actor_id text,
    event_name text NOT NULL,
    old_status text,
    new_status text,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_studio_publications_due_idx
    ON public.content_studio_publications (status, scheduled_for)
    WHERE status IN ('scheduled','publishing');
CREATE INDEX IF NOT EXISTS content_studio_publications_queued_idx
    ON public.content_studio_publications (created_at)
    WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS content_studio_renders_claim_idx
    ON public.content_studio_renders (status, lease_expires_at)
    WHERE status IN ('queued','rendering');
CREATE INDEX IF NOT EXISTS content_studio_assets_campaign_idx
    ON public.content_studio_assets (campaign_id);
CREATE INDEX IF NOT EXISTS content_studio_renders_campaign_idx
    ON public.content_studio_renders (campaign_id);
CREATE INDEX IF NOT EXISTS content_studio_publications_render_idx
    ON public.content_studio_publications (render_id);
CREATE INDEX IF NOT EXISTS content_studio_audit_events_campaign_idx
    ON public.content_studio_audit_events (campaign_id, created_at);

ALTER TABLE public.content_studio_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_studio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_studio_renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_studio_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_studio_worker_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_studio_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.content_studio_campaigns,
    public.content_studio_assets,
    public.content_studio_renders,
    public.content_studio_publications,
    public.content_studio_worker_heartbeats,
    public.content_studio_audit_events
    FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE
    public.content_studio_campaigns,
    public.content_studio_assets,
    public.content_studio_renders,
    public.content_studio_publications,
    public.content_studio_worker_heartbeats,
    public.content_studio_audit_events
    TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'content-studio',
    'content-studio',
    false,
    262144000,
    ARRAY[
        'video/mp4', 'video/quicktime',
        'image/jpeg', 'image/png', 'image/webp',
        'audio/wav', 'audio/mpeg', 'audio/aac'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Call this in the same transaction as the corresponding state change.
CREATE OR REPLACE FUNCTION public.content_studio_record_transition(
    p_campaign_id uuid DEFAULT NULL,
    p_render_id uuid DEFAULT NULL,
    p_publication_id uuid DEFAULT NULL,
    p_actor_type text DEFAULT 'system',
    p_actor_id text DEFAULT NULL,
    p_event_name text DEFAULT 'status_changed',
    p_old_status text DEFAULT NULL,
    p_new_status text DEFAULT NULL,
    p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.content_studio_audit_events (
        campaign_id, render_id, publication_id, actor_type, actor_id,
        event_name, old_status, new_status, details
    ) VALUES (
        p_campaign_id, p_render_id, p_publication_id, p_actor_type, p_actor_id,
        p_event_name, p_old_status, p_new_status, COALESCE(p_details, '{}'::jsonb)
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.content_studio_release_expired_leases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_renders integer;
    v_publications integer;
BEGIN
    WITH expired_renders AS (
        SELECT id
        FROM public.content_studio_renders
        WHERE status = 'rendering' AND lease_expires_at < now()
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.content_studio_renders AS job
    SET status = 'queued', lease_owner = NULL, lease_expires_at = NULL,
        updated_at = now()
    FROM expired_renders
    WHERE job.id = expired_renders.id;
    GET DIAGNOSTICS v_renders = ROW_COUNT;

    WITH expired_publications AS (
        SELECT id
        FROM public.content_studio_publications
        WHERE status = 'publishing' AND lease_expires_at < now()
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.content_studio_publications AS job
    SET status = CASE WHEN scheduled_for IS NULL THEN 'queued' ELSE 'scheduled' END,
        lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
    FROM expired_publications
    WHERE job.id = expired_publications.id;
    GET DIAGNOSTICS v_publications = ROW_COUNT;

    RETURN v_renders + v_publications;
END;
$$;

CREATE OR REPLACE FUNCTION public.content_studio_claim_job(p_machine_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_render public.content_studio_renders%ROWTYPE;
    v_publication public.content_studio_publications%ROWTYPE;
BEGIN
    IF p_machine_id IS NULL OR btrim(p_machine_id) = '' THEN
        RAISE EXCEPTION 'Machine ID is required' USING ERRCODE = '22023';
    END IF;

    PERFORM public.content_studio_release_expired_leases();

    SELECT r.* INTO v_render
    FROM public.content_studio_renders r
    WHERE r.status = 'queued'
    ORDER BY r.created_at, r.id
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
        UPDATE public.content_studio_renders
        SET status = 'rendering', lease_owner = p_machine_id,
            lease_expires_at = now() + interval '15 minutes',
            attempt_count = attempt_count + 1, updated_at = now()
        WHERE id = v_render.id
        RETURNING * INTO v_render;

        RETURN jsonb_build_object(
            'kind', 'render', 'id', v_render.id,
            'render_id', v_render.id, 'campaign_id', v_render.campaign_id,
            'render_spec', v_render.render_spec, 'output_path', v_render.output_path,
            'platform', NULL, 'copy_json', NULL
        );
    END IF;

    SELECT p.* INTO v_publication
    FROM public.content_studio_publications p
    JOIN public.content_studio_renders r ON r.id = p.render_id
    WHERE p.status IN ('queued','scheduled')
        AND (p.scheduled_for IS NULL OR p.scheduled_for <= now())
        AND r.output_path IS NOT NULL
        AND r.status NOT IN ('draft','queued','rendering','failed','rejected')
    ORDER BY p.scheduled_for NULLS FIRST, p.created_at, p.id
    LIMIT 1
    FOR UPDATE OF p SKIP LOCKED;

    IF FOUND THEN
        UPDATE public.content_studio_publications
        SET status = 'publishing', lease_owner = p_machine_id,
            lease_expires_at = now() + interval '15 minutes',
            attempt_count = attempt_count + 1, updated_at = now()
        WHERE id = v_publication.id
        RETURNING * INTO v_publication;

        SELECT * INTO v_render
        FROM public.content_studio_renders
        WHERE id = v_publication.render_id;

        RETURN jsonb_build_object(
            'kind', 'publication', 'id', v_publication.id,
            'render_id', v_render.id, 'campaign_id', v_render.campaign_id,
            'render_spec', v_render.render_spec, 'output_path', v_render.output_path,
            'platform', v_publication.platform, 'copy_json', v_publication.copy_json
        );
    END IF;

    RETURN NULL;
END;
$$;

-- Worker writes must check the lease at mutation time, not against an earlier
-- application timestamp. Keep the mutation and its audit in one transaction.
CREATE OR REPLACE FUNCTION public.content_studio_transition_job(
    p_job_kind text,
    p_job_id uuid,
    p_machine_id text,
    p_status text,
    p_patch jsonb DEFAULT '{}'::jsonb,
    p_event_name text DEFAULT 'status_changed',
    p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_render public.content_studio_renders%ROWTYPE;
    v_publication public.content_studio_publications%ROWTYPE;
    v_campaign public.content_studio_campaigns%ROWTYPE;
    v_campaign_id uuid;
    v_render_id uuid;
    v_campaign_status text;
BEGIN
    IF p_machine_id IS NULL OR btrim(p_machine_id) = '' THEN
        RAISE EXCEPTION 'Machine ID is required' USING ERRCODE = '22023';
    END IF;
    IF p_status IS NULL OR p_status NOT IN ('draft','queued','rendering','review','scheduled','publishing','published','failed','rejected') THEN
        RAISE EXCEPTION 'Choose a supported status' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Job patch must be an object' USING ERRCODE = '22023';
    END IF;

    IF p_job_kind = 'render' THEN
        IF p_patch - ARRAY['output_path','duration_ms','error_code','error_message'] <> '{}'::jsonb THEN
            RAISE EXCEPTION 'Unsupported render patch field' USING ERRCODE = '22023';
        END IF;
        IF p_patch ? 'output_path' AND (p_patch ->> 'output_path') IS DISTINCT FROM ('renders/' || p_job_id::text || '/output.mp4') THEN
            RAISE EXCEPTION 'Use the generated render output path' USING ERRCODE = '22023';
        END IF;
        -- Obtain the lock before sampling wall-clock time in the UPDATE so
        -- waiting for another transaction cannot extend an expired lease.
        SELECT * INTO v_render
        FROM public.content_studio_renders
        WHERE id = p_job_id
        FOR UPDATE;

        UPDATE public.content_studio_renders
        SET status = p_status,
            output_path = CASE WHEN p_patch ? 'output_path' THEN p_patch ->> 'output_path' ELSE output_path END,
            duration_ms = CASE WHEN p_patch ? 'duration_ms' THEN (p_patch ->> 'duration_ms')::integer ELSE duration_ms END,
            error_code = CASE WHEN p_patch ? 'error_code' THEN p_patch ->> 'error_code' ELSE error_code END,
            error_message = CASE WHEN p_patch ? 'error_message' THEN p_patch ->> 'error_message' ELSE error_message END,
            lease_owner = CASE WHEN p_status = 'rendering' THEN lease_owner ELSE NULL END,
            lease_expires_at = CASE WHEN p_status = 'rendering' THEN lease_expires_at ELSE NULL END,
            updated_at = now()
        WHERE id = p_job_id AND status = 'rendering'
            AND lease_owner = p_machine_id AND lease_expires_at > now()
            AND lease_expires_at > clock_timestamp()
        RETURNING * INTO v_render;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Worker must own the active lease' USING ERRCODE = '42501';
        END IF;
        PERFORM public.content_studio_record_transition(
            p_campaign_id => v_render.campaign_id, p_render_id => v_render.id,
            p_actor_type => 'worker', p_actor_id => p_machine_id,
            p_event_name => COALESCE(p_event_name, 'status_changed'),
            p_old_status => 'rendering', p_new_status => p_status, p_details => p_details
        );
        RETURN to_jsonb(v_render);

    ELSIF p_job_kind = 'publication' THEN
        IF p_patch - ARRAY['scheduled_for','copy_json','external_post_id','public_url','published_at','error_code','error_message'] <> '{}'::jsonb THEN
            RAISE EXCEPTION 'Unsupported publication patch field' USING ERRCODE = '22023';
        END IF;
        -- Parent-first locking matches policy/review/retry RPCs. The initial
        -- lookups do not lock, then the mutable rows are locked campaign ->
        -- render -> publication so a completion can recalculate its campaign
        -- without introducing an inverse lock-order deadlock.
        SELECT render_id INTO v_render_id
        FROM public.content_studio_publications WHERE id = p_job_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Publication not found' USING ERRCODE = '22023';
        END IF;
        SELECT campaign_id INTO v_campaign_id
        FROM public.content_studio_renders WHERE id = v_render_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Render not found' USING ERRCODE = '22023';
        END IF;
        SELECT * INTO STRICT v_campaign
        FROM public.content_studio_campaigns WHERE id = v_campaign_id FOR NO KEY UPDATE;
        SELECT * INTO STRICT v_render
        FROM public.content_studio_renders WHERE id = v_render_id FOR NO KEY UPDATE;
        SELECT * INTO v_publication
        FROM public.content_studio_publications
        WHERE id = p_job_id
        FOR UPDATE;
        IF v_publication.render_id IS DISTINCT FROM v_render.id THEN
            RAISE EXCEPTION 'Publication state changed' USING ERRCODE = '40001';
        END IF;
        IF p_status = 'published' AND btrim(COALESCE(p_patch ->> 'external_post_id', v_publication.external_post_id, '')) = '' THEN
            RAISE EXCEPTION 'A published publication requires an external post ID' USING ERRCODE = '22023';
        END IF;

        UPDATE public.content_studio_publications
        SET status = p_status,
            scheduled_for = CASE WHEN p_patch ? 'scheduled_for' THEN (p_patch ->> 'scheduled_for')::timestamptz ELSE scheduled_for END,
            copy_json = CASE WHEN p_patch ? 'copy_json' THEN p_patch -> 'copy_json' ELSE copy_json END,
            external_post_id = CASE WHEN p_patch ? 'external_post_id' THEN p_patch ->> 'external_post_id' ELSE external_post_id END,
            public_url = CASE WHEN p_patch ? 'public_url' THEN p_patch ->> 'public_url' ELSE public_url END,
            published_at = CASE WHEN p_patch ? 'published_at' THEN (p_patch ->> 'published_at')::timestamptz ELSE published_at END,
            error_code = CASE WHEN p_patch ? 'error_code' THEN p_patch ->> 'error_code' ELSE error_code END,
            error_message = CASE WHEN p_patch ? 'error_message' THEN p_patch ->> 'error_message' ELSE error_message END,
            lease_owner = CASE WHEN p_status = 'publishing' THEN lease_owner ELSE NULL END,
            lease_expires_at = CASE WHEN p_status = 'publishing' THEN lease_expires_at ELSE NULL END,
            updated_at = now()
        WHERE id = p_job_id AND status = 'publishing'
            AND lease_owner = p_machine_id AND lease_expires_at > now()
            AND lease_expires_at > clock_timestamp()
        RETURNING * INTO v_publication;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Worker must own the active lease' USING ERRCODE = '42501';
        END IF;
        PERFORM public.content_studio_record_transition(
            p_campaign_id => v_campaign_id, p_render_id => v_publication.render_id,
            p_publication_id => v_publication.id,
            p_actor_type => 'worker', p_actor_id => p_machine_id,
            p_event_name => COALESCE(p_event_name, 'status_changed'),
            p_old_status => 'publishing', p_new_status => p_status, p_details => p_details
        );
        -- A campaign is terminal only when all of its publications are
        -- terminal. A failed provider result is terminal-failed once no
        -- publication remains to publish; mixed/scheduled work stays active.
        IF v_campaign.status IS DISTINCT FROM 'rejected' THEN
            SELECT CASE
                WHEN count(*) = 0 THEN v_campaign.status
                WHEN bool_and(p.status = 'published') THEN 'published'
                -- A retryable provider failure stays recoverable through the
                -- existing same-publication retry RPC; do not terminalize its
                -- parent campaign before that journaled retry can run.
                WHEN bool_and(p.status IN ('published','failed','rejected'))
                    AND bool_or(p.status = 'failed'
                        AND p.error_code IS DISTINCT FROM 'publication-retryable')
                    AND NOT bool_or(p.status = 'failed'
                        AND p.error_code IS NOT DISTINCT FROM 'publication-retryable') THEN 'failed'
                WHEN bool_or(p.status = 'review') THEN 'review'
                WHEN bool_or(p.status = 'scheduled') THEN 'scheduled'
                WHEN bool_or(p.status IN ('queued','publishing')) THEN 'queued'
                ELSE v_campaign.status
            END INTO v_campaign_status
            FROM public.content_studio_publications p
            JOIN public.content_studio_renders r ON r.id = p.render_id
            WHERE r.campaign_id = v_campaign.id;
            IF v_campaign_status IS DISTINCT FROM v_campaign.status THEN
                UPDATE public.content_studio_campaigns
                SET status = v_campaign_status, updated_at = now()
                WHERE id = v_campaign.id;
                PERFORM public.content_studio_record_transition(
                    p_campaign_id => v_campaign.id, p_actor_type => 'system',
                    p_actor_id => p_machine_id,
                    p_event_name => 'campaign_publication_result_applied',
                    p_old_status => v_campaign.status,
                    p_new_status => v_campaign_status
                );
            END IF;
        END IF;
        RETURN to_jsonb(v_publication);
    ELSE
        RAISE EXCEPTION 'Choose a supported job kind' USING ERRCODE = '22023';
    END IF;
END;
$$;

-- Reviewing a campaign is all-or-nothing: transition the campaign and every
-- currently reviewable publication under one parent-first transaction. This
-- prevents a transport failure after the campaign write from stranding its
-- publications in review and making a later approval impossible.
CREATE OR REPLACE FUNCTION public.content_studio_review_campaign(
    p_campaign_id uuid,
    p_admin_id uuid,
    p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_campaign public.content_studio_campaigns%ROWTYPE;
    v_updated public.content_studio_campaigns%ROWTYPE;
    v_render public.content_studio_renders%ROWTYPE;
    v_publication public.content_studio_publications%ROWTYPE;
    v_next_status text;
    v_campaign_status text;
    v_pending_count integer := 0;
BEGIN
    IF p_admin_id IS NULL OR p_action NOT IN ('approve','reject') THEN
        RAISE EXCEPTION 'An admin and review action are required' USING ERRCODE = '22023';
    END IF;
    -- Same non-key parent lock used by render/policy/retry code. Audit FK
    -- inserts can still acquire KEY SHARE on the parent rows.
    SELECT * INTO STRICT v_campaign
    FROM public.content_studio_campaigns WHERE id = p_campaign_id FOR NO KEY UPDATE;
    IF v_campaign.created_by IS DISTINCT FROM p_admin_id THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_campaign.status IS DISTINCT FROM 'review' THEN
        RAISE EXCEPTION 'Campaign state changed' USING ERRCODE = '40001';
    END IF;

    FOR v_render IN
        SELECT * FROM public.content_studio_renders
        WHERE campaign_id = p_campaign_id ORDER BY id FOR NO KEY UPDATE
    LOOP
        FOR v_publication IN
            SELECT * FROM public.content_studio_publications
            WHERE render_id = v_render.id
              AND status NOT IN ('published','failed','rejected')
            ORDER BY id FOR UPDATE
        LOOP
            v_pending_count := v_pending_count + 1;
            IF v_publication.status IS DISTINCT FROM 'review' THEN
                RAISE EXCEPTION 'Publication state changed' USING ERRCODE = '40001';
            END IF;
            v_next_status := CASE
                WHEN p_action = 'reject' THEN 'rejected'
                WHEN v_publication.scheduled_for IS NOT NULL THEN 'scheduled'
                ELSE 'queued'
            END;
            UPDATE public.content_studio_publications
            SET status = v_next_status, lease_owner = NULL, lease_expires_at = NULL,
                updated_at = now()
            WHERE id = v_publication.id AND status = 'review';
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Publication state changed' USING ERRCODE = '40001';
            END IF;
            PERFORM public.content_studio_record_transition(
                p_campaign_id => v_campaign.id, p_render_id => v_render.id,
                p_publication_id => v_publication.id, p_actor_type => 'admin',
                p_actor_id => p_admin_id::text,
                p_event_name => CASE WHEN p_action = 'approve' THEN 'publication_approved' ELSE 'publication_rejected' END,
                p_old_status => 'review', p_new_status => v_next_status,
                p_details => CASE WHEN p_action = 'reject'
                    THEN jsonb_build_object('rejected_at', now()) ELSE '{}'::jsonb END
            );
        END LOOP;
    END LOOP;
    IF v_pending_count = 0 THEN
        RAISE EXCEPTION 'Campaign state changed' USING ERRCODE = '40001';
    END IF;

    v_campaign_status := CASE
        WHEN p_action = 'reject' THEN 'rejected'
        WHEN EXISTS (
            SELECT 1 FROM public.content_studio_publications p
            JOIN public.content_studio_renders r ON r.id = p.render_id
            WHERE r.campaign_id = p_campaign_id AND p.status = 'scheduled'
        ) THEN 'scheduled'
        ELSE 'queued'
    END;
    UPDATE public.content_studio_campaigns
    SET status = v_campaign_status,
        approved_at = CASE WHEN p_action = 'approve' THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = p_campaign_id AND status = 'review'
    RETURNING * INTO v_updated;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaign state changed' USING ERRCODE = '40001';
    END IF;
    PERFORM public.content_studio_record_transition(
        p_campaign_id => v_campaign.id, p_actor_type => 'admin',
        p_actor_id => p_admin_id::text,
        p_event_name => CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
        p_old_status => 'review', p_new_status => v_campaign_status,
        p_details => CASE WHEN p_action = 'reject'
            THEN jsonb_build_object('rejected_at', now()) ELSE '{}'::jsonb END
    );
    RETURN to_jsonb(v_updated);
END;
$$;

-- Finalizing a render and releasing its publications must use the campaign's
-- current approval policy under the same lock/transaction as the job mutation.
CREATE OR REPLACE FUNCTION public.content_studio_complete_render(
    p_render_id uuid,
    p_machine_id text,
    p_status text,
    p_patch jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_campaign_id uuid;
    v_campaign public.content_studio_campaigns%ROWTYPE;
    v_publication public.content_studio_publications%ROWTYPE;
    v_render jsonb;
    v_next_status text;
    v_campaign_status text;
BEGIN
    IF p_status IS NULL OR p_status NOT IN ('review','failed') THEN
        RAISE EXCEPTION 'Choose review or failed' USING ERRCODE = '22023';
    END IF;
    IF p_status = 'review' AND (
        (p_patch ->> 'output_path') IS DISTINCT FROM ('renders/' || p_render_id::text || '/output.mp4')
        OR jsonb_typeof(p_patch -> 'duration_ms') IS DISTINCT FROM 'number'
        OR (p_patch ->> 'duration_ms')::integer < 0
    ) THEN
        RAISE EXCEPTION 'Completed renders require their generated output path and duration' USING ERRCODE = '22023';
    END IF;

    SELECT campaign_id INTO v_campaign_id
    FROM public.content_studio_renders WHERE id = p_render_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Render not found' USING ERRCODE = '22023';
    END IF;
    -- Approval edits take this row lock too. After waiting, READ COMMITTED
    -- returns their committed policy, and further edits wait for completion.
    SELECT * INTO STRICT v_campaign
    FROM public.content_studio_campaigns WHERE id = v_campaign_id FOR UPDATE;

    -- Reuse the authoritative mutation-time worker lease check, lease clearing,
    -- and render audit. Any later error rolls this nested call back as well.
    v_render := public.content_studio_transition_job(
        p_job_kind => 'render', p_job_id => p_render_id,
        p_machine_id => p_machine_id, p_status => p_status, p_patch => p_patch,
        p_event_name => CASE WHEN p_status = 'review' THEN 'render_completed' ELSE 'render_failed' END
    );

    v_campaign_status := CASE
        WHEN v_campaign.status = 'rejected' THEN 'rejected'
        WHEN p_status = 'failed' THEN 'failed'
        WHEN v_campaign.requires_approval AND v_campaign.approved_at IS NULL THEN 'review'
        ELSE 'queued'
    END;
    FOR v_publication IN
        SELECT * FROM public.content_studio_publications
        WHERE render_id = p_render_id AND status IN ('draft','review','queued','scheduled')
        ORDER BY id FOR UPDATE
    LOOP
        v_next_status := CASE
            WHEN v_campaign_status IN ('rejected','failed','review') THEN v_campaign_status
            WHEN v_publication.scheduled_for IS NOT NULL THEN 'scheduled'
            ELSE 'queued'
        END;
        IF v_publication.status IS DISTINCT FROM v_next_status THEN
            UPDATE public.content_studio_publications
            SET status = v_next_status, lease_owner = NULL, lease_expires_at = NULL,
                updated_at = now()
            WHERE id = v_publication.id;
            PERFORM public.content_studio_record_transition(
                p_campaign_id => v_campaign.id, p_render_id => p_render_id,
                p_publication_id => v_publication.id, p_actor_type => 'system',
                p_actor_id => p_machine_id, p_event_name => 'publication_recalculated',
                p_old_status => v_publication.status, p_new_status => v_next_status
            );
        END IF;
    END LOOP;
    UPDATE public.content_studio_campaigns
    SET status = v_campaign_status, updated_at = now() WHERE id = v_campaign.id;
    PERFORM public.content_studio_record_transition(
        p_campaign_id => v_campaign.id, p_render_id => p_render_id,
        p_actor_type => 'system', p_actor_id => p_machine_id,
        p_event_name => 'render_result_applied', p_old_status => v_campaign.status,
        p_new_status => v_campaign_status
    );
    RETURN v_render;
END;
$$;

-- Serialize policy edits with render completion using the same campaign-first
-- lock order. Read render/publication rows after obtaining that lock, so neither
-- ordering can leave an enabled approval policy with queued publications.
CREATE OR REPLACE FUNCTION public.content_studio_set_approval_policy(
    p_campaign_id uuid,
    p_admin_id uuid,
    p_requires_approval boolean,
    p_expected_statuses text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_campaign public.content_studio_campaigns%ROWTYPE;
    v_updated public.content_studio_campaigns%ROWTYPE;
    v_render public.content_studio_renders%ROWTYPE;
    v_publication public.content_studio_publications%ROWTYPE;
    v_approved_at timestamptz;
    v_next_status text;
    v_campaign_status text;
BEGIN
    IF p_requires_approval IS NULL OR p_expected_statuses IS NULL
        OR cardinality(p_expected_statuses) = 0
        OR NOT (p_expected_statuses <@ ARRAY['draft','queued','rendering','review','scheduled','publishing']::text[]) THEN
        RAISE EXCEPTION 'A boolean policy and nonempty mutable expected states are required' USING ERRCODE = '22023';
    END IF;
    -- Non-key parent locks still serialize policy/render writers, but allow a
    -- publication worker's audit INSERT to acquire its FK KEY SHARE locks.
    SELECT * INTO STRICT v_campaign
    FROM public.content_studio_campaigns WHERE id = p_campaign_id FOR NO KEY UPDATE;
    IF v_campaign.created_by IS DISTINCT FROM p_admin_id OR p_admin_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF NOT (v_campaign.status = ANY(p_expected_statuses)) THEN
        RAISE EXCEPTION 'Campaign state changed' USING ERRCODE = '40001';
    END IF;
    v_approved_at := CASE
        WHEN p_requires_approval AND NOT v_campaign.requires_approval THEN NULL
        ELSE v_campaign.approved_at
    END;

    FOR v_render IN
        SELECT * FROM public.content_studio_renders
        WHERE campaign_id = p_campaign_id ORDER BY id FOR NO KEY UPDATE
    LOOP
        FOR v_publication IN
            SELECT * FROM public.content_studio_publications
            WHERE render_id = v_render.id AND status IN ('draft','review','queued','scheduled','publishing')
            ORDER BY id FOR UPDATE
        LOOP
            IF v_publication.status = 'publishing' THEN
                IF p_requires_approval AND v_approved_at IS NULL THEN
                    RAISE EXCEPTION 'Publication is already publishing' USING ERRCODE = '40001';
                END IF;
                CONTINUE;
            END IF;
            v_next_status := CASE
                WHEN v_render.status IN ('failed','rejected') THEN v_render.status
                WHEN v_render.output_path IS DISTINCT FROM ('renders/' || v_render.id::text || '/output.mp4')
                    OR v_render.status IN ('draft','queued','rendering') THEN 'draft'
                WHEN p_requires_approval AND v_approved_at IS NULL THEN 'review'
                WHEN v_publication.scheduled_for IS NOT NULL THEN 'scheduled'
                ELSE 'queued'
            END;
            IF v_publication.status IS DISTINCT FROM v_next_status THEN
                UPDATE public.content_studio_publications
                SET status = v_next_status, lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
                WHERE id = v_publication.id AND status = v_publication.status;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Publication state changed' USING ERRCODE = '40001';
                END IF;
                PERFORM public.content_studio_record_transition(
                    p_campaign_id => p_campaign_id, p_render_id => v_render.id,
                    p_publication_id => v_publication.id, p_actor_type => 'admin',
                    p_actor_id => p_admin_id::text, p_event_name => 'publication_recalculated',
                    p_old_status => v_publication.status, p_new_status => v_next_status
                );
            END IF;
        END LOOP;
    END LOOP;
    SELECT CASE
        WHEN bool_or(p.status = 'review') THEN 'review'
        WHEN bool_or(p.status = 'scheduled') THEN 'scheduled'
        WHEN bool_or(p.status = 'queued') THEN 'queued'
        ELSE v_campaign.status
    END INTO v_campaign_status
    FROM public.content_studio_publications p
    JOIN public.content_studio_renders r ON r.id = p.render_id
    WHERE r.campaign_id = p_campaign_id;

    UPDATE public.content_studio_campaigns
    SET requires_approval = p_requires_approval, approved_at = v_approved_at,
        status = v_campaign_status, updated_at = now()
    WHERE id = p_campaign_id AND status = v_campaign.status AND status = ANY(p_expected_statuses)
    RETURNING * INTO v_updated;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaign state changed' USING ERRCODE = '40001';
    END IF;
    PERFORM public.content_studio_record_transition(
        p_campaign_id => p_campaign_id, p_actor_type => 'admin', p_actor_id => p_admin_id::text,
        p_event_name => 'approval_requirement_changed', p_old_status => v_campaign.status,
        p_new_status => v_campaign_status,
        p_details => jsonb_build_object('previous_requires_approval', v_campaign.requires_approval,
            'requires_approval', p_requires_approval)
    );
    RETURN to_jsonb(v_updated);
END;
$$;

-- A retry must see the same approval policy as a concurrent policy change.
-- Lock campaign -> render -> publication, matching the policy RPC's parent-first
-- order. The Keychain recovery checkpoint stays on the Mac; this only requeues
-- the existing database row after a retryable provider failure.
CREATE OR REPLACE FUNCTION public.content_studio_retry_publication(
    p_publication_id uuid,
    p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_campaign public.content_studio_campaigns%ROWTYPE;
    v_render public.content_studio_renders%ROWTYPE;
    v_publication public.content_studio_publications%ROWTYPE;
    v_render_id uuid;
    v_campaign_id uuid;
    v_next_status text;
BEGIN
    IF p_admin_id IS NULL THEN
        RAISE EXCEPTION 'Admin ID is required' USING ERRCODE = '22023';
    END IF;

    -- This preliminary lookup establishes the parent lock order. The locked
    -- publication is fetched again below and checked against this render ID.
    SELECT render_id INTO v_render_id
    FROM public.content_studio_publications WHERE id = p_publication_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Publication not found' USING ERRCODE = '22023';
    END IF;
    SELECT campaign_id INTO v_campaign_id
    FROM public.content_studio_renders WHERE id = v_render_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Render not found' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO STRICT v_campaign
    FROM public.content_studio_campaigns WHERE id = v_campaign_id FOR NO KEY UPDATE;
    IF v_campaign.created_by IS DISTINCT FROM p_admin_id THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_campaign.status IN ('failed', 'rejected', 'published') THEN
        RAISE EXCEPTION 'Publication is not eligible for retry' USING ERRCODE = '40001';
    END IF;

    SELECT * INTO STRICT v_render
    FROM public.content_studio_renders WHERE id = v_render_id FOR NO KEY UPDATE;
    IF v_render.output_path IS DISTINCT FROM ('renders/' || v_render.id::text || '/output.mp4')
        OR v_render.status IN ('draft', 'queued', 'rendering', 'failed', 'rejected') THEN
        RAISE EXCEPTION 'Publication is not eligible for retry' USING ERRCODE = '40001';
    END IF;

    SELECT * INTO STRICT v_publication
    FROM public.content_studio_publications WHERE id = p_publication_id FOR UPDATE;
    IF v_publication.render_id IS DISTINCT FROM v_render.id
        OR v_publication.status IS DISTINCT FROM 'failed'
        OR v_publication.error_code IS DISTINCT FROM 'publication-retryable' THEN
        RAISE EXCEPTION 'Publication state changed' USING ERRCODE = '40001';
    END IF;

    v_next_status := CASE
        WHEN v_campaign.requires_approval AND v_campaign.approved_at IS NULL THEN 'review'
        WHEN v_publication.scheduled_for IS NOT NULL THEN 'scheduled'
        ELSE 'queued'
    END;

    UPDATE public.content_studio_publications
    SET status = v_next_status, error_code = NULL, error_message = NULL,
        lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE id = p_publication_id AND status = 'failed'
        AND error_code = 'publication-retryable'
    RETURNING * INTO v_publication;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Publication state changed' USING ERRCODE = '40001';
    END IF;
    PERFORM public.content_studio_record_transition(
        p_campaign_id => v_campaign.id, p_render_id => v_render.id,
        p_publication_id => v_publication.id, p_actor_type => 'admin',
        p_actor_id => p_admin_id::text, p_event_name => 'publication_retry_requested',
        p_old_status => 'failed', p_new_status => v_next_status
    );
    -- Enabling approval after every prior publication became terminal can
    -- leave the campaign queued with approved_at NULL. A retry then correctly
    -- returns this row to review; reopen the parent state in the same locked
    -- transaction so the existing review RPC can approve it.
    IF v_next_status = 'review' AND v_campaign.status IS DISTINCT FROM 'review' THEN
        UPDATE public.content_studio_campaigns
        SET status = 'review', updated_at = now()
        WHERE id = v_campaign.id AND status = v_campaign.status;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Campaign state changed' USING ERRCODE = '40001';
        END IF;
        PERFORM public.content_studio_record_transition(
            p_campaign_id => v_campaign.id, p_actor_type => 'admin',
            p_actor_id => p_admin_id::text,
            p_event_name => 'campaign_review_reopened_for_retry',
            p_old_status => v_campaign.status, p_new_status => 'review'
        );
    END IF;
    RETURN to_jsonb(v_publication);
END;
$$;

-- PostgreSQL grants new functions to PUBLIC by default, so revoke that too.
REVOKE ALL ON FUNCTION public.content_studio_claim_job(text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.content_studio_release_expired_leases()
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.content_studio_record_transition(uuid, uuid, uuid, text, text, text, text, text, jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.content_studio_transition_job(text, uuid, text, text, jsonb, text, jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.content_studio_complete_render(uuid, text, text, jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.content_studio_set_approval_policy(uuid, uuid, boolean, text[])
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.content_studio_retry_publication(uuid, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.content_studio_review_campaign(uuid, uuid, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_studio_claim_job(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.content_studio_release_expired_leases() TO service_role;
GRANT EXECUTE ON FUNCTION public.content_studio_record_transition(uuid, uuid, uuid, text, text, text, text, text, jsonb)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.content_studio_transition_job(text, uuid, text, text, jsonb, text, jsonb)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.content_studio_complete_render(uuid, text, text, jsonb)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.content_studio_set_approval_policy(uuid, uuid, boolean, text[])
    TO service_role;
GRANT EXECUTE ON FUNCTION public.content_studio_retry_publication(uuid, uuid)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.content_studio_review_campaign(uuid, uuid, text)
    TO service_role;

COMMIT;
