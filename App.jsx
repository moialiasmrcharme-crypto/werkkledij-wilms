import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [ordersByEmployee, setOrdersByEmployee] = useState({});

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedStockId, setSelectedStockId] = useState("");
  const [qty, setQty] = useState(1);

  const [orderCart, setOrderCart] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const { data: emp } = await supabase.from("employees").select("*");
    const { data: stock } = await supabase.from("stock_items").select("*");
    const { data: orders } = await supabase.from("orders").select("*");
    const { data: lines } = await supabase.from("order_lines").select("*");

    const grouped = {};
    orders?.forEach((o) => {
      if (!grouped[o.employee_id]) grouped[o.employee_id] = [];
      grouped[o.employee_id].push({
        ...o,
        lines: lines?.filter((l) => l.order_id === o.id),
      });
    });

    setEmployees(emp || []);
    setStockItems(stock || []);
    setOrdersByEmployee(grouped);
  }

  const activeStock = stockItems.filter((s) => s.active);

  function addToCart() {
    const item = stockItems.find((s) => s.id == selectedStockId);
    if (!item) return;

    if (item.quantity < qty) {
      setError("Onvoldoende voorraad");
      return;
    }

    setOrderCart((prev) => [
      ...prev,
      {
        stock_item_id: item.id,
        item_name: item.item_name,
        size: item.size,
        variant: item.variant,
        qty,
      },
    ]);
  }

  async function createOrder() {
    if (!selectedEmployeeId || orderCart.length === 0) return;

    for (let line of orderCart) {
      const stock = stockItems.find((s) => s.id === line.stock_item_id);
      if (!stock || stock.quantity < line.qty) {
        setError("Stock onvoldoende bij opslaan");
        return;
      }
    }

    const { data: order } = await supabase
      .from("orders")
      .insert([{ employee_id: Number(selectedEmployeeId) }])
      .select()
      .single();

    for (let line of orderCart) {
      const stock = stockItems.find((s) => s.id === line.stock_item_id);

      await supabase.from("order_lines").insert([
        {
          order_id: order.id,
          stock_item_id: line.stock_item_id,
          qty: line.qty,
          size: line.size,
          variant: line.variant,
          points_per_unit: 0,
        },
      ]);

      await supabase
        .from("stock_items")
        .update({ quantity: stock.quantity - line.qty })
        .eq("id", line.stock_item_id);
    }

    setOrderCart([]);
    setSelectedStockId("");
    setQty(1);

    await loadAll();
  }

  async function toggleStock(item) {
    await supabase
      .from("stock_items")
      .update({ active: !item.active })
      .eq("id", item.id);

    loadAll();
  }

  function exportStock() {
    const rows = stockItems.map((s) => ({
      artikel: s.item_name,
      maat: s.size,
      voorraad: s.quantity,
    }));

    const csv =
      Object.keys(rows[0]).join(",") +
      "\n" +
      rows.map((r) => Object.values(r).join(",")).join("\n");

    const blob = new Blob([csv]);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "voorraad.csv";
    link.click();
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Stock + Bestellingen</h1>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <h2>Nieuwe bestelling</h2>

      <select
        value={selectedEmployeeId}
        onChange={(e) => setSelectedEmployeeId(e.target.value)}
      >
        <option value="">Kies werknemer</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.full_name}
          </option>
        ))}
      </select>

      <br />

      <select
        value={selectedStockId}
        onChange={(e) => setSelectedStockId(e.target.value)}
      >
        <option value="">Kies artikel</option>
        {activeStock.map((s) => (
          <option key={s.id} value={s.id}>
            {s.item_name} ({s.size}) - {s.quantity}
          </option>
        ))}
      </select>

      <input
        type="number"
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
      />

      <button onClick={addToCart}>Toevoegen</button>

      <h3>Mandje</h3>
      {orderCart.map((l, i) => (
        <div key={i}>
          {l.item_name} - {l.size} x {l.qty}
        </div>
      ))}

      <button onClick={createOrder}>Opslaan</button>

      <h2>Voorraad</h2>
      <button onClick={exportStock}>Export CSV</button>

      {stockItems.map((s) => (
        <div key={s.id}>
          {s.item_name} - {s.size} ({s.quantity})
          {s.quantity <= s.minimum_quantity && (
            <span style={{ color: "orange" }}> ⚠ laag</span>
          )}
          <button onClick={() => toggleStock(s)}>
            {s.active ? "Deactiveren" : "Activeren"}
          </button>
        </div>
      ))}
    </div>
  );
}
