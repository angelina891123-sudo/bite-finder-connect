-- foodie_subscription_status only records whether the plan is active; the
-- backoffice header also needs to show which plan the merchant is on.
CREATE TYPE public.foodie_plan AS ENUM ('basic', 'pro', 'enterprise');

-- Nullable: merchants who have never subscribed are not on any plan.
ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS foodie_plan public.foodie_plan;
