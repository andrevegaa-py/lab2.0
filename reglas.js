// ===== 1. CONEXIÓN A SUPABASE =====
// La clave "publishable" es pública por diseño; la seguridad la dan las políticas RLS (ver supabase.sql).
// NUNCA pongas aquí una clave "secret" ni "service_role".
const supabaseUrl = 'https://ugjbpftefipenjmsjpsp.supabase.co';
const supabaseKey = 'sb_publishable_qNrt9v8vQMhULMdh-7qmyw_3wn4Ylkq';
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

// ===== 2. UTILIDADES =====
const ESTADOS = ["En proceso", "En tránsito", "Listo para entrega"];

function escapar(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function moneda(n) {
  return "S/ " + (parseFloat(n) || 0).toFixed(2);
}

function avisar(mensaje, tipo = "ok") {
  const t = document.createElement("div");
  t.className = "toast toast-" + tipo;
  t.textContent = mensaje;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ===== 3. REGLAS DE NEGOCIO =====
// Regla 1: saldo pendiente = precio_total - adelanto (0 si ya está pagado)
function calcularSaldoPendiente(precioTotal, adelanto, pagado) {
  if (pagado) return 0;
  const p = parseFloat(precioTotal);
  const a = parseFloat(adelanto);
  if (isNaN(p) || isNaN(a)) return null;
  return Math.max(p - a, 0);
}

// Regla 2: demorado si los días desde fecha_pedido_proveedor superan plazo_estimado_dias
function calcularEstadoDemora(fechaProveedor, plazoDias, estado, hoy = new Date()) {
  if (["entregado", "listo para entrega"].includes(String(estado || "").toLowerCase())) return "En tiempo";
  if (!fechaProveedor) return "Fecha no registrada";
  if (!plazoDias) return "Sin estimar";
  const f = new Date(fechaProveedor + "T00:00:00");
  if (isNaN(f.getTime()) || f > hoy) return "Fecha inválida";
  const dias = Math.floor((hoy - f) / 86400000);
  return dias > plazoDias ? "Demorado" : "En tiempo";
}

// ===== 4. BASE DE DATOS (Supabase) =====
async function obtenerPedidos() {
  const { data, error } = await clienteSupabase
    .from("pedidos").select("*").order("fecha_pedido", { ascending: false });
  if (error) { console.error(error); avisar("No se pudieron cargar los pedidos: " + error.message, "error"); return []; }
  return data;
}

async function agregarPedido(pedido) {
  // IMPORTANTE: no enviamos "id"; lo genera Supabase solo.
  const { data, error } = await clienteSupabase.from("pedidos").insert([pedido]).select();
  if (error) { console.error(error); avisar("Error al guardar: " + error.message, "error"); return null; }
  return data[0] ?? {};
}

async function obtenerPedidoPorId(id) {
  const { data, error } = await clienteSupabase.from("pedidos").select("*").eq("id", id).maybeSingle();
  if (error) { console.error(error); avisar("Error al buscar el pedido: " + error.message, "error"); return null; }
  return data;
}

async function actualizarPedido(id, cambios) {
  const { data, error } = await clienteSupabase.from("pedidos").update(cambios).eq("id", id).select();
  if (error) { console.error(error); avisar("Error al actualizar: " + error.message, "error"); return null; }
  return data[0] ?? null;
}
