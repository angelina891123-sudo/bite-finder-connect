CREATE TYPE public.foodie_subscription_status AS ENUM ('inactive', 'active', 'expired');

ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS foodie_subscription_status public.foodie_subscription_status NOT NULL DEFAULT 'inactive';

-- Backfill: merchant_profiles was historically only created client-side at signup
-- (and skipped when email confirmation delays session creation), so some existing
-- merchants may not have a row yet. Give every merchant role a row to own this status.
INSERT INTO public.merchant_profiles (user_id, store_name, region, contact_name, email)
SELECT ur.user_id,
  COALESCE(p.restaurant_name, p.display_name, '未命名店家'),
  p.region,
  p.display_name,
  NULL
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'merchant'
ON CONFLICT (user_id) DO NOTHING;

-- Keep it that way going forward: every new merchant signup gets a merchant_profiles
-- row (with the default 'inactive' status) even if the client-side insert in
-- src/routes/auth.tsx is skipped (pending email confirmation).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  IF NEW.raw_user_meta_data ->> 'role' = 'merchant' THEN
    INSERT INTO public.merchant_profiles (user_id, store_name, region, contact_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'restaurant_name', NEW.raw_user_meta_data ->> 'display_name', '未命名店家'),
      NEW.raw_user_meta_data ->> 'region',
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
