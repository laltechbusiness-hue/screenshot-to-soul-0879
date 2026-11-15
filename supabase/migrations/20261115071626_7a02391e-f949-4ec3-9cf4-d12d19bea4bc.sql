-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
REVOKE ALL ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Auto-assign the first admin by email
CREATE OR REPLACE FUNCTION public.handle_new_user_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF lower(NEW.email) = 'laltechbusiness@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_roles
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_roles();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'laltechbusiness@gmail.com'
ON CONFLICT DO NOTHING;

-- ===== Shared updated_at =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ===== Institutions =====
CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  location text CHECK (location IS NULL OR char_length(location) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX institutions_name_unique ON public.institutions (lower(trim(name)));
GRANT SELECT ON public.institutions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutions TO authenticated;
GRANT ALL ON public.institutions TO service_role;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view institutions" ON public.institutions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert institutions" ON public.institutions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update institutions" ON public.institutions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete institutions" ON public.institutions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER institutions_updated_at BEFORE UPDATE ON public.institutions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Departments =====
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX departments_name_unique ON public.departments (institution_id, lower(trim(name)));
GRANT SELECT ON public.departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update departments" ON public.departments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete departments" ON public.departments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Professors =====
CREATE TABLE public.professors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  review_count integer NOT NULL DEFAULT 0,
  avg_rating numeric(3,2),
  avg_difficulty numeric(3,2),
  recommend_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX professors_institution_idx ON public.professors (institution_id);
GRANT SELECT ON public.professors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professors TO authenticated;
GRANT ALL ON public.professors TO service_role;
ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view professors" ON public.professors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert professors" ON public.professors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update professors" ON public.professors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete professors" ON public.professors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER professors_updated_at BEFORE UPDATE ON public.professors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_professor()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.id = NEW.department_id AND d.institution_id = NEW.institution_id) THEN
    RAISE EXCEPTION 'Department does not belong to this institution';
  END IF;
  NEW.name := trim(NEW.name);
  RETURN NEW;
END;
$$;
CREATE TRIGGER professors_validate BEFORE INSERT OR UPDATE OF institution_id, department_id, name ON public.professors
  FOR EACH ROW EXECUTE FUNCTION public.validate_professor();

