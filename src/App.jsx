import React, { useMemo, useState } from "react";
import { Send, ImageOff } from "lucide-react";
import { departments } from "./products";

const WHATSAPP_NUMBER = "34670716744";

const normalize = (text) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const matchesSearch = (product, search) => {
  const p = normalize(product);
  const words = normalize(search).split(/\s+/).filter(Boolean);
  return words.every((w) => p.includes(w));
};

const getImageFileName = (name) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getImageUrl = (name) => `/images/${getImageFileName(name)}.jpg`;

function ProductPhoto({ name, onClick }) {
  const [error, setError] = useState(false);
  const src = getImageUrl(name);

  if (error) {
    return (
      <div style={styles.photoBox}>
        <ImageOff size={28} />
        <span>Sin foto</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      style={styles.productImage}
      onClick={() => onClick(src)}
      onError={() => setError(true)}
    />
  );
}

export default function App() {
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState({});
  const [zoomImage, setZoomImage] = useState(null);

  const filtered = useMemo(() => {
    const clean = search.trim();

    return departments
      .map((department) => ({
        ...department,
        products: clean
          ? department.products.filter((product) => matchesSearch(product, clean))
          : department.products,
      }))
      .filter((department) => department.products.length > 0);
  }, [search]);

  const update = (id, field, value) => {
    const clean = value.replace(/[^0-9]/g, "");
    setQty((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: clean,
      },
    }));
  };

  const send = () => {
    const lines = ["Nuevo pedido", ""];

    Object.entries(qty).forEach(([id, value]) => {
      if (value?.cajas || value?.unidades) {
        const productName = id.split("-").slice(1).join("-");
        lines.push(
          `- ${productName}: ${value.cajas || 0} cajas / ${
            value.unidades || 0
          } unidades`
        );
      }
    });

    if (lines.length <= 2) {
      alert("Añade productos antes de enviar.");
      return;
    }

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        lines.join("\n")
      )}`,
      "_blank"
    );
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Pedido online Cash Lojo</h1>

      <div style={styles.topBar}>
        <input
          placeholder="Buscar artículo..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={styles.search}
        />

        <button onClick={send} style={styles.whatsappButton}>
          <Send size={20} />
          Enviar
        </button>
      </div>

      {filtered.map((department) => (
        <section key={department.name} style={styles.section}>
          <h2 style={styles.sectionTitle}>{department.name}</h2>

          {department.products.map((name) => {
            const id = `${department.name}-${name}`;

            return (
              <div key={id} style={styles.card}>
                <div style={styles.productLayout}>
                  <div style={styles.qtyColumn}>
                    <input
                      placeholder="Cajas"
                      value={qty[id]?.cajas || ""}
                      onChange={(event) =>
                        update(id, "cajas", event.target.value)
                      }
                      style={styles.qtyInput}
                      inputMode="numeric"
                    />

                    <input
                      placeholder="Unid."
                      value={qty[id]?.unidades || ""}
                      onChange={(event) =>
                        update(id, "unidades", event.target.value)
                      }
                      style={styles.qtyInput}
                      inputMode="numeric"
                    />
                  </div>

                  <ProductPhoto name={name} onClick={setZoomImage} />
                </div>

                <div style={styles.productName}>{name}</div>
              </div>
            );
          })}
        </section>
      ))}

      {zoomImage && (
        <div style={styles.overlay} onClick={() => setZoomImage(null)}>
          <img
            src={zoomImage}
            alt="Producto ampliado"
            style={styles.zoomedImage}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: 8,
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  },

  title: {
    margin: "0 0 8px",
    fontSize: 22,
    fontWeight: "900",
  },

  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    display: "grid",
    gridTemplateColumns: "1fr 105px",
    gap: 6,
    background: "#f1f5f9",
    padding: "6px 0 10px",
  },

  search: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    fontSize: 17,
    fontWeight: "600",
    boxSizing: "border-box",
  },

  whatsappButton: {
    height: 50,
    border: "none",
    borderRadius: 12,
    background: "#22c55e",
    color: "white",
    fontSize: 16,
    fontWeight: "900",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  section: {
    marginBottom: 14,
  },

  sectionTitle: {
    margin: "8px 0",
    background: "#0f172a",
    color: "white",
    padding: "10px 12px",
    borderRadius: 12,
    fontSize: 18,
    fontWeight: "900",
  },

  card: {
    background: "white",
    borderRadius: 14,
    padding: 8,
    marginBottom: 8,
    boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
  },

  productLayout: {
    display: "grid",
    gridTemplateColumns: "64px 1fr",
    gap: 8,
    alignItems: "stretch",
  },

  qtyColumn: {
    display: "grid",
    gridTemplateRows: "1fr 1fr",
    gap: 6,
  },

  qtyInput: {
    width: "100%",
    minHeight: 54,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "900",
    boxSizing: "border-box",
  },

  productImage: {
    width: "100%",
    height: 116,
    objectFit: "contain",
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
  },

  photoBox: {
    height: 116,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontSize: 16,
    fontWeight: "800",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  productName: {
    marginTop: 7,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 1.25,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.9)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },

  zoomedImage: {
    maxWidth: "96%",
    maxHeight: "92%",
    objectFit: "contain",
    background: "white",
    borderRadius: 14,
  },
};
