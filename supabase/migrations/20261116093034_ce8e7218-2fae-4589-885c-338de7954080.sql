-- 1. Students type the subject they took instead of choosing from a list
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS subject_name text;

UPDATE public.reviews r
SET subject_name = s.name
FROM public.subjects s
WHERE s.id = r.subject_id AND r.subject_name IS NULL;

UPDATE public.reviews SET subject_name = 'Not specified' WHERE subject_name IS NULL;

ALTER TABLE public.reviews ALTER COLUMN subject_name SET NOT NULL;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_subject_name_check
  CHECK (char_length(btrim(subject_name)) BETWEEN 2 AND 100);

-- Reviews no longer depend on the old subject list (and can never be cascade-deleted with it)
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_subject_id_fkey;
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_subject_id_key;
ALTER TABLE public.reviews ALTER COLUMN subject_id DROP NOT NULL;

-- One review per student, per professor, per subject (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_subject
  ON public.reviews (user_id, professor_id, lower(subject_name));

REVOKE INSERT (subject_id) ON public.reviews FROM authenticated;
GRANT INSERT (subject_name) ON public.reviews TO authenticated;
GRANT SELECT (subject_name) ON public.reviews TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE bad text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL AND current_user NOT IN ('service_role','postgres') THEN
      RAISE EXCEPTION 'You must be signed in to post a review';
    END IF;
    IF auth.uid() IS NOT NULL THEN NEW.user_id := auth.uid(); END IF;
    NEW.like_count := 0;
    NEW.dislike_count := 0;
    NEW.subject_id := NULL;
  ELSE
    -- Identity, target and vote counts can never be changed by an edit
    NEW.user_id := OLD.user_id;
    NEW.professor_id := OLD.professor_id;
    NEW.subject_name := OLD.subject_name;
    NEW.like_count := OLD.like_count;
    NEW.dislike_count := OLD.dislike_count;
    NEW.created_at := OLD.created_at;
  END IF;

  NEW.subject_name := regexp_replace(btrim(coalesce(NEW.subject_name, '')), '\s+', ' ', 'g');
  IF char_length(NEW.subject_name) < 2 OR char_length(NEW.subject_name) > 100 THEN
    RAISE EXCEPTION 'Enter the subject you took (2 to 100 characters)';
  END IF;
  bad := public.find_restricted_word(NEW.subject_name);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'RESTRICTED_SUBJECT:%', bad USING ERRCODE = 'P0001';
  END IF;

  NEW.comment := trim(NEW.comment);
  bad := public.find_restricted_word(NEW.comment);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'RESTRICTED_WORD:%', bad USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS reviews_validate ON public.reviews;
CREATE TRIGGER reviews_validate
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_review();

-- 2. Live restricted-word check while a signed-in student types
CREATE OR REPLACE FUNCTION public.check_restricted_text(_text text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _text IS NULL OR char_length(_text) > 200 THEN NULL
    ELSE public.find_restricted_word(_text)
  END
$function$;

REVOKE EXECUTE ON FUNCTION public.check_restricted_text(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_restricted_text(text) TO authenticated;

-- 3. Admin dashboard numbers (India time)
CREATE OR REPLACE FUNCTION public.admin_site_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  tz constant text := 'Asia/Kolkata';
  today date := (now() AT TIME ZONE tz)::date;
  this_month date := date_trunc('month', now() AT TIME ZONE tz)::date;
  daily jsonb;
  monthly jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  WITH days AS (
    SELECT generate_series(today - 29, today, interval '1 day')::date AS day
  ), u AS (
    SELECT (created_at AT TIME ZONE tz)::date AS day, count(*)::int AS c
    FROM auth.users WHERE created_at >= now() - interval '31 days' GROUP BY 1
  ), r AS (
    SELECT (created_at AT TIME ZONE tz)::date AS day, count(*)::int AS c
    FROM public.reviews WHERE created_at >= now() - interval '31 days' GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object('period', d.day, 'users', coalesce(u.c, 0), 'reviews', coalesce(r.c, 0)) ORDER BY d.day DESC)
  INTO daily
  FROM days d LEFT JOIN u ON u.day = d.day LEFT JOIN r ON r.day = d.day;

  WITH months AS (
    SELECT generate_series(this_month - interval '11 months', this_month, interval '1 month')::date AS m
  ), u AS (
    SELECT date_trunc('month', created_at AT TIME ZONE tz)::date AS m, count(*)::int AS c
    FROM auth.users WHERE created_at >= this_month - interval '12 months' GROUP BY 1
  ), r AS (
    SELECT date_trunc('month', created_at AT TIME ZONE tz)::date AS m, count(*)::int AS c
    FROM public.reviews WHERE created_at >= this_month - interval '12 months' GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object('period', mo.m, 'users', coalesce(u.c, 0), 'reviews', coalesce(r.c, 0)) ORDER BY mo.m DESC)
  INTO monthly
  FROM months mo LEFT JOIN u ON u.m = mo.m LEFT JOIN r ON r.m = mo.m;

  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM auth.users),
    'total_reviews', (SELECT count(*) FROM public.reviews),
    'daily', coalesce(daily, '[]'::jsonb),
    'monthly', coalesce(monthly, '[]'::jsonb)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_site_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_site_stats() TO authenticated;

-- 4. Security: only grant the admin role to a verified owner of the admin email
CREATE OR REPLACE FUNCTION public.handle_new_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF lower(NEW.email) = 'laltechbusiness@gmail.com' AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed_roles ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_roles
  AFTER UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_roles();