-- ===== Subjects =====
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL REFERENCES public.professors(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subjects_name_unique ON public.subjects (professor_id, lower(trim(name)));
GRANT SELECT ON public.subjects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view subjects" ON public.subjects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert subjects" ON public.subjects FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update subjects" ON public.subjects FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete subjects" ON public.subjects FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Restricted words =====
CREATE TABLE public.restricted_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL CHECK (char_length(trim(word)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX restricted_words_unique ON public.restricted_words (lower(trim(word)));
REVOKE ALL ON public.restricted_words FROM anon;
GRANT SELECT, INSERT, DELETE ON public.restricted_words TO authenticated;
GRANT ALL ON public.restricted_words TO service_role;
ALTER TABLE public.restricted_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view restricted words" ON public.restricted_words FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins add restricted words" ON public.restricted_words FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete restricted words" ON public.restricted_words FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.normalize_restricted_word()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.word := lower(trim(NEW.word)); RETURN NEW; END;
$$;
CREATE TRIGGER restricted_words_normalize BEFORE INSERT OR UPDATE ON public.restricted_words
  FOR EACH ROW EXECUTE FUNCTION public.normalize_restricted_word();

-- Returns the first restricted word found in the text (whole-word, case-insensitive), or NULL
CREATE OR REPLACE FUNCTION public.find_restricted_word(_text text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rw.word FROM public.restricted_words rw
  WHERE _text ~* ('\m' || regexp_replace(rw.word, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M')
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.find_restricted_word(text) FROM anon, authenticated, public;

-- ===== Reviews =====
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL REFERENCES public.professors(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  difficulty smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  would_recommend boolean NOT NULL,
  grade text NOT NULL CHECK (grade IN ('O','A+','A','B+','B','C','P','F','Not received yet')),
  tags text[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(tags) <= 3 AND tags <@ ARRAY['Too Many Assignments','Practical Teaching','PPT Reader','Strict Viva']::text[]
  ),
  comment text NOT NULL CHECK (char_length(trim(comment)) BETWEEN 10 AND 2000),
  like_count integer NOT NULL DEFAULT 0,
  dislike_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_id)
);
CREATE INDEX reviews_professor_idx ON public.reviews (professor_id, created_at DESC);
-- Reviewer identity (user_id) is never readable through the API
REVOKE ALL ON public.reviews FROM anon, authenticated;
GRANT SELECT (id, professor_id, subject_id, rating, difficulty, would_recommend, grade, tags, comment, like_count, dislike_count, created_at)
  ON public.reviews TO anon, authenticated;
GRANT INSERT (professor_id, subject_id, rating, difficulty, would_recommend, grade, tags, comment) ON public.reviews TO authenticated;
GRANT DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Signed-in students add their own reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins remove reviews" ON public.reviews FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bad text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL AND current_user NOT IN ('service_role','postgres') THEN
      RAISE EXCEPTION 'You must be signed in to post a review';
    END IF;
    IF auth.uid() IS NOT NULL THEN NEW.user_id := auth.uid(); END IF;
    NEW.like_count := 0;
    NEW.dislike_count := 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = NEW.subject_id AND s.professor_id = NEW.professor_id) THEN
    RAISE EXCEPTION 'Please choose a subject taught by this professor';
  END IF;
  NEW.comment := trim(NEW.comment);
  bad := public.find_restricted_word(NEW.comment);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'RESTRICTED_WORD:%', bad USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reviews_validate BEFORE INSERT OR UPDATE OF comment, subject_id, professor_id ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_review();

CREATE OR REPLACE FUNCTION public.refresh_professor_stats(_professor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.professors p SET
    review_count = s.cnt,
    avg_rating = s.avg_rating,
    avg_difficulty = s.avg_difficulty,
    recommend_count = s.rec
  FROM (
    SELECT count(*)::int AS cnt,
           round(avg(rating)::numeric, 2) AS avg_rating,
           round(avg(difficulty)::numeric, 2) AS avg_difficulty,
           count(*) FILTER (WHERE would_recommend)::int AS rec
    FROM public.reviews WHERE professor_id = _professor_id
  ) s
  WHERE p.id = _professor_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_professor_stats(uuid) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.reviews_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN PERFORM public.refresh_professor_stats(NEW.professor_id); END IF;
  IF TG_OP IN ('DELETE','UPDATE') THEN PERFORM public.refresh_professor_stats(OLD.professor_id); END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER reviews_stats AFTER INSERT OR UPDATE OF rating, difficulty, would_recommend, professor_id OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_after_change();

-- Which reviews did the current user write (without exposing anyone's identity)
CREATE OR REPLACE FUNCTION public.my_review_ids(_professor_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.reviews WHERE professor_id = _professor_id AND user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.my_review_ids(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_review_ids(uuid) TO authenticated;

-- ===== Votes =====
CREATE TABLE public.review_votes (
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);
REVOKE ALL ON public.review_votes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_votes TO authenticated;
GRANT ALL ON public.review_votes TO service_role;
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own votes" ON public.review_votes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users add their own votes" ON public.review_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users change their own votes" ON public.review_votes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users remove their own votes" ON public.review_votes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.validate_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = NEW.review_id AND r.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'You cannot vote on your own review';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER review_votes_validate BEFORE INSERT OR UPDATE ON public.review_votes
  FOR EACH ROW EXECUTE FUNCTION public.validate_vote();

CREATE OR REPLACE FUNCTION public.review_votes_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  rid := COALESCE(NEW.review_id, OLD.review_id);
  UPDATE public.reviews r SET
    like_count = (SELECT count(*) FROM public.review_votes v WHERE v.review_id = rid AND v.vote = 1),
    dislike_count = (SELECT count(*) FROM public.review_votes v WHERE v.review_id = rid AND v.vote = -1)
  WHERE r.id = rid;
  RETURN NULL;
END;
$$;
CREATE TRIGGER review_votes_counts AFTER INSERT OR UPDATE OR DELETE ON public.review_votes
  FOR EACH ROW EXECUTE FUNCTION public.review_votes_after_change();

-- ===== Reports =====
CREATE TABLE public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);
REVOKE ALL ON public.review_reports FROM anon;
GRANT SELECT, INSERT, DELETE ON public.review_reports TO authenticated;
GRANT ALL ON public.review_reports TO service_role;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own reports, admins see all" ON public.review_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users report reviews" ON public.review_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins dismiss reports" ON public.review_reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = NEW.review_id AND r.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'You cannot report your own review';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER review_reports_validate BEFORE INSERT ON public.review_reports
  FOR EACH ROW EXECUTE FUNCTION public.validate_report();