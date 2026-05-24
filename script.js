const STORAGE_KEY = "felizviaje_form";
const STAR_SYMBOL = "\u2B50";
const COPY_DEFAULT_TEXT = "Copiar mensaje";

document.addEventListener("DOMContentLoaded", () => {
  const elements = getElements();
  const { form, year } = elements;
  if (!form) return;
  year.textContent = new Date().getFullYear();
  document.documentElement.setAttribute("data-theme", "dark");
  restoreForm(form);
  syncStarsFromInput();
  setDefaultQuoteDate(form);
  setupAutosave(form);
  setupFastTab(form);
  setupEscalaCounters(form);
  setupActions(elements);
  setupStarRatings(form);
});

function getElements() {
  return {
    form: document.getElementById("quoteForm"),
    output: document.getElementById("output"),
    year: document.getElementById("year"),
    copyBtn: document.getElementById("copyBtn"),
    clearBtn: document.getElementById("clearBtn"),
    generateBtn: document.getElementById("generateBtn"),
    whatsappBtn: document.getElementById("whatsappBtn"),
    linkUbicacion: document.getElementById("linkUbicacion"),
    pasteLocationBtn: document.getElementById("pasteLocationBtn"),
    saveTemplateBtn: document.getElementById("saveTemplateBtn"),
    saveNotification: document.getElementById("saveNotification")
  };
}

function setupAutosave(form) {
  const save = () => saveToStorage(serializeForm(form));

  form.addEventListener("input", handleFormChange);
  form.addEventListener("change", handleFormChange);

  function handleFormChange(event) {
    if (!event.target.matches("input, textarea, select")) return;
    save();
  }
}

function setupFastTab(form) {
  form.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;

    const fields = getTabFields(form);
    const currentIndex = fields.indexOf(event.target);
    if (currentIndex === -1) return;

    const nextField = fields[currentIndex + (event.shiftKey ? -1 : 1)];
    if (!nextField) return;

    event.preventDefault();
    nextField.focus();

    if (typeof nextField.select === "function" && isTextLikeField(nextField)) {
      nextField.select();
    }
  });
}

function setupEscalaCounters(form) {
  form.addEventListener("click", (event) => {
    const button = event.target.closest(".counter-btn");
    if (!button) return;

    const input = form.querySelector(`#${button.dataset.target}`);
    if (!input) return;

    const step = button.dataset.action === "increase" ? 1 : -1;
    const currentValue = Number(input.value) || 0;
    const nextValue = Math.max(0, currentValue + step);
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function getTabFields(form) {
  return [...form.querySelectorAll('input, select, textarea, button[type="button"]')].filter((field) => {
    if (field.type === "hidden" || field.disabled) return false;
    return field.offsetParent !== null;
  });
}

function isTextLikeField(field) {
  return field.tagName === "TEXTAREA" || ["text", "number", "url", "search", "email", "tel"].includes(field.type);
}

function setupActions(elements) {
  const { form, output, copyBtn, clearBtn, generateBtn, whatsappBtn, linkUbicacion, pasteLocationBtn, saveTemplateBtn, saveNotification } = elements;

  generateBtn.addEventListener("click", () => {
    output.value = buildMessage(serializeForm(form));
    output.scrollTop = 0;
    output.classList.remove("message-ready");
    void output.offsetWidth;
    output.classList.add("message-ready");
    const previewPanel = output.closest(".preview-panel");
    if (previewPanel) {
      const top = previewPanel.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top, behavior: "smooth" });
    }
  });

  copyBtn.addEventListener("click", async () => {
    if (!output.value) {
      alert("No hay mensaje para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
      copyBtn.textContent = "Copiado ✓";
      window.setTimeout(() => (copyBtn.textContent = COPY_DEFAULT_TEXT), 2000);
    } catch {
      alert("Error al copiar. Usa Ctrl+C o copialo manualmente.");
    }
  });

  whatsappBtn.addEventListener("click", () => {
    if (!output.value) {
      alert("No hay mensaje para enviar.");
      return;
    }

    const encodedMessage = encodeURIComponent(output.value);
    window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
  });

  pasteLocationBtn.addEventListener("click", async () => {
    try {
      linkUbicacion.value = await navigator.clipboard.readText();
      linkUbicacion.focus();
      saveToStorage(serializeForm(form));
    } catch {
      alert("No se pudo pegar desde el portapapeles. Asegura permisos de navegador.");
    }
  });

  clearBtn.addEventListener("click", () => {
    form.reset();
    output.value = "";
    clearStorage();
    resetStars();
    setDefaultQuoteDate(form);
  });

  saveTemplateBtn.addEventListener("click", () => {
    saveToStorage(serializeForm(form), true, saveNotification);
  });
}

function serializeForm(form) {
  const data = {};
  [...form.elements].filter(({ name }) => name).forEach((field) => {
    const { name, type, value, checked } = field;
    if (type === "checkbox") {
      if (name in data) return;
      data[name] = [...form.querySelectorAll(`[name="${name}"]:checked`)].map(({ value: itemValue }) => itemValue);
      return;
    }

    if (type === "radio") {
      if (name in data) return;
      data[name] = form.querySelector(`[name="${name}"]:checked`)?.value || "";
      return;
    }

    if (type === "hidden" && name !== "estrellas") return;
    if (type === "checkbox" && !checked) return;
    data[name] = value;
  });
  return data;
}

function restoreForm(form) {
  const savedData = loadFromStorage();
  if (!savedData) return;

  Object.entries(savedData).forEach(([name, value]) => {
    const fields = [...form.querySelectorAll(`[name="${name}"]`)];
    if (!fields.length) return;

    const [firstField] = fields;
    if (firstField.type === "checkbox") {
      const selectedValues = Array.isArray(value) ? value : [];
      fields.forEach((field) => (field.checked = selectedValues.includes(field.value)));
      return;
    }
    if (firstField.type === "radio") {
      fields.forEach((field) => (field.checked = field.value === value));
      return;
    }
    firstField.value = value ?? "";
  });
}

function saveToStorage(data, showNotification = false, notificationElement = null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (showNotification && notificationElement) {
      showSaveNotification(notificationElement);
    }
  } catch (error) {
    console.warn("No se pudo guardar en localStorage:", error);
  }
}

function loadFromStorage() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    return savedData ? JSON.parse(savedData) : null;
  } catch (error) {
    console.warn("No se pudo cargar desde localStorage:", error);
    return null;
  }
}

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("No se pudo limpiar localStorage:", error);
  }
}

