"use client";

import { useMemo, useState } from "react";

type View =
  | "home"
  | "sale"
  | "stock"
  | "intake"
  | "reservations"
  | "orders"
  | "products"
  | "movements";

type Variant = {
  id: string;
  color: string;
  size: string;
  location: string;
  onHand: number;
  reserved: number;
};

type Product = {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  variants: Variant[];
};

type CartItem = {
  productId: string;
  variantId: string;
  quantity: number;
};

type Reservation = {
  id: string;
  customer: string;
  productId: string;
  variantId: string;
  quantity: number;
  expiresAt: string;
  status: "Activa" | "Cancelada";
};

type Movement = {
  id: string;
  type: string;
  detail: string;
  quantity: number;
  date: string;
  user: string;
};

const locations = ["Local Centro", "Depósito", "Feria"];

const initialProducts: Product[] = [
  {
    id: "palazzo",
    name: "Palazzo de verano",
    code: "PAL-001",
    category: "Pantalones",
    price: 15000,
    variants: [
      { id: "pal-s-negro-local", color: "Negro", size: "S", location: "Local Centro", onHand: 6, reserved: 0 },
      { id: "pal-s-crema-local", color: "Crema", size: "S", location: "Local Centro", onHand: 3, reserved: 1 },
      { id: "pal-m-negro-local", color: "Negro", size: "M", location: "Local Centro", onHand: 4, reserved: 0 },
      { id: "pal-m-bordo-local", color: "Bordó", size: "M", location: "Local Centro", onHand: 2, reserved: 0 },
      { id: "pal-l-negro-local", color: "Negro", size: "L", location: "Local Centro", onHand: 1, reserved: 0 },
      { id: "pal-s-azul-depo", color: "Azul marino", size: "S", location: "Depósito", onHand: 5, reserved: 0 },
      { id: "pal-m-crema-depo", color: "Crema", size: "M", location: "Depósito", onHand: 3, reserved: 0 },
      { id: "pal-l-bordo-feria", color: "Bordó", size: "L", location: "Feria", onHand: 2, reserved: 0 },
    ],
  },
  {
    id: "remera-basic",
    name: "Remera Basic",
    code: "REM-014",
    category: "Remeras",
    price: 8500,
    variants: [
      { id: "rem-s-blanco-local", color: "Blanco", size: "S", location: "Local Centro", onHand: 8, reserved: 0 },
      { id: "rem-m-negro-local", color: "Negro", size: "M", location: "Local Centro", onHand: 7, reserved: 0 },
      { id: "rem-l-verde-local", color: "Verde oliva", size: "L", location: "Local Centro", onHand: 2, reserved: 0 },
      { id: "rem-xl-negro-depo", color: "Negro", size: "XL", location: "Depósito", onHand: 9, reserved: 0 },
      { id: "rem-m-blanco-feria", color: "Blanco", size: "M", location: "Feria", onHand: 4, reserved: 0 },
    ],
  },
  {
    id: "biker-seamless",
    name: "Biker Seamless",
    code: "BIK-007",
    category: "Calzas",
    price: 12000,
    variants: [
      { id: "bik-s-negro-local", color: "Negro", size: "S", location: "Local Centro", onHand: 3, reserved: 0 },
      { id: "bik-m-negro-local", color: "Negro", size: "M", location: "Local Centro", onHand: 5, reserved: 0 },
      { id: "bik-l-taupe-local", color: "Taupe", size: "L", location: "Local Centro", onHand: 0, reserved: 0 },
      { id: "bik-m-lila-depo", color: "Lila", size: "M", location: "Depósito", onHand: 4, reserved: 0 },
    ],
  },
  {
    id: "conjunto-rib",
    name: "Conjunto Rib",
    code: "CON-021",
    category: "Conjuntos",
    price: 24500,
    variants: [
      { id: "con-s-choco-local", color: "Chocolate", size: "S", location: "Local Centro", onHand: 2, reserved: 0 },
      { id: "con-m-choco-local", color: "Chocolate", size: "M", location: "Local Centro", onHand: 1, reserved: 0 },
      { id: "con-l-negro-depo", color: "Negro", size: "L", location: "Depósito", onHand: 3, reserved: 0 },
    ],
  },
];

const initialReservations: Reservation[] = [
  {
    id: "RES-1048",
    customer: "Carla Gómez",
    productId: "palazzo",
    variantId: "pal-s-crema-local",
    quantity: 1,
    expiresAt: "18:40",
    status: "Activa",
  },
];

