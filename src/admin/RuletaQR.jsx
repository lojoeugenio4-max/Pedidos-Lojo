import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function RuletaQR({
  codigo,
  onValidado,
  onError,
}) {
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    if (!codigo) return;
    validar();
  }, [codigo]);

  async function validar() {
    setVerificando(true);

    const { data, error } = await supabase
      .from("participaciones_ruleta")
      .select("*")
      .eq("codigo", codigo)
      .maybeSingle();

    setVerificando(false);

    if (error) {
      onError?.("No se pudo validar el código.");
      return;
    }

    if (!data) {
      onError?.("Código no válido.");
      return;
    }

    const tiradasTotales = Math.max(
      1,
      Number(
        data.tiradas_totales ??
          data.spins_total ??
          data.total_spins ??
          data.tiradas_ruleta ??
          1
      )
    );
    const tiradasUsadas = Number(
      data.tiradas_usadas ??
        data.spins_used ??
        data.used_spins ??
        data.tiradas_consumidas ??
        (data.utilizado ? 1 : 0)
    );

    if (data.utilizado && tiradasUsadas >= tiradasTotales) {
      onError?.("Este código ya ha agotado todas sus tiradas.");
      return;
    }

    onValidado?.({
      ...data,
      tiradas_totales: tiradasTotales,
      tiradas_usadas: Math.max(0, tiradasUsadas),
    });
  }

  return (
    <div style={contenedor}>
      {verificando ? "Validando código..." : null}
    </div>
  );
}

const contenedor = {
  minHeight: 24,
};
