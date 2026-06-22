-- Fix security advisor warnings: immutable search_path on functions
ALTER FUNCTION public.hub_jwt_claim(TEXT) SET search_path = public;
ALTER FUNCTION public.hub_tenant_id() SET search_path = public;
ALTER FUNCTION public.hub_user_id() SET search_path = public;
ALTER FUNCTION public.hub_role_name() SET search_path = public;
ALTER FUNCTION public.hub_is_admin() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
