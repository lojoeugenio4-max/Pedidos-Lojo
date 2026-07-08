import RuletaPremio from "./RuletaPremio";

export default function RuletaPremiosGrid({
  premios = [],
  premioSeleccionado,
  onSeleccionar,
}) {
  if (!premios.length) {
    return (
      <div style={vacio}>
        No hay premios configurados.
      </div>
    );
  }

  return (
    <div style={grid}>
      {premios.map((premio) => (
        <RuletaPremio
          key={premio.id}
          premio={premio}
          seleccionado={
            premioSeleccionado?.id === premio.id
          }
          onClick={onSeleccionar}
        />
      ))}
    </div>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fill,minmax(330px,1fr))",
  gap: 18,
};

const vacio = {
  padding: 30,
  textAlign: "center",
  border: "2px dashed #cbd5e1",
  borderRadius: 18,
  color: "#64748b",
  fontSize: 15,
};
