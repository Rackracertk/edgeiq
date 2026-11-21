import { createClient } from '@supabase/supabase-js'

// This publishable key is safe in browser code. NEVER expose a service-role or Stripe secret key here.
// Supabase RLS and server-side Stripe webhooks enforce actual subscriptions.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null
