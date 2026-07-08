import React from "react";
import { createRoot } from "react-dom/client";
import App from "./GestorEstupefacientes.jsx";

// Fase 0: se renderiza el prototipo legado tal cual, para validar el pipeline
// de build y despliegue antes de trocearlo (Fase 1). La copia viva es
// src/GestorEstupefacientes.jsx; la referencia congelada vive en
// docs/legacy/GestorEstupefacientes.jsx (fuente de verdad de comportamiento).
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