function showSaveNotification(notification) {
  notification.hidden = true;
  void notification.offsetWidth;
  notification.hidden = false;
  window.clearTimeout(showSaveNotification.timeoutId);
  showSaveNotification.timeoutId = window.setTimeout(() => (notification.hidden = true), 3000);
}

function setDefaultQuoteDate(form) {
  const quoteDate = form.querySelector('[name="fecha_cotizacion"]');
  if (!quoteDate || quoteDate.value) return;
  quoteDate.value = new Date().toISOString().split("T")[0];
}

function setupStarRatings(form) {
  form.querySelectorAll(".star-rating").forEach((group) => {
    const hiddenInput = getStarInput(group);
    if (!hiddenInput) return;
    group.tabIndex = 0;
    group.addEventListener("click", ({ target }) => handleStarPointer(target, group, hiddenInput, form));
    group.addEventListener("mouseover", ({ target }) => {
      const star = target.closest(".star");
      if (star) paintStars(group, Number(star.dataset.value), true);
    });
    group.addEventListener("mouseout", () => paintStars(group, getStarCount(hiddenInput.value)));
    group.addEventListener("keydown", (event) => handleStarKeys(event, group, hiddenInput, form));
  });
}

function getStarInput(group) {
  return group.closest(".field")?.querySelector('input[name="estrellas"]') || null;
}

function handleStarPointer(target, group, hiddenInput, form) {
  const star = target.closest(".star");
  if (!star) return;
  setStarValue(group, hiddenInput, Number(star.dataset.value));
  saveToStorage(serializeForm(form));
}

function handleStarKeys(event, group, hiddenInput, form) {
  const currentValue = getStarCount(hiddenInput.value);
  const nextValue = {
    ArrowRight: Math.min(currentValue + 1, 5),
    ArrowUp: Math.min(currentValue + 1, 5),
    ArrowLeft: Math.max(currentValue - 1, 1),
    ArrowDown: Math.max(currentValue - 1, 1)
  }[event.key];
  if (!nextValue) return;
  event.preventDefault();
  setStarValue(group, hiddenInput, nextValue);
  saveToStorage(serializeForm(form));
}

function setStarValue(group, hiddenInput, value) {
  hiddenInput.value = STAR_SYMBOL.repeat(value);
  paintStars(group, value);
}

