CREATE TYPE public.app_role AS ENUM ('admin','merchant','creator');
CREATE TYPE public.campaign_status AS ENUM ('draft','published','closed');
CREATE TYPE public.application_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  phone text,
  instagram_handle text,
  follower_count integer NOT NULL DEFAULT 0,
  restaurant_name text,
  region text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  restaurant_name text,
  region text NOT NULL,
  min_followers integer NOT NULL DEFAULT 0,
  collab_type text NOT NULL,
  reward text NOT NULL,
  slots integer NOT NULL DEFAULT 1,
  deadline date,
  cover_url text,
  status public.campaign_status NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT ON public.campaigns TO anon;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status public.application_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, creator_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(),'admin'));

-- user_roles policies
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles_insert_self_nonadmin" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND role <> 'admin');

-- campaigns policies
CREATE POLICY "campaigns_public_read" ON public.campaigns FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "campaigns_auth_read" ON public.campaigns FOR SELECT TO authenticated USING (status = 'published' OR merchant_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "campaigns_merchant_insert" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (merchant_id = auth.uid() AND public.has_role(auth.uid(),'merchant'));
CREATE POLICY "campaigns_merchant_update" ON public.campaigns FOR UPDATE TO authenticated USING (merchant_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (merchant_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "campaigns_merchant_delete" ON public.campaigns FOR DELETE TO authenticated USING (merchant_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- applications policies
CREATE POLICY "applications_read" ON public.applications FOR SELECT TO authenticated USING (
  creator_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.merchant_id = auth.uid())
);
CREATE POLICY "applications_creator_insert" ON public.applications FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid() AND public.has_role(auth.uid(),'creator'));
CREATE POLICY "applications_update" ON public.applications FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.merchant_id = auth.uid())
) WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.merchant_id = auth.uid())
);
CREATE POLICY "applications_creator_delete" ON public.applications FOR DELETE TO authenticated USING (creator_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- profile auto-create
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, restaurant_name, instagram_handle, region)
  VALUES (NEW.id,
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'restaurant_name',
    NEW.raw_user_meta_data ->> 'instagram_handle',
    NEW.raw_user_meta_data ->> 'region')
  ON CONFLICT (id) DO NOTHING;
  IF NEW.raw_user_meta_data ->> 'role' IN ('merchant','creator') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data ->> 'role')::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();