# EDGEIQ free beta: demand validation without subscriptions

## State
- Keep the public website open for free accounts and research where the source permits it.
- Never turn on `VITE_RESEARCH_MODE=licensed` or `SPORTS_LICENSE_APPROVED=true` without proper data rights and verified ingestion.
- Stripe prices remain reference prices; checkout is disabled. No paid plan is promised yet.
- Stay within Cloudflare and Supabase free tier quotas; review usage and any billing settings in the dashboards regularly. Free tiers have limits and may change.

## Measure demand
The **Pro interest list** is opt-in, available only to signed-in users. Users can pick a preferred future plan, update their choice, or remove themselves. Joining is not a trial, order, payment or subscription. No email is sent automatically; only contact users later if compliant with their consent and a sender is configured.

The owner can inspect aggregate metrics from the Supabase SQL editor (these counts are not exposed to visitors):

```sql
select (select count(*) from auth.users) as total_accounts,
       (select count(*) from public.pro_interest) as pro_interest_total,
       (select count(*) from public.subscriptions where status in ('active', 'trialing')) as active_paid_subscriptions;

select preferred_plan, count(*) as interested
from public.pro_interest
group by preferred_plan
order by interested desc;

select date_trunc('week', created_at)::date as week, count(*) as interested
from public.pro_interest
group by 1 order by 1 desc;
```

## Before monetization
1. Confirm the research service has a legitimate right to serve the statistics to the public, especially if charging for access; don't represent scraped feeds as licensed.
2. Test NBA and NFL game logs, hit rates, completeness, delays and outage behavior against source records.
3. Do all Stripe sandbox tests: purchase, webhook, cancellation, failed/replayed events and Pro access control.
4. Test login, RLS isolation, removal from interest list and responsive design.
5. Publish accurate policies (privacy, cancellation, terms, refunds), then activate payment processing only after separate owner approval.
6. Use actual returning-user activity and opt-in demand as signals. Waitlist counts alone cannot predict revenue.
