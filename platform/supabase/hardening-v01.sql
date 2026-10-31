-- V-01 (2026-10-31): تضييق الصلاحيات الافتراضية على المشروع الحي. idempotent وآمن للإعادة.
-- الدوال الداخلية (SECURITY DEFINER) تستدعي بعضها بصلاحية المالك فلا يتأثر عملها بسحب EXECUTE من الأدوار؛ سياسات RLS تستدعي is_admin/has_perm/is_saas_admin بدور authenticated فتبقى لهذا الدور.

-- 1) جداول بلا حاجة لوصول مباشر من الزوار (RLS يمنعها أصلاً؛ هذا خط دفاع ثانٍ)
revoke all on table public.audit_log, public.pixabay_cache, public.saas_admins, public.saas_carrier_fixes, public.staff from anon;
revoke all on table public.saas_admins, public.staff, public.pixabay_cache from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.audit_log from authenticated;

-- 2) دوال داخلية: لا يستدعيها أي عميل
revoke execute on function public._audit(text, text, jsonb), public._ex_card(public.experts_profiles, boolean), public._ex_recount(uuid), public._ex_site(text),
  public._saas_site_notify(), public._saas_ticket_au(), public.orders_guard(), public._aal_ok(), public._actor_role(), public._staff_row() from public, anon, authenticated;
revoke execute on function public.staff_me(), public.hub_my_sites(), public.audit_event(text, text, jsonb), public.audit_perf(integer), public.audit_stats(integer),
  public.pack_orders(), public.pack_mark(text, boolean), public.has_perm(text), public.is_admin(), public.is_saas_admin() from public, anon;
