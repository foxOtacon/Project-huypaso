-- Supabase/Postgres RPC used by the importable n8n product-recommendation template.
-- Apply this file through the Supabase SQL editor before enabling the workflow.
-- The function intentionally returns no customer profile fields and is callable
-- only with the server-side service_role credential.

CREATE OR REPLACE FUNCTION public.get_user_recommendation_data(p_user_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
    v_user_id bigint;
BEGIN
    IF p_user_id IS NULL OR p_user_id < 1 THEN
        RAISE EXCEPTION 'invalid p_user_id' USING ERRCODE = '22023';
    END IF;

    SELECT u.user_id
    INTO v_user_id
    FROM public.users AS u
    WHERE u.user_id = p_user_id
      AND u.role IN ('customer', 'user')
      AND u.status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'active customer not found' USING ERRCODE = 'P0002';
    END IF;

    RETURN (
        WITH behavior AS (
            SELECT
                upv.product_id,
                SUM(GREATEST(upv.view_count, 0))::integer AS view_count,
                MAX(upv.viewed_at) AS last_viewed_at
            FROM public.user_product_views AS upv
            WHERE upv.user_id = v_user_id
              AND upv.viewed_at >= NOW() - INTERVAL '365 days'
            GROUP BY upv.product_id
        ),
        recent_behavior AS (
            SELECT
                b.product_id,
                p.category_id,
                b.view_count,
                b.last_viewed_at
            FROM behavior AS b
            INNER JOIN public.products AS p ON p.product_id = b.product_id
            ORDER BY b.last_viewed_at DESC, b.product_id
            LIMIT 80
        ),
        category_affinity AS (
            SELECT
                p.category_id,
                SUM(b.view_count)::integer AS category_affinity
            FROM behavior AS b
            INNER JOIN public.products AS p ON p.product_id = b.product_id
            GROUP BY p.category_id
        ),
        global_popularity AS (
            SELECT
                upv.product_id,
                SUM(GREATEST(upv.view_count, 0))::integer AS global_views_90d
            FROM public.user_product_views AS upv
            WHERE upv.viewed_at >= NOW() - INTERVAL '90 days'
            GROUP BY upv.product_id
        ),
        candidates AS (
            SELECT
                p.product_id,
                p.product_name,
                p.category_id,
                c.category_name,
                LEFT(p.description, 600) AS description,
                p.price,
                p.unit,
                p.image_url,
                LEFT(p.production_source, 300) AS production_source,
                p.stock_quantity,
                COALESCE(b.view_count, 0) AS user_view_count,
                b.last_viewed_at,
                COALESCE(a.category_affinity, 0) AS category_affinity,
                COALESCE(g.global_views_90d, 0) AS global_views_90d
            FROM public.products AS p
            LEFT JOIN public.categories AS c ON c.category_id = p.category_id
            LEFT JOIN behavior AS b ON b.product_id = p.product_id
            LEFT JOIN category_affinity AS a ON a.category_id = p.category_id
            LEFT JOIN global_popularity AS g ON g.product_id = p.product_id
            WHERE p.status = 'active'
              AND p.stock_quantity > 0
            ORDER BY
                COALESCE(a.category_affinity, 0) DESC,
                COALESCE(b.view_count, 0) DESC,
                b.last_viewed_at DESC NULLS LAST,
                COALESCE(g.global_views_90d, 0) DESC,
                p.product_id DESC
            LIMIT 80
        )
        SELECT jsonb_build_object(
            'schema_version', 1,
            'user_id', v_user_id,
            'user_behavior', COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'product_id', rb.product_id,
                            'category_id', rb.category_id,
                            'view_count', rb.view_count,
                            'last_viewed_at', rb.last_viewed_at
                        )
                        ORDER BY rb.last_viewed_at DESC, rb.product_id
                    )
                    FROM recent_behavior AS rb
                ),
                '[]'::jsonb
            ),
            'products', COALESCE(
                (
                    SELECT jsonb_agg(
                        to_jsonb(candidate)
                        ORDER BY
                            candidate.category_affinity DESC,
                            candidate.user_view_count DESC,
                            candidate.last_viewed_at DESC NULLS LAST,
                            candidate.global_views_90d DESC,
                            candidate.product_id DESC
                    )
                    FROM candidates AS candidate
                ),
                '[]'::jsonb
            )
        )
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_recommendation_data(bigint)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_recommendation_data(bigint)
TO service_role;

CREATE INDEX IF NOT EXISTS user_product_views_user_recent_idx
    ON public.user_product_views (user_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS user_product_views_product_recent_idx
    ON public.user_product_views (product_id, viewed_at DESC);

NOTIFY pgrst, 'reload schema';
