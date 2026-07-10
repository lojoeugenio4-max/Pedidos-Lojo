import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bohlxagrtpjvqrgkonlo.supabase.co";

const supabaseAnonKey =
  "sb_publishable_tpgtppDeMr2dGJIiZtB5nA_OXih8FKF";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
