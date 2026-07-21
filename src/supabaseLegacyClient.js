import { createClient } from "@supabase/supabase-js";

// Lectura temporal de compatibilidad con la antigua BETA miweb-staging.
// No debe utilizarse para crear pedidos ni participaciones nuevas.
const legacySupabaseUrl = "https://tdpvhhvwnkyfnuujajku.supabase.co";

const legacySupabaseAnonKey =
  "sb_publishable_PQyNF-G7B6URCYZSWHnfbQ_k1Sn0VRk";

export const legacySupabase = createClient(
  legacySupabaseUrl,
  legacySupabaseAnonKey
);
