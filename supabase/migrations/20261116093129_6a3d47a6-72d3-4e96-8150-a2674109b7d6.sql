-- Only run review checks when review content changes (vote count updates must never be blocked)
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

    NEW.subject_name := regexp_replace(btrim(coalesce(NEW.subject_name, '')), '\s+', ' ', 'g');
    IF char_length(NEW.subject_name) < 2 OR char_length(NEW.subject_name) > 100 THEN
      RAISE EXCEPTION 'Enter the subject you took (2 to 100 characters)';
    END IF;
    bad := public.find_restricted_word(NEW.subject_name);
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION 'RESTRICTED_SUBJECT:%', bad USING ERRCODE = 'P0001';
    END IF;
  ELSE
    -- Who wrote it, which professor/subject, and vote counts never change through an edit
    NEW.user_id := OLD.user_id;
    NEW.professor_id := OLD.professor_id;
    NEW.subject_id := OLD.subject_id;
    NEW.subject_name := OLD.subject_name;
    NEW.like_count := OLD.like_count;
    NEW.dislike_count := OLD.dislike_count;
    NEW.created_at := OLD.created_at;
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
  BEFORE INSERT OR UPDATE OF comment, subject_id, subject_name, professor_id, user_id, rating, difficulty, would_recommend, grade, tags
  ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_review();