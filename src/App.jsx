import React, { useMemo, useState } from "react";
import { Send, ImageOff } from "lucide-react";
import { departments, hiddenProductsRaw } from "./products";

const WHATSAPP_NUMBER = "34670716744";

// 🔍 NORMALIZAR TEXTO
const normalize = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// 🔍 BUSCADOR
const matchesSearch = (product, search) => {
  const p = normalize(product);
  const words = normalize(search).split(/\s+/);
  return words.every((w) => p.includes(w));
};

// 📸 GENERAR NOMBRE DE IMAGEN
const getImageFileName = (name) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// 📸 URL IMAGEN
const getImageUrl = (name) =>
  `/images/${getImageFileName(name)}.jpg`;

// 📸 COMPONENTE FOTO
function ProductPhoto({ name }) {
  const [error, setError] = useState(false);
  const src = getImageUrl(name);

  if (error) {
    return (
      <div style={styles.photoBox}>
        <ImageOff size={20} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      style={styles.productImage}
      onError={() => setError(true)}
    />
  );
}

export default function App() {
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState({});

  const filtered = useMemo(() => {
    const clean = search.trim();

    return departments
      .map((d) => ({
        ...d,
        products: clean
          ? d.products.filter((p) => matchesSearch(p, clean))
          : d.products
      }))
      .filter((d) => d.products.length > 0);
  }, [search]);

  const update = (id, field, val) => {
    const clean = val.replace(/[^0-9]/g, "");
    setQty((q) => ({
      ...q,
      [id]: { ...q[id], [field]: clean }
    }));
  };

  const send = () => {
    const lines = [];

    Object.entries(qty).forEach(([id, val]) => {
      if (val?.cajas || val?.unidades) {
        lines.push(
          `${id} → ${val.cajas || 0} cajas / ${val.unidades || 0} uds`
        );
      }
    });

    if (!lines.length) return alert("Añade productos");

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        lines.join("\n")
      )}`,
      "_blank"
    );
  };

  return (
    <div style={styles.page}>
      <h1>Pedidos con Fotos</h1>

      <input
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={styles.search}
      />

      {filtered.map((dep) => (
        <div key={dep.name}>
          <h2>{dep.name}</h2>

          {dep.products.map((name) => {
            const id = `${dep.name}-${name}`;

            return (
              <div key={id} style={styles.row}>
                <div style={styles.topRow}>
                  <input
                    placeholder="Cajas"
                    value={qty[id]?.cajas || ""}
                    onChange={(e) =>
                      update(id, "cajas", e.target.value)
                    }
                    style={styles.qtyInput}
                  />

                  <input
                    placeholder="Unid"
                    value={qty[id]?.unidades || ""}
                    onChange={(e) =>
                      update(id, "unidades", e.target.value)
                    }
                    style={styles.qtyInput}
                  />

                  <ProductPhoto name={name} />
                </div>

                <div style={styles.name}>{name}</div>
              </div>
            );
          })}
        </div>
      ))}

      <button onClick={send} style={styles.button}>
        <Send size={18} /> Enviar por WhatsApp
      </button>
    </div>
  );
}

// 🎨 ESTILOS
const styles = {
  page: {
    padding: 12,
    fontFamily: "Arial",
    background: "#f1f5f9"
  },

  search: {
    width: "100%",
    padding: 10,
    marginBottom: 12,
    borderRadius: 10,
    border: "1px solid #ccc"
  },

  row: {
    background: "white",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)"
  },

  topRow: {
    display: "grid",
    gridTemplateColumns: "70px 70px 1fr",
    gap: 8,
    alignItems: "center"
  },

  productImage: {
    width: "100%",
    height: 76,
    objectFit: "contain",
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #ddd"
  },

  photoBox: {
    height: 76,
    background: "#eee",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },

  qtyInput: {
    width: "100%",
    height: 76,
    borderRadius: 10,
    border: "1px solid #ccc",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold"
  },

  name: {
    marginTop: 8,
    fontWeight: "bold",
    fontSize: 14
  },

  button: {
    width: "100%",
    padding: 14,
    background: "#0f172a",
    color: "white",
    borderRadius: 12,
    border: "none",
    fontSize: 16,
    marginTop: 12
  }
};
