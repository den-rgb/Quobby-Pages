-- Browser rendering replaces the Mac worker for meme generation. Apply manually
-- in the Supabase SQL Editor after migrate-content-studio.sql.
-- Both functions are admin-owned: the worker's lease checks do not apply, so
-- ownership and state are verified here instead.
BEGIN;

-- An admin's browser renders the meme and uploads it to the canonical path.
CREATE OR REPLACE FUNCTION public.content_studio_complete_render_admin(
    p_render_id uuid,
    p_admin_id uuid,
    p_duration_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_campaign_id uuid;
    v_campaign public.content_studio_campaigns%ROWTYPE;
    v_publication public.content_studio_publications%ROWTYPE;
    v_render public.content_studio_renders%ROWTYPE;
    v_old_render_status text;
    v_next_status text;
    v_campaign_status text;
BEGIN
    IF p_admin_id IS NULL THEN
        RAISE EXCEPTION 'An admin is required' USING ERRCODE = '22023';
    END IF;
    IF p_duration_ms IS NULL OR p_duration_ms < 0 THEN
        RAISE EXCEPTION 'A render duration is required' USING ERRCODE = '22023';
    END IF;

    SELECT campaign_id INTO v_campaign_id FROM public.content_studio_renders WHERE id = p_render_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Render not found' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO STRICT v_campaign
    FROM public.content_studio_campaigns WHERE id = v_campaign_id FOR NO KEY UPDATE;
    IF v_campaign.created_by IS DISTINCT FROM p_admin_id THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO STRICT v_render
    FROM public.content_studio_renders WHERE id = p_render_id FOR UPDATE;
    IF v_render.status NOT IN ('draft','queued','rendering','failed') THEN
        RAISE EXCEPTION 'Render state changed' USING ERRCODE = '40001';
    END IF;
    v_old_render_status := v_render.status;

    UPDATE public.content_studio_renders
    SET status = 'review',
        output_path = 'renders/' || p_render_id::text || '/output.mp4',
        duration_ms = p_duration_ms,
        lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE id = p_render_id
    RETURNING * INTO v_render;
    PERFORM public.content_studio_record_transition(
        p_campaign_id => v_campaign.id, p_render_id => p_render_id,
        p_actor_type => 'admin', p_actor_id => p_admin_id::text,
        p_event_name => 'render_completed', p_old_status => v_old_render_status,
        p_new_status => 'review'
    );

    v_campaign_status := CASE
        WHEN v_campaign.status = 'rejected' THEN 'rejected'
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
            SET status = v_next_status, lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
            WHERE id = v_publication.id;
            PERFORM public.content_studio_record_transition(
                p_campaign_id => v_campaign.id, p_render_id => p_render_id,
                p_publication_id => v_publication.id, p_actor_type => 'system',
                p_actor_id => p_admin_id::text, p_event_name => 'publication_recalculated',
                p_old_status => v_publication.status, p_new_status => v_next_status
            );
        END IF;
    END LOOP;
    UPDATE public.content_studio_campaigns
    SET status = v_campaign_status, updated_at = now() WHERE id = v_campaign.id;
    PERFORM public.content_studio_record_transition(
        p_campaign_id => v_campaign.id, p_render_id => p_render_id,
        p_actor_type => 'system', p_actor_id => p_admin_id::text,
        p_event_name => 'render_result_applied', p_old_status => v_campaign.status,
        p_new_status => v_campaign_status
    );
    RETURN to_jsonb(v_render);
END;
$$;

-- Manual publishing: the admin posted the approved video themselves.
CREATE OR REPLACE FUNCTION public.content_studio_publish_manual(
    p_publication_id uuid,
    p_admin_id uuid,
    p_public_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_render_id uuid;
    v_campaign_id uuid;
    v_publication public.content_studio_publications%ROWTYPE;
    v_render public.content_studio_renders%ROWTYPE;
    v_campaign public.content_studio_campaigns%ROWTYPE;
    v_old_status text;
BEGIN
    IF p_admin_id IS NULL THEN
        RAISE EXCEPTION 'An admin is required' USING ERRCODE = '22023';
    END IF;
    IF p_public_url IS NOT NULL AND p_public_url !~ '^https://' THEN
        RAISE EXCEPTION 'Only https post links can be saved' USING ERRCODE = '22023';
    END IF;

    -- Campaign first: every other RPC locks campaign -> render -> publication,
    -- so this ordering cannot deadlock against render completion or re-policies.
    SELECT render_id INTO v_render_id
    FROM public.content_studio_publications WHERE id = p_publication_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Publication not found' USING ERRCODE = '22023';
    END IF;
    SELECT campaign_id INTO v_campaign_id FROM public.content_studio_renders WHERE id = v_render_id;
    SELECT * INTO STRICT v_campaign
    FROM public.content_studio_campaigns WHERE id = v_campaign_id FOR NO KEY UPDATE;
    IF v_campaign.created_by IS DISTINCT FROM p_admin_id THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO STRICT v_render
    FROM public.content_studio_renders WHERE id = v_render_id FOR NO KEY UPDATE;
    SELECT * INTO STRICT v_publication
    FROM public.content_studio_publications WHERE id = p_publication_id FOR UPDATE;
    IF v_publication.status NOT IN ('review','queued','scheduled','failed') THEN
        RAISE EXCEPTION 'Publication state changed' USING ERRCODE = '40001';
    END IF;
    v_old_status := v_publication.status;

    UPDATE public.content_studio_publications
    SET status = 'published', published_at = now(),
        public_url = COALESCE(p_public_url, public_url),
        external_post_id = COALESCE(external_post_id, 'manual'),
        error_code = NULL, error_message = NULL,
        lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE id = p_publication_id
    RETURNING * INTO v_publication;
    PERFORM public.content_studio_record_transition(
        p_campaign_id => v_campaign.id, p_render_id => v_render.id,
        p_publication_id => p_publication_id, p_actor_type => 'admin',
        p_actor_id => p_admin_id::text, p_event_name => 'publication_published_manual',
        p_old_status => v_old_status, p_new_status => 'published'
    );

    IF NOT EXISTS (
        SELECT 1 FROM public.content_studio_publications p
        JOIN public.content_studio_renders r ON r.id = p.render_id
        WHERE r.campaign_id = v_campaign.id AND p.status NOT IN ('published','rejected')
    ) THEN
        UPDATE public.content_studio_campaigns
        SET status = 'published', updated_at = now() WHERE id = v_campaign.id;
        PERFORM public.content_studio_record_transition(
            p_campaign_id => v_campaign.id, p_actor_type => 'system',
            p_actor_id => p_admin_id::text, p_event_name => 'campaign_published',
            p_old_status => v_campaign.status, p_new_status => 'published'
        );
    END IF;
    RETURN to_jsonb(v_publication);
END;
$$;

-- SECURITY DEFINER functions are executable by PUBLIC by default, which would
-- let anon/authenticated call these RPCs directly and skip the admin routes.
REVOKE ALL ON FUNCTION public.content_studio_complete_render_admin(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.content_studio_publish_manual(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_studio_complete_render_admin(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.content_studio_publish_manual(uuid, uuid, text) TO service_role;

COMMIT;