function paintStars(group, value, isHover = false) {
  group.querySelectorAll(".star").forEach((star) => {
    const isActive = Number(star.dataset.value) <= value;
    star.classList.toggle("active", isActive);
    star.classList.toggle("selected", isHover && isActive);
  });
}

function getStarCount(value = "") {
  return value.length;
}

function syncStarsFromInput() {
  document.querySelectorAll(".star-rating").forEach((group) => {
    const hiddenInput = getStarInput(group);
    paintStars(group, getStarCount(hiddenInput?.value));
  });
}

function resetStars() {
  document.querySelectorAll(".star-rating").forEach((group) => {
    const hiddenInput = getStarInput(group);
    if (hiddenInput) hiddenInput.value = "";
    paintStars(group, 0);
  });
}

function buildMessage(values) {
  const safe = (key, fallback = "-") => {
    const value = values[key]?.trim();
    return value ? value : fallback;
  };

  const capitalizeFirst = (text) => {
    if (!text || text === "-") return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const textField = (key, fallback = "-") => capitalizeFirst(safe(key, fallback));

  const formatDate = (date) => {
    if (!date) return "-";
    const [year, month, day] = date.split("-");
    return year && month && day ? `${Number(day)}/${Number(month)}/${year}` : date;
  };

  const formatDateField = (key, fallback = "-") => {
    const value = values[key]?.trim();
    return value ? formatDate(value) : fallback;
  };

  const titleCase = (text) => text.toLowerCase().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

  const equipaje = Array.isArray(values.equipaje) ? values.equipaje.filter(Boolean).map(titleCase).join(" + ") : values.equipaje ? titleCase(values.equipaje) : "-";

  const precio = values.precio
    ? Number(values.precio).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : safe("precio", "0");

  const escalaIda = Number(values.escala_ida || 0);
  const escalaVuelta = Number(values.escala_vuelta || 0);
  const escalaLabels = [];
  if (escalaIda > 0) escalaLabels.push(`${escalaIda} Escala${escalaIda === 1 ? "" : "s"} Ida`);
  if (escalaVuelta > 0) escalaLabels.push(`${escalaVuelta} Escala${escalaVuelta === 1 ? "" : "s"} Vuelta`);
  const escalasText = escalaLabels.length ? escalaLabels.join(" - ") : "Directo";

  const vueloSalida = values.fecha_vuelo_salida?.trim();
  const vueloRegreso = values.fecha_vuelo_regreso?.trim();
  const flightDates = vueloSalida || vueloRegreso ? `${formatDate(vueloSalida || "")}${vueloRegreso ? ` - ${formatDate(vueloRegreso)}` : ""}` : "-";

  const asistenciaIncluida = ["sí", "si"].includes(safe("asistencia", "no").toLowerCase());
  const asistenciaText = asistenciaIncluida ? "✅ Asistencia al viajero incluida" : "Asistencia al viajero no incluida. Puede añadirse al reservar o más adelante. Es requisito obligatorio en la mayoría de los destinos internacionales";

  return `*PAQUETE ${safe("destino").toUpperCase()}*

📅 Salida: ${formatDateField("fecha_salida")}
📍 Desde: ${safe("origen")}
🌙 Duración: ${safe("noches")} Noches

✅ Servicios que incluye el paquete:

> *✈️ AÉREO*
 ${textField("aerolinea")}
 ${flightDates}
 ${escalasText} | ${equipaje}

> *🚗 TRASLADO*
 ${textField("traslado")}

> *🏨 HOTEL*
 ${textField("hotel")} ${safe("estrellas")}
 (${textField("regimen")})
 ${safe("noches_hotel")} Noches | Ingreso: ${formatDateField("fecha_ingreso")}
📍 Ubicación: ${safe("link_ubicacion")}

💲*Tarifa final por Persona:*
${safe("moneda")} $${precio}

--------------------------------------------------

Información importante:
-Tarifas y disponibilidad sujetas a cambio al momento de la reserva.
-Cotización válida al ${formatDateField("fecha_cotizacion")}

ℹ️ Más info: (https://felizviaje.tur.ar/informacion-antes-de-contratar)

⚠️¡Cupos limitados!
-Para asegurar esta tarifa y evitar aumentos, recomendamos avanzar con la seña lo antes posible.
-Las plazas y precios pueden modificarse en cualquier momento según disponibilidad de vuelos y hotel.

✈️ Políticas generales de aerolíneas (tarifas económicas)
-Equipaje y la selección de asientos no están incluidos (pueden tener costo adicional)

${asistenciaText}

${textField("texto_adicional", "")}
`.trim();
}