const initialMovements: Movement[] = [
  { id: "MOV-301", type: "Ingreso", detail: "Remera Basic · Negro · M · Local Centro", quantity: 6, date: "Hoy, 10:24", user: "Mariana" },
  { id: "MOV-300", type: "Venta", detail: "Palazzo de verano · Negro · S · Local Centro", quantity: -1, date: "Hoy, 09:52", user: "Sofía" },
  { id: "MOV-299", type: "Reserva", detail: "Palazzo de verano · Crema · S · Local Centro", quantity: -1, date: "Hoy, 09:31", user: "Mariana" },
];

const navItems: { view: View; label: string; symbol: string }[] = [
  { view: "home", label: "Inicio", symbol: "⌂" },
  { view: "sale", label: "Vender", symbol: "+" },
  { view: "stock", label: "Stock", symbol: "⌕" },
  { view: "reservations", label: "Reservas", symbol: "◷" },
  { view: "orders", label: "Pedidos", symbol: "□" },
  { view: "intake", label: "Ingresos", symbol: "↓" },
  { view: "products", label: "Productos", symbol: "◇" },
  { view: "movements", label: "Movimientos", symbol: "↔" },
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [location, setLocation] = useState("Local Centro");
  const [search, setSearch] = useState("");
  const [saleProductId, setSaleProductId] = useState(initialProducts[0].id);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Transferencia");
  const [stockProductId, setStockProductId] = useState(initialProducts[0].id);
  const [messageSize, setMessageSize] = useState("S");
  const [includePrice, setIncludePrice] = useState(true);
  const [showQuantities, setShowQuantities] = useState(false);
  const [intakeProductId, setIntakeProductId] = useState(initialProducts[0].id);
  const [intakeValues, setIntakeValues] = useState<Record<string, number>>({});
  const [toast, setToast] = useState("");

  const activeReservations = reservations.filter((item) => item.status === "Activa");
  const totalAvailable = products.reduce(
    (sum, product) =>
      sum +
      product.variants.reduce(
        (variantSum, variant) => variantSum + Math.max(0, variant.onHand - variant.reserved),
        0,
      ),
    0,
  );
  const lowStockCount = products.reduce(
    (sum, product) =>
      sum +
      product.variants.filter(
        (variant) => variant.location === location && variant.onHand - variant.reserved <= 2,
      ).length,
    0,
  );

  const currentSaleProduct = products.find((product) => product.id === saleProductId) ?? products[0];
  const currentStockProduct = products.find((product) => product.id === stockProductId) ?? products[0];
  const currentIntakeProduct = products.find((product) => product.id === intakeProductId) ?? products[0];

  const cartDetails = cart.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    return product && variant ? [{ ...item, product, variant }] : [];
  });
  const cartTotal = cartDetails.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("es");
    return products.filter(
      (product) =>
        !normalized ||
        product.name.toLocaleLowerCase("es").includes(normalized) ||
        product.code.toLocaleLowerCase("es").includes(normalized),
    );
  }, [products, search]);

  const messageVariants = currentStockProduct.variants.filter(
    (variant) =>
      variant.location === location &&
      variant.size === messageSize &&
      variant.onHand - variant.reserved > 0,
  );
  const stockMessage = `${currentStockProduct.name}\nTalle ${messageSize}: ${
    messageVariants.length
      ? messageVariants
          .map((variant) =>
            showQuantities
              ? `${variant.color} (${variant.onHand - variant.reserved})`
              : variant.color.toLocaleLowerCase("es"),
          )
          .join(", ")
      : "sin stock disponible"
  }${includePrice ? `\nPrecio mayorista: ${formatMoney(currentStockProduct.price)}` : ""}`;

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function updateVariant(productId: string, variantId: string, changes: Partial<Variant>) {
    setProducts((current) =>
      current.map((product) =>
        product.id !== productId
          ? product
          : {
              ...product,
              variants: product.variants.map((variant) =>
                variant.id === variantId ? { ...variant, ...changes } : variant,
              ),
            },
      ),
    );
  }

  function addToCart(variantId: string) {
    const variant = currentSaleProduct.variants.find((entry) => entry.id === variantId);
    if (!variant || variant.onHand - variant.reserved <= 0) {
      showToast("Esa variante ya no tiene stock disponible");
      return;
    }
    updateVariant(currentSaleProduct.id, variant.id, { reserved: variant.reserved + 1 });
    setCart((current) => {
      const existing = current.find(
        (item) => item.productId === currentSaleProduct.id && item.variantId === variant.id,
      );
      return existing
        ? current.map((item) =>
            item === existing ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...current, { productId: currentSaleProduct.id, variantId: variant.id, quantity: 1 }];
    });
    showToast("Unidad reservada por 15 minutos");
  }

  function removeFromCart(item: CartItem) {
    const product = products.find((entry) => entry.id === item.productId);
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    if (variant) {
      updateVariant(item.productId, item.variantId, {
        reserved: Math.max(0, variant.reserved - 1),
      });
    }
    setCart((current) =>
      current.flatMap((entry) => {
        if (entry.productId !== item.productId || entry.variantId !== item.variantId) return [entry];
        return entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : [];
      }),
    );
  }

  function confirmSale() {
    if (!cartDetails.length) return;
    const accepted = window.confirm(
      `¿Confirmar la venta por ${formatMoney(cartTotal)}? El stock se descontará ahora.`,
    );
    if (!accepted) return;

    const now = new Date();
    const newMovements: Movement[] = cartDetails.map((item, index) => ({
      id: `MOV-${400 + movements.length + index}`,
      type: "Venta",
      detail: `${item.product.name} · ${item.variant.color} · ${item.variant.size} · ${item.variant.location}`,
      quantity: -item.quantity,
      date: `Hoy, ${now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
      user: "Mariana",
    }));

    setProducts((current) =>
      current.map((product) => ({
        ...product,
        variants: product.variants.map((variant) => {
          const item = cart.find(
            (entry) => entry.productId === product.id && entry.variantId === variant.id,
          );
          return item
            ? {
                ...variant,
                onHand: variant.onHand - item.quantity,
                reserved: Math.max(0, variant.reserved - item.quantity),
              }
            : variant;
        }),
      })),
    );
    setMovements((current) => [...newMovements, ...current]);
    setCart([]);
    setCustomer("");
    setView("home");
    showToast("Venta registrada correctamente");
  }

  function cancelReservation(reservation: Reservation) {
    if (!window.confirm(`¿Cancelar la reserva ${reservation.id}? La unidad volverá a estar disponible.`)) return;
    const product = products.find((entry) => entry.id === reservation.productId);
    const variant = product?.variants.find((entry) => entry.id === reservation.variantId);
    if (variant) {
      updateVariant(reservation.productId, reservation.variantId, {
        reserved: Math.max(0, variant.reserved - reservation.quantity),
      });
    }
    setReservations((current) =>
      current.map((entry) =>
        entry.id === reservation.id ? { ...entry, status: "Cancelada" } : entry,
      ),
    );
    showToast("Reserva cancelada");
  }

  function confirmIntake() {
    const entries = Object.entries(intakeValues).filter(([, value]) => Number(value) > 0);
    if (!entries.length) {
      showToast("Ingresá al menos una cantidad");
      return;
    }
    const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
    if (!window.confirm(`¿Confirmar el ingreso de ${total} unidades en ${location}?`)) return;

    const now = new Date();
    const newMovements: Movement[] = [];
    setProducts((current) =>
      current.map((product) =>
        product.id !== currentIntakeProduct.id
          ? product
          : {
              ...product,
              variants: product.variants.map((variant) => {
                const quantity = Number(intakeValues[variant.id] ?? 0);
                if (!quantity) return variant;
                newMovements.push({
                  id: `MOV-IN-${variant.id}-${now.getTime()}`,
                  type: "Ingreso",
                  detail: `${product.name} · ${variant.color} · ${variant.size} · ${variant.location}`,
                  quantity,
                  date: `Hoy, ${now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
                  user: "Mariana",
                });
                return { ...variant, onHand: variant.onHand + quantity };
              }),
            },
      ),
    );
    setMovements((current) => [...newMovements, ...current]);
    setIntakeValues({});
    showToast("Mercadería ingresada correctamente");
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(stockMessage);
      showToast("Mensaje copiado");
    } catch {
      showToast("Seleccioná el texto y copiá manualmente");
    }
  }

  function navigate(nextView: View) {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="appShell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")} aria-label="Ir al inicio">
          <span className="brandMark">IF</span>
          <span>
            <strong>Indumentaria Fit</strong>
            <small>Control interno</small>
          </span>
        </button>
        <div className="topbarActions">
          <label className="locationPicker">
            <span>Ubicación</span>
            <select value={location} onChange={(event) => setLocation(event.target.value)}>
              {locations.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </select>
          </label>
          <div className="userAvatar" aria-label="Usuario Mariana">MA</div>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="Navegación principal">
          <div className="statusLine"><span /> Sistema actualizado</div>
          <nav>
            {navItems.map((item) => (
              <button
                key={item.view}
                className={view === item.view ? "active" : ""}
                onClick={() => navigate(item.view)}
              >
                <span aria-hidden="true">{item.symbol}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="sidebarNote">
            <strong>Versión inicial</strong>
            <p>Los datos de esta pantalla son de prueba.</p>
          </div>
        </aside>

        <main className="mainContent">
          {view === "home" && (
            <section className="pageSection">
              <div className="pageHeading homeHeading">
                <div>
                  <p className="eyebrow">Lunes 10 de agosto</p>
                  <h1>Hola, Mariana</h1>
                  <p>¿Qué querés hacer ahora?</p>
                </div>
                <div className="onlineBadge"><span /> En línea</div>
              </div>

              <div className="quickActions">
                {[
                  { view: "sale" as View, title: "Registrar venta", detail: "Reserva el stock mientras vendés", symbol: "+", primary: true },
                  { view: "stock" as View, title: "Consultar stock", detail: "Buscá por talle, color y ubicación", symbol: "⌕" },
                  { view: "orders" as View, title: "Pedidos", detail: "Encargos y señas de clientes", symbol: "□" },
                  { view: "intake" as View, title: "Ingresar mercadería", detail: "Cargá cantidades por variante", symbol: "↓" },
                  { view: "reservations" as View, title: "Reservas", detail: `${activeReservations.length} activa${activeReservations.length === 1 ? "" : "s"}`, symbol: "◷" },
                  { view: "movements" as View, title: "Movimientos", detail: "Revisá todo lo que cambió", symbol: "↔" },
                ].map((action) => (
                  <button
                    key={action.view}
                    className={`actionCard ${action.primary ? "primary" : ""}`}
                    onClick={() => navigate(action.view)}
                  >
                    <span className="actionSymbol" aria-hidden="true">{action.symbol}</span>
                    <span>
                      <strong>{action.title}</strong>
                      <small>{action.detail}</small>
                    </span>
                    <span className="actionArrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>

              <div className="summaryStrip">
                <div><span>Unidades disponibles</span><strong>{totalAvailable}</strong></div>
                <div><span>Reservas activas</span><strong>{activeReservations.length}</strong></div>
                <div><span>Stock bajo en {location}</span><strong>{lowStockCount}</strong></div>
              </div>
            </section>
          )}

          {view === "sale" && (
            <section className="pageSection">
              <div className="pageHeading">
                <div><p className="eyebrow">Venta inmediata</p><h1>Registrar venta</h1><p>Elegí un producto y agregá las variantes.</p></div>
                {cartDetails.length > 0 && <span className="countBadge">{cartDetails.reduce((sum, item) => sum + item.quantity, 0)} unidades</span>}
              </div>

              <div className="saleLayout">
                <div>
                  <label className="fieldLabel" htmlFor="sale-product">Producto</label>
                  <select id="sale-product" className="largeSelect" value={saleProductId} onChange={(event) => setSaleProductId(event.target.value)}>
                    {products.map((product) => <option value={product.id} key={product.id}>{product.name} · {formatMoney(product.price)}</option>)}
                  </select>

                  <div className="variantList">
                    {currentSaleProduct.variants.filter((variant) => variant.location === location).map((variant) => {
                      const available = variant.onHand - variant.reserved;
                      return (
                        <article className="variantRow" key={variant.id}>
                          <div className="colorDot" data-color={variant.color} aria-hidden="true" />
                          <div className="variantName"><strong>{variant.color}</strong><span>Talle {variant.size}</span></div>
                          <div className={`availability ${available <= 1 ? "low" : ""}`}><strong>{available}</strong><span>disponibles</span></div>
                          <button className="addButton" disabled={available <= 0} onClick={() => addToCart(variant.id)}>{available > 0 ? "Agregar" : "Agotado"}</button>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <aside className="checkoutCard">
                  <div className="checkoutHeader"><h2>Venta en curso</h2><span>Reserva 15 min</span></div>
                  {cartDetails.length === 0 ? (
                    <div className="emptyState compact"><span>＋</span><p>Todavía no agregaste productos.</p></div>
                  ) : (
                    <div className="cartList">
                      {cartDetails.map((item) => (
                        <div className="cartItem" key={`${item.productId}-${item.variantId}`}>
                          <div><strong>{item.product.name}</strong><span>{item.variant.color} · {item.variant.size}</span></div>
                          <div className="cartQuantity"><span>{item.quantity}</span><button onClick={() => removeFromCart(item)} aria-label={`Quitar una unidad de ${item.product.name}`}>−</button></div>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="fieldLabel" htmlFor="customer">Cliente <span>opcional</span></label>
                  <input id="customer" className="textInput" value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Nombre o teléfono" />
                  <label className="fieldLabel" htmlFor="payment">Forma de pago</label>
                  <select id="payment" className="largeSelect" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                    <option>Transferencia</option><option>Efectivo</option><option>Tarjeta</option><option>Seña</option>
                  </select>
                  <div className="checkoutTotal"><span>Total</span><strong>{formatMoney(cartTotal)}</strong></div>
                  <button className="primaryButton" disabled={!cartDetails.length} onClick={confirmSale}>Revisar y confirmar</button>
                </aside>
              </div>
            </section>
          )}

          {view === "stock" && (
            <section className="pageSection">
              <div className="pageHeading"><div><p className="eyebrow">Disponibilidad</p><h1>Consultar stock</h1><p>Buscá productos y armá un mensaje para compartir.</p></div></div>
              <div className="searchBar"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o código" aria-label="Buscar producto" /></div>
              <div className="stockLayout">
                <div className="productResults">
                  {filteredProducts.map((product) => {
                    const variants = product.variants.filter((variant) => variant.location === location);
                    const available = variants.reduce((sum, variant) => sum + Math.max(0, variant.onHand - variant.reserved), 0);
                    const reserved = variants.reduce((sum, variant) => sum + variant.reserved, 0);
                    return (
                      <button className={`productResult ${stockProductId === product.id ? "selected" : ""}`} key={product.id} onClick={() => setStockProductId(product.id)}>
                        <span className="productInitial">{product.name.slice(0, 2).toUpperCase()}</span>
                        <span className="productResultName"><strong>{product.name}</strong><small>{product.code} · {variants.length} variantes</small></span>
                        <span className="productStock"><strong>{available}</strong><small>disponibles</small>{reserved > 0 && <em>{reserved} reservado</em>}</span>
                      </button>
                    );
                  })}
                </div>

                <aside className="messageCard">
                  <div><p className="eyebrow">Mensaje rápido</p><h2>{currentStockProduct.name}</h2></div>
                  <div className="inlineFields">
                    <label>Talle<select value={messageSize} onChange={(event) => setMessageSize(event.target.value)}>{[...new Set(currentStockProduct.variants.map((variant) => variant.size))].map((size) => <option key={size}>{size}</option>)}</select></label>
                  </div>
                  <label className="checkRow"><input type="checkbox" checked={includePrice} onChange={(event) => setIncludePrice(event.target.checked)} /><span>Incluir precio</span></label>
                  <label className="checkRow"><input type="checkbox" checked={showQuantities} onChange={(event) => setShowQuantities(event.target.checked)} /><span>Mostrar cantidades</span></label>
                  <textarea className="messagePreview" readOnly value={stockMessage} aria-label="Vista previa del mensaje" />
                  <button className="primaryButton" onClick={copyMessage}>Copiar mensaje</button>
                </aside>
              </div>
            </section>
          )}

          {view === "intake" && (
            <section className="pageSection">
              <div className="pageHeading"><div><p className="eyebrow">Stock</p><h1>Ingresar mercadería</h1><p>Cargá las cantidades que llegaron a {location}.</p></div></div>
              <div className="formCard">
                <label className="fieldLabel" htmlFor="intake-product">Producto</label>
                <select id="intake-product" className="largeSelect" value={intakeProductId} onChange={(event) => { setIntakeProductId(event.target.value); setIntakeValues({}); }}>
                  {products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
                </select>
                <div className="intakeGrid">
                  <div className="intakeGridHead"><span>Color y talle</span><span>Cantidad recibida</span></div>
                  {currentIntakeProduct.variants.filter((variant) => variant.location === location).map((variant) => (
                    <label className="intakeRow" key={variant.id}>
                      <span><strong>{variant.color}</strong><small>Talle {variant.size} · Actual: {variant.onHand}</small></span>
                      <input type="number" min="0" inputMode="numeric" value={intakeValues[variant.id] ?? ""} onChange={(event) => setIntakeValues((current) => ({ ...current, [variant.id]: Math.max(0, Number(event.target.value)) }))} placeholder="0" aria-label={`Cantidad de ${variant.color} talle ${variant.size}`} />
                    </label>
                  ))}
                </div>
                <div className="formFooter"><span>Total a ingresar: <strong>{Object.values(intakeValues).reduce((sum, value) => sum + Number(value || 0), 0)}</strong></span><button className="primaryButton fit" onClick={confirmIntake}>Revisar y confirmar</button></div>
              </div>
            </section>
          )}

          {view === "reservations" && (
            <section className="pageSection">
              <div className="pageHeading"><div><p className="eyebrow">Stock separado</p><h1>Reservas</h1><p>Se liberan cuando vencen o se cancelan.</p></div><button className="primaryButton fit" onClick={() => navigate("sale")}>Nueva reserva</button></div>
              <div className="reservationList">
                {activeReservations.length === 0 ? <div className="emptyState"><span>✓</span><h2>No hay reservas activas</h2><p>Todo el stock está disponible para vender.</p></div> : activeReservations.map((reservation) => {
                  const product = products.find((entry) => entry.id === reservation.productId);
                  const variant = product?.variants.find((entry) => entry.id === reservation.variantId);
                  return (
                    <article className="reservationCard" key={reservation.id}>
                      <div><span className="reservationId">{reservation.id}</span><h2>{reservation.customer}</h2><p>{product?.name} · {variant?.color} · Talle {variant?.size}</p></div>
                      <div className="reservationMeta"><span>Vence hoy</span><strong>{reservation.expiresAt}</strong></div>
                      <div className="reservationActions"><button className="secondaryButton danger" onClick={() => cancelReservation(reservation)}>Cancelar</button><button className="primaryButton fit" onClick={() => navigate("sale")}>Vender</button></div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {view === "orders" && (
            <section className="pageSection">
              <div className="pageHeading"><div><p className="eyebrow">Por encargo</p><h1>Pedidos</h1><p>Esta será la próxima parte que vamos a definir juntos.</p></div></div>
              <div className="comingSoon">
                <span className="comingIcon">□</span>
                <div><h2>Base preparada para pedidos</h2><p>Acá vamos a registrar productos encargados, precios congelados, señas y el estado de entrega sin tocar el stock hasta que la mercadería ingrese.</p></div>
                <span className="nextTag">Siguiente etapa</span>
              </div>
            </section>
          )}

          {view === "products" && (
            <section className="pageSection">
              <div className="pageHeading"><div><p className="eyebrow">Catálogo</p><h1>Productos</h1><p>Productos, códigos, precios y variantes.</p></div><button className="primaryButton fit" onClick={() => showToast("El alta de productos se agregará en la próxima etapa")}>Nuevo producto</button></div>
              <div className="catalogGrid">
                {products.map((product) => {
                  const total = product.variants.reduce((sum, variant) => sum + variant.onHand, 0);
                  return <article className="catalogCard" key={product.id}><div className="catalogVisual">{product.name.slice(0, 2).toUpperCase()}</div><div className="catalogBody"><span>{product.category}</span><h2>{product.name}</h2><p>{product.code} · {product.variants.length} variantes</p><div><strong>{formatMoney(product.price)}</strong><small>{total} unidades totales</small></div></div></article>;
                })}
              </div>
            </section>
          )}

          {view === "movements" && (
            <section className="pageSection">
              <div className="pageHeading"><div><p className="eyebrow">Historial</p><h1>Movimientos</h1><p>Cada cambio queda registrado.</p></div></div>
              <div className="movementList">
                {movements.map((movement) => <article className="movementRow" key={movement.id}><span className={`movementType ${movement.type.toLowerCase()}`}>{movement.type}</span><div><strong>{movement.detail}</strong><small>{movement.date} · {movement.user}</small></div><strong className={movement.quantity > 0 ? "positive" : "negative"}>{movement.quantity > 0 ? "+" : ""}{movement.quantity}</strong></article>)}
              </div>
            </section>
          )}
        </main>
      </div>

      <nav className="mobileNav" aria-label="Navegación móvil">
        {navItems.slice(0, 5).map((item) => (
          <button key={item.view} className={view === item.view ? "active" : ""} onClick={() => navigate(item.view)}><span aria-hidden="true">{item.symbol}</span>{item.label}</button>
        ))}
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
