import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tdpvhhvwnkyfnuujajku.supabase.co";
const supabaseAnonKey =
  "sb_publishable_PQyNF-G7B6URCYZSWHnfbQ_k1Sn0VRk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
