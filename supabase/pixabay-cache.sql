-- تخزين مؤقت مركزي لنتائج بحث Pixabay (شرط Pixabay: كاش 24 ساعة؛ وحدّها 100 طلب/دقيقة للمفتاح كله).
-- يقرؤه ويكتبه وسيط pixabay-proxy بمفتاح الخدمة فقط؛ RLS مفعّل بلا سياسات فلا وصول للمتصفح.
create table if not exists public.pixabay_cache (k text primary key, body text not null, exp timestamptz not null);
create index if not exists pixabay_cache_exp on public.pixabay_cache (exp);
alter table public.pixabay_cache enable row level security;
