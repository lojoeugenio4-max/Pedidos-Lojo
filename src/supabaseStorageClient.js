import { createClient } from "@supabase/supabase-js";

const supabaseStorageUrl =
  "https://bohlxagrtpjvqrgkonlo.supabase.co";

const supabaseStorageAnonKey =
  "sb_publishable_tpgtppDeMr2dGJIiZtB5nA_OXih8FKF";

export const supabaseStorage = createClient(
  supabaseStorageUrl,
  supabaseStorageAnonKey
);
