import { createClient } from "@supabase/supabase-js";

// BASE DE DATOS PRINCIPAL DE PRODUCCIÓN: pedidos-lojo.
// Todas las altas, pedidos, participaciones y validaciones nuevas deben usarla.
const supabaseUrl = "https://bohlxagrtpjvqrgkonlo.supabase.co";

const supabaseAnonKey =
  "sb_publishable_tpgtppDeMr2dGJIiZtB5nA_OXih8FKF";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
