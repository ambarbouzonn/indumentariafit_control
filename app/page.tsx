"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase/client";

type View =
  | "home"
  | "sale"
  | "stock"
  | "intake"
  | "transfers"
  | "reservations"
  | "orders"
  | "products"
  | "movements";

type Variant = {
  id: string;
  stockId?: string;
  variantId?: string;
  locationId?: string;
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

type ProductForm = {
  id: string | null;
  name: string;
  code: string;
  category: string;
  price: string;
  colors: string;
  sizes: string;
};

const emptyProductForm: ProductForm = {
  id: null,
  name: "",
  code: "",
  category: "",
  price: "",
  colors: "",
  sizes: "S, M, L",
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
  { view: "transfers", label: "Transferencias", symbol: "⇄" },
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
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [profileName, setProfileName] = useState("Usuario");
  const [profileRole, setProfileRole] = useState("seller");
  const [dataLoading, setDataLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState("");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [view, setView] = useState<View>("home");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [location, setLocation] = useState("Local Centro");
  const [search, setSearch] = useState("");
  const [saleProductId, setSaleProductId] = useState(initialProducts[0].id);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Transferencia");
  const [stockProductId, setStockProductId] = useState(initialProducts[0].id);
  const [messageSize, setMessageSize] = useState("S");
  const [includePrice, setIncludePrice] = useState(true);
  const [showQuantities, setShowQuantities] = useState(false);
  const [showStockMessage, setShowStockMessage] = useState(false);
  const [intakeProductId, setIntakeProductId] = useState(initialProducts[0].id);
  const [intakeValues, setIntakeValues] = useState<Record<string, number>>({});
  const [transferProductId, setTransferProductId] = useState(initialProducts[0].id);
  const [transferOrigin, setTransferOrigin] = useState("Depósito");
  const [transferDestination, setTransferDestination] = useState("Local Centro");
  const [transferStockId, setTransferStockId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [productForm, setProductForm] = useState<ProductForm | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [toast, setToast] = useState("");

  const loadData = useCallback(async () => {
    setDataLoading(true);
    setDatabaseError("");

    const [stockResult, reservationResult, movementResult, profileResult] = await Promise.all([
      supabase
        .from("stock_by_location")
        .select("id, on_hand, reserved, variant_id, location_id, locations(name), variants(id, products(id, name, code, price, categories(name)), colors(name), sizes(name))")
        .order("updated_at", { ascending: false }),
      supabase
        .from("reservations")
        .select("id, customer_name, expires_at, status, reservation_items(quantity, stock_by_location(id, variants(products(id, name), colors(name), sizes(name)), locations(name)))")
        .eq("status", "active")
        .order("expires_at", { ascending: true }),
      supabase
        .from("inventory_movements")
        .select("id, movement_type, quantity, reason, created_at, profiles(full_name), variants(products(name), colors(name), sizes(name)), locations(name)")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("profiles").select("full_name, role").single(),
    ]);

    const firstError = stockResult.error ?? reservationResult.error ?? movementResult.error ?? profileResult.error;
    if (firstError) {
      setDatabaseError(
        firstError.message.includes("does not exist") || firstError.code === "PGRST205"
          ? "La conexión funciona, pero todavía falta ejecutar el archivo de preparación de la base."
          : firstError.message,
      );
      setDataLoading(false);
      return;
    }

    const groupedProducts = new Map<string, Product>();
    for (const rawRow of (stockResult.data ?? []) as unknown as Array<Record<string, any>>) {
      const variantRelation = Array.isArray(rawRow.variants) ? rawRow.variants[0] : rawRow.variants;
      const productRelation = Array.isArray(variantRelation?.products) ? variantRelation.products[0] : variantRelation?.products;
      const colorRelation = Array.isArray(variantRelation?.colors) ? variantRelation.colors[0] : variantRelation?.colors;
      const sizeRelation = Array.isArray(variantRelation?.sizes) ? variantRelation.sizes[0] : variantRelation?.sizes;
      const locationRelation = Array.isArray(rawRow.locations) ? rawRow.locations[0] : rawRow.locations;
      const categoryRelation = Array.isArray(productRelation?.categories) ? productRelation.categories[0] : productRelation?.categories;
      if (!productRelation || !variantRelation || !locationRelation) continue;
      if (!groupedProducts.has(productRelation.id)) {
        groupedProducts.set(productRelation.id, {
          id: productRelation.id,
          name: productRelation.name,
          code: productRelation.code,
          category: categoryRelation?.name ?? "Sin categoría",
          price: Number(productRelation.price),
          variants: [],
        });
      }
      groupedProducts.get(productRelation.id)?.variants.push({
        id: rawRow.id,
        stockId: rawRow.id,
        variantId: variantRelation.id,
        locationId: rawRow.location_id,
        color: colorRelation?.name ?? "Sin color",
        size: sizeRelation?.name ?? "Único",
        location: locationRelation.name,
        onHand: Number(rawRow.on_hand),
        reserved: Number(rawRow.reserved),
      });
    }
    const loadedProducts = Array.from(groupedProducts.values());
    if (loadedProducts.length) {
      setProducts(loadedProducts);
      setSaleProductId((current) => loadedProducts.some((product) => product.id === current) ? current : loadedProducts[0].id);
      setStockProductId((current) => loadedProducts.some((product) => product.id === current) ? current : loadedProducts[0].id);
      setIntakeProductId((current) => loadedProducts.some((product) => product.id === current) ? current : loadedProducts[0].id);
    }

    const loadedReservations: Reservation[] = [];
    for (const rawReservation of (reservationResult.data ?? []) as unknown as Array<Record<string, any>>) {
      for (const rawItem of rawReservation.reservation_items ?? []) {
        const stockRelation = Array.isArray(rawItem.stock_by_location) ? rawItem.stock_by_location[0] : rawItem.stock_by_location;
        const variantRelation = Array.isArray(stockRelation?.variants) ? stockRelation.variants[0] : stockRelation?.variants;
        const productRelation = Array.isArray(variantRelation?.products) ? variantRelation.products[0] : variantRelation?.products;
        const locationRelation = Array.isArray(stockRelation?.locations) ? stockRelation.locations[0] : stockRelation?.locations;
        loadedReservations.push({
          id: rawReservation.id,
          customer: rawReservation.customer_name || "Sin cliente",
          productId: productRelation?.id ?? "",
          variantId: stockRelation?.id ?? "",
          quantity: Number(rawItem.quantity),
          expiresAt: new Date(rawReservation.expires_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
          status: "Activa",
        });
        if (!locationRelation) continue;
      }
    }
    setReservations(loadedReservations);

    const loadedMovements: Movement[] = ((movementResult.data ?? []) as unknown as Array<Record<string, any>>).map((rawMovement) => {
      const variantRelation = Array.isArray(rawMovement.variants) ? rawMovement.variants[0] : rawMovement.variants;
      const productRelation = Array.isArray(variantRelation?.products) ? variantRelation.products[0] : variantRelation?.products;
      const colorRelation = Array.isArray(variantRelation?.colors) ? variantRelation.colors[0] : variantRelation?.colors;
      const sizeRelation = Array.isArray(variantRelation?.sizes) ? variantRelation.sizes[0] : variantRelation?.sizes;
      const locationRelation = Array.isArray(rawMovement.locations) ? rawMovement.locations[0] : rawMovement.locations;
      const profileRelation = Array.isArray(rawMovement.profiles) ? rawMovement.profiles[0] : rawMovement.profiles;
      return {
        id: rawMovement.id,
        type: rawMovement.movement_type === "sale" ? "Venta" : rawMovement.movement_type === "intake" ? "Ingreso" : rawMovement.movement_type.startsWith("transfer_") ? "Transferencia" : rawMovement.movement_type,
        detail: `${productRelation?.name ?? "Producto"} · ${colorRelation?.name ?? ""} · ${sizeRelation?.name ?? ""} · ${locationRelation?.name ?? ""}`,
        quantity: Number(rawMovement.quantity),
        date: new Date(rawMovement.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
        user: profileRelation?.full_name ?? "Usuario",
      };
    });
    setMovements(loadedMovements);
    setProfileName(profileResult.data?.full_name || session?.user.email?.split("@")[0] || "Usuario");
    setProfileRole(profileResult.data?.role || "seller");
    setDataLoading(false);
  }, [session?.user.email, supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session) return;
    void supabase.rpc("release_expired_reservations").then(() => loadData());
    const channel = supabase
      .channel("inventory-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_by_location" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_movements" }, () => void loadData())
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));
    return () => { void supabase.removeChannel(channel); };
  }, [loadData, session, supabase]);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
        options: { data: { full_name: authName.trim() } },
      });
      setAuthLoading(false);
      if (error) {
        setAuthError(error.message);
        return;
      }
      if (!data.session) {
        setAuthError("Cuenta creada. Revisá tu correo para confirmar y después iniciá sesión.");
        setAuthMode("signin");
      }
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });
    setAuthLoading(false);
    if (error) setAuthError("No pudimos ingresar. Revisá el correo y la contraseña.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setCart([]);
    setReservationId(null);
    setRealtimeConnected(false);
  }

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
  const currentTransferProduct = products.find((product) => product.id === transferProductId) ?? products[0];
  const transferOriginVariants = currentTransferProduct.variants.filter((variant) => variant.location === transferOrigin);
  const selectedTransferVariant = transferOriginVariants.find((variant) => variant.stockId === transferStockId);
  const stockLocationVariants = currentStockProduct.variants.filter((variant) => variant.location === location);
  const stockColors = [...new Set(stockLocationVariants.map((variant) => variant.color))];
  const stockSizes = [...new Set(stockLocationVariants.map((variant) => variant.size))];
  const stockOnHand = stockLocationVariants.reduce((sum, variant) => sum + variant.onHand, 0);
  const stockReserved = stockLocationVariants.reduce((sum, variant) => sum + variant.reserved, 0);
  const stockAvailable = stockOnHand - stockReserved;
  const intakeLocationVariants = currentIntakeProduct.variants.filter((variant) => variant.location === location);
  const intakeColors = [...new Set(intakeLocationVariants.map((variant) => variant.color))];
  const intakeSizes = [...new Set(intakeLocationVariants.map((variant) => variant.size))];

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

  async function addToCart(variantId: string) {
    const variant = currentSaleProduct.variants.find((entry) => entry.id === variantId);
    if (!variant || variant.onHand - variant.reserved <= 0) {
      showToast("Esa variante ya no tiene stock disponible");
      return;
    }
    if (variant.stockId) {
      const { data, error } = await supabase.rpc("reserve_stock", {
        p_reservation_id: reservationId,
        p_stock_id: variant.stockId,
        p_quantity: 1,
        p_customer_name: customer || null,
      });
      if (error) {
        showToast(error.message.includes("Stock insuficiente") ? "Esa variante ya no tiene stock disponible" : error.message);
        await loadData();
        return;
      }
      setReservationId(data as string);
    } else {
      updateVariant(currentSaleProduct.id, variant.id, { reserved: variant.reserved + 1 });
    }
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
    if (variant.stockId) await loadData();
    showToast("Unidad reservada por 15 minutos");
  }

  async function removeFromCart(item: CartItem) {
    const product = products.find((entry) => entry.id === item.productId);
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    if (variant?.stockId && reservationId) {
      const { error } = await supabase.rpc("release_reserved_stock", {
        p_reservation_id: reservationId,
        p_stock_id: variant.stockId,
        p_quantity: 1,
      });
      if (error) {
        showToast(error.message);
        return;
      }
    } else if (variant) {
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
    if (variant?.stockId) await loadData();
  }

  async function confirmSale() {
    if (!cartDetails.length) return;
    const accepted = window.confirm(
      `¿Confirmar la venta por ${formatMoney(cartTotal)}? El stock se descontará ahora.`,
    );
    if (!accepted) return;

    if (reservationId) {
      const { error } = await supabase.rpc("confirm_reserved_sale", {
        p_reservation_id: reservationId,
        p_customer_name: customer || null,
        p_payment_method: paymentMethod,
      });
      if (error) {
        showToast(error.message);
        await loadData();
        return;
      }
      setCart([]);
      setReservationId(null);
      setCustomer("");
      await loadData();
      setView("home");
      showToast("Venta registrada correctamente");
      return;
    }

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

  async function cancelReservation(reservation: Reservation) {
    if (!window.confirm(`¿Cancelar la reserva ${reservation.id}? La unidad volverá a estar disponible.`)) return;
    if (reservation.id.length > 20) {
      const { error } = await supabase.rpc("cancel_reservation", { p_reservation_id: reservation.id });
      if (error) {
        showToast(error.message);
        return;
      }
      await loadData();
      showToast("Reserva cancelada");
      return;
    }
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

  async function confirmIntake() {
    if (profileRole !== "admin" && profileRole !== "manager") {
      showToast("Solo una administradora o encargada puede ingresar mercadería");
      return;
    }
    const entries = Object.entries(intakeValues).filter(([, value]) => Number(value) > 0);
    if (!entries.length) {
      showToast("Ingresá al menos una cantidad");
      return;
    }
    const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
    const lineSummary = entries.slice(0, 5).map(([variantId, quantity]) => {
      const variant = intakeLocationVariants.find((entry) => entry.id === variantId);
      return `${variant?.color ?? "Variante"} · ${variant?.size ?? ""}: ${quantity}`;
    }).join("\n");
    const remaining = Math.max(0, entries.length - 5);
    if (!window.confirm(`¿Confirmar el ingreso de ${total} unidades en ${location}?\n\n${lineSummary}${remaining ? `\n…y ${remaining} variantes más` : ""}`)) return;

    const databaseLines = entries.flatMap(([variantId, quantity]) => {
      const variant = currentIntakeProduct.variants.find((entry) => entry.id === variantId);
      return variant?.stockId ? [{ stock_id: variant.stockId, quantity: Number(quantity) }] : [];
    });
    if (databaseLines.length) {
      const { error } = await supabase.rpc("record_inventory_intake", {
        p_lines: databaseLines,
        p_reason: "Ingreso de mercadería",
      });
      if (error) {
        showToast(error.message);
        return;
      }
      setIntakeValues({});
      await loadData();
      showToast("Mercadería ingresada correctamente");
      return;
    }

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

  async function confirmTransfer() {
    if (profileRole !== "admin" && profileRole !== "manager") {
      showToast("Solo una administradora o encargada puede transferir mercadería");
      return;
    }
    if (!selectedTransferVariant?.stockId || !selectedTransferVariant.variantId) {
      showToast("Elegí un color y talle");
      return;
    }
    if (transferOrigin === transferDestination) {
      showToast("El origen y el destino deben ser diferentes");
      return;
    }
    const available = selectedTransferVariant.onHand - selectedTransferVariant.reserved;
    if (transferQuantity < 1 || transferQuantity > available) {
      showToast(`Podés transferir entre 1 y ${available} unidades`);
      return;
    }
    const destinationLocationId = products.flatMap((product) => product.variants).find((variant) => variant.location === transferDestination)?.locationId;
    if (!destinationLocationId) {
      showToast("No encontramos la ubicación de destino");
      return;
    }
    if (!window.confirm(`¿Transferir ${transferQuantity} unidad${transferQuantity === 1 ? "" : "es"}?\n\n${currentTransferProduct.name}\n${selectedTransferVariant.color} · Talle ${selectedTransferVariant.size}\n${transferOrigin} → ${transferDestination}`)) return;
    const { error } = await supabase.rpc("transfer_inventory", {
      p_source_stock_id: selectedTransferVariant.stockId,
      p_destination_location_id: destinationLocationId,
      p_quantity: transferQuantity,
    });
    if (error) {
      showToast(error.message.includes("transfer_inventory") ? "Falta ejecutar la actualización SQL de Transferencias" : error.message);
      return;
    }
    setTransferStockId("");
    setTransferQuantity(1);
    await loadData();
    showToast("Transferencia registrada correctamente");
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(stockMessage);
      showToast("Mensaje copiado");
    } catch {
      showToast("Seleccioná el texto y copiá manualmente");
    }
  }

  function openProductForm(product?: Product) {
    if (profileRole !== "admin" && profileRole !== "manager") {
      showToast("Solo una administradora o encargada puede modificar productos");
      return;
    }
    setProductForm(product ? {
      id: product.id,
      name: product.name,
      code: product.code,
      category: product.category,
      price: String(product.price),
      colors: [...new Set(product.variants.map((variant) => variant.color))].join(", "),
      sizes: [...new Set(product.variants.map((variant) => variant.size))].join(", "),
    } : { ...emptyProductForm });
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productForm) return;
    const colors = productForm.colors.split(",").map((value) => value.trim()).filter(Boolean);
    const sizes = productForm.sizes.split(",").map((value) => value.trim()).filter(Boolean);
    if (!colors.length || !sizes.length) {
      showToast("Ingresá al menos un color y un talle");
      return;
    }
    const combinations = colors.length * sizes.length;
    const accepted = window.confirm(
      `${productForm.id ? "¿Guardar los cambios?" : "¿Crear este producto?"}\nSe prepararán ${combinations} combinaciones de color y talle.`,
    );
    if (!accepted) return;
    setSavingProduct(true);
    const { error } = await supabase.rpc("save_product", {
      p_product_id: productForm.id,
      p_name: productForm.name.trim(),
      p_code: productForm.code.trim().toUpperCase(),
      p_category: productForm.category.trim(),
      p_price: Number(productForm.price),
      p_colors: colors,
      p_sizes: sizes,
    });
    setSavingProduct(false);
    if (error) {
      showToast(error.message.includes("save_product") ? "Falta ejecutar la actualización SQL de Productos" : error.message);
      return;
    }
    setProductForm(null);
    await loadData();
    showToast(productForm.id ? "Producto actualizado" : "Producto creado correctamente");
  }

  function navigate(nextView: View) {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (authLoading && !session) {
    return <div className="authShell"><div className="authCard"><span className="authLogo">IF</span><h1>Indumentaria Fit</h1><p>Conectando con la base de datos…</p></div></div>;
  }

  if (!session) {
    return (
      <div className="authShell">
        <div className="authCard">
          <span className="authLogo">IF</span>
          <p className="eyebrow">Control interno</p>
          <h1>{authMode === "signin" ? "Ingresar" : "Crear primera cuenta"}</h1>
          <p className="authIntro">Usá tu correo y una contraseña para acceder al stock de Indumentaria Fit.</p>
          <form onSubmit={submitAuth}>
            {authMode === "signup" && <label>Nombre completo<input value={authName} onChange={(event) => setAuthName(event.target.value)} required autoComplete="name" /></label>}
            <label>Correo electrónico<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} required autoComplete="email" /></label>
            <label>Contraseña<input type="password" minLength={8} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} required autoComplete={authMode === "signin" ? "current-password" : "new-password"} /></label>
            {authError && <div className="authMessage" role="status">{authError}</div>}
            <button className="primaryButton" type="submit" disabled={authLoading}>{authLoading ? "Esperá…" : authMode === "signin" ? "Ingresar" : "Crear cuenta"}</button>
          </form>
          <button className="authSwitch" type="button" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(""); }}>
            {authMode === "signin" ? "Crear la primera cuenta administradora" : "Ya tengo una cuenta"}
          </button>
        </div>
      </div>
    );
  }

  if (dataLoading || databaseError) {
    return (
      <div className="authShell">
        <div className="authCard connectionCard">
          <span className="authLogo">IF</span>
          <p className="eyebrow">Supabase conectado</p>
          <h1>{dataLoading ? "Cargando información…" : "Falta preparar las tablas"}</h1>
          <p className="authIntro">{dataLoading ? "Estamos leyendo productos y stock." : databaseError}</p>
          {!dataLoading && <p className="setupHint">Abrí Supabase → SQL Editor y ejecutá el contenido del archivo <strong>supabase/setup.sql</strong>.</p>}
          {!dataLoading && <button className="primaryButton" onClick={() => void loadData()}>Volver a comprobar</button>}
          <button className="authSwitch" type="button" onClick={() => void signOut()}>Cerrar sesión</button>
        </div>
      </div>
    );
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
            <select value={location} onChange={(event) => { setLocation(event.target.value); setIntakeValues({}); }}>
              {locations.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </select>
          </label>
          <button className="userMenu" onClick={() => void signOut()} aria-label="Cerrar sesión">
            <span className="userAvatar">{profileName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
            <span><strong>{profileName}</strong><small>{profileRole === "admin" ? "Administradora" : profileRole === "manager" ? "Encargada" : "Vendedora"}</small></span>
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="Navegación principal">
          <div className="statusLine"><span className={realtimeConnected ? "" : "offline"} /> {realtimeConnected ? "Stock en tiempo real" : "Conectando…"}</div>
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
            <strong>Supabase conectado</strong>
            <p>Los cambios quedan guardados y se comparten entre dispositivos.</p>
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
                  { view: "transfers" as View, title: "Transferir mercadería", detail: "Mové stock entre ubicaciones", symbol: "⇄" },
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
              <div className="pageHeading"><div><p className="eyebrow">Disponibilidad</p><h1>Consultar stock</h1><p>Ve todo lo disponible por color y talle.</p></div></div>
              <div className="searchBar"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o código" aria-label="Buscar producto" /></div>
              <div className="stockExplorer">
                <aside className="stockProductPicker">
                  <p className="stockPickerTitle">Elegí un producto</p>
                  <div className="productResults">
                  {filteredProducts.map((product) => {
                    const variants = product.variants.filter((variant) => variant.location === location);
                    const available = variants.reduce((sum, variant) => sum + Math.max(0, variant.onHand - variant.reserved), 0);
                    const reserved = variants.reduce((sum, variant) => sum + variant.reserved, 0);
                    return (
                      <button className={`productResult ${stockProductId === product.id ? "selected" : ""}`} key={product.id} onClick={() => { setStockProductId(product.id); setMessageSize(variants[0]?.size ?? "S"); }}>
                        <span className="productInitial">{product.name.slice(0, 2).toUpperCase()}</span>
                        <span className="productResultName"><strong>{product.name}</strong><small>{product.code} · {variants.length} variantes</small></span>
                        <span className="productStock"><strong>{available}</strong><small>disponibles</small>{reserved > 0 && <em>{reserved} reservado</em>}</span>
                      </button>
                    );
                  })}
                  {!filteredProducts.length && <div className="emptyState compact"><span>⌕</span><p>No encontramos productos con esa búsqueda.</p></div>}
                  </div>
                </aside>

                <div className="stockDetail">
                  <div className="stockDetailHeading"><div><p className="eyebrow">{currentStockProduct.code} · {location}</p><h2>{currentStockProduct.name}</h2><p>{currentStockProduct.category} · {formatMoney(currentStockProduct.price)}</p></div><button className="secondaryButton" onClick={() => setShowStockMessage((current) => !current)}>{showStockMessage ? "Cerrar mensaje" : "Compartir stock"}</button></div>
                  <div className="stockTotals"><div className="available"><span>Disponible</span><strong>{stockAvailable}</strong></div><div><span>Stock físico</span><strong>{stockOnHand}</strong></div><div className={stockReserved ? "reserved" : ""}><span>Reservado</span><strong>{stockReserved}</strong></div></div>

                  <div className="stockLegend"><span><i className="legendAvailable" /> Disponible</span><span><i className="legendLow" /> Quedan 1 o 2</span><span><i className="legendOut" /> Agotado</span></div>
                  <div className="stockMatrixWrap">
                    <table className="stockMatrix">
                      <thead><tr><th>Color</th>{stockSizes.map((size) => <th key={size}>Talle {size}</th>)}</tr></thead>
                      <tbody>{stockColors.map((color) => <tr key={color}><th scope="row"><span className="colorDot" data-color={color} /><strong>{color}</strong></th>{stockSizes.map((size) => {
                        const variant = stockLocationVariants.find((entry) => entry.color === color && entry.size === size);
                        if (!variant) return <td key={size}><span className="stockUnavailable">—</span></td>;
                        const available = variant.onHand - variant.reserved;
                        const status = available <= 0 ? "out" : available <= 2 ? "low" : "ok";
                        return <td key={size}><div className={`stockCell ${status}`}><strong>{available}</strong><span>{available === 1 ? "disponible" : "disponibles"}</span>{variant.reserved > 0 && <small>{variant.reserved} reservado{variant.reserved === 1 ? "" : "s"}</small>}</div></td>;
                      })}</tr>)}</tbody>
                    </table>
                  </div>

                  {showStockMessage && <div className="stockMessagePanel"><div><p className="eyebrow">Mensaje para WhatsApp</p><h3>Preparar mensaje</h3></div><div className="stockMessageOptions"><label>Talle<select value={messageSize} onChange={(event) => setMessageSize(event.target.value)}>{stockSizes.map((size) => <option key={size}>{size}</option>)}</select></label><label className="checkRow"><input type="checkbox" checked={includePrice} onChange={(event) => setIncludePrice(event.target.checked)} /><span>Incluir precio</span></label><label className="checkRow"><input type="checkbox" checked={showQuantities} onChange={(event) => setShowQuantities(event.target.checked)} /><span>Mostrar cantidades</span></label></div><textarea className="messagePreview" readOnly value={stockMessage} aria-label="Vista previa del mensaje" /><button className="primaryButton fit" onClick={copyMessage}>Copiar mensaje</button></div>}
                </div>
              </div>
            </section>
          )}

          {view === "intake" && (
            <section className="pageSection">
              <div className="pageHeading"><div><p className="eyebrow">Stock</p><h1>Ingresar mercadería</h1><p>Cargá las cantidades que llegaron a {location}.</p></div></div>
              <div className="formCard intakeCard">
                <div className="intakeControls"><label className="fieldLabel" htmlFor="intake-product">Producto<select id="intake-product" className="largeSelect" value={intakeProductId} onChange={(event) => { setIntakeProductId(event.target.value); setIntakeValues({}); }}>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><div className="intakeLocation"><span>Ubicación de ingreso</span><strong>{location}</strong></div></div>
                <div className="intakeHelp"><span>1</span><p>Escribí solamente las cantidades que recibiste. Los casilleros vacíos no modifican el stock.</p></div>
                <div className="intakeMatrixWrap">
                  <table className="intakeMatrix">
                    <thead><tr><th>Color</th>{intakeSizes.map((size) => <th key={size}>Talle {size}</th>)}</tr></thead>
                    <tbody>{intakeColors.map((color) => <tr key={color}><th scope="row"><span className="colorDot" data-color={color} /><strong>{color}</strong></th>{intakeSizes.map((size) => {
                      const variant = intakeLocationVariants.find((entry) => entry.color === color && entry.size === size);
                      return <td key={size}>{variant ? <label><span>Actual: {variant.onHand}</span><input type="number" min="0" step="1" inputMode="numeric" value={intakeValues[variant.id] ?? ""} onChange={(event) => setIntakeValues((current) => ({ ...current, [variant.id]: Math.max(0, Math.floor(Number(event.target.value))) }))} placeholder="0" aria-label={`Cantidad recibida de ${color}, talle ${size}`} /></label> : <span className="notAvailable">—</span>}</td>;
                    })}</tr>)}</tbody>
                  </table>
                </div>
                <div className="formFooter"><span>Total a ingresar: <strong>{Object.values(intakeValues).reduce((sum, value) => sum + Number(value || 0), 0)}</strong></span><div className="intakeActions"><button className="secondaryButton" onClick={() => setIntakeValues({})} disabled={!Object.values(intakeValues).some(Boolean)}>Limpiar</button><button className="primaryButton fit" onClick={confirmIntake} disabled={!Object.values(intakeValues).some((value) => Number(value) > 0)}>Revisar y confirmar</button></div></div>
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

          {view === "transfers" && (
            <section className="pageSection">
              <div className="pageHeading"><div><p className="eyebrow">Movimiento interno</p><h1>Transferir mercadería</h1><p>Mové unidades entre Local, Depósito y Feria sin perder el historial.</p></div></div>
              <div className="transferCard">
                <div className="transferRoute">
                  <label>Desde<select value={transferOrigin} onChange={(event) => { const next = event.target.value; setTransferOrigin(next); if (next === transferDestination) setTransferDestination(locations.find((entry) => entry !== next) ?? ""); setTransferStockId(""); }}>{locations.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
                  <span aria-hidden="true">→</span>
                  <label>Hacia<select value={transferDestination} onChange={(event) => setTransferDestination(event.target.value)}>{locations.filter((entry) => entry !== transferOrigin).map((entry) => <option key={entry}>{entry}</option>)}</select></label>
                </div>
                <div className="transferFields">
                  <label>Producto<select value={transferProductId} onChange={(event) => { setTransferProductId(event.target.value); setTransferStockId(""); }}>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
                  <label>Color y talle<select value={transferStockId} onChange={(event) => setTransferStockId(event.target.value)}><option value="">Elegir variante</option>{transferOriginVariants.map((variant) => { const available = variant.onHand - variant.reserved; return <option value={variant.stockId} key={variant.stockId} disabled={available <= 0}>{variant.color} · Talle {variant.size} · {available} disponible{available === 1 ? "" : "s"}</option>; })}</select></label>
                  <label>Cantidad<input type="number" min="1" max={Math.max(1, (selectedTransferVariant?.onHand ?? 0) - (selectedTransferVariant?.reserved ?? 0))} inputMode="numeric" value={transferQuantity} onChange={(event) => setTransferQuantity(Math.max(1, Math.floor(Number(event.target.value))))} /></label>
                </div>
                {selectedTransferVariant ? <div className="transferAvailability"><span>Disponible para mover</span><strong>{selectedTransferVariant.onHand - selectedTransferVariant.reserved}</strong><small>{selectedTransferVariant.onHand} físico · {selectedTransferVariant.reserved} reservado</small></div> : <div className="transferHint">Elegí una variante para ver cuántas unidades podés mover.</div>}
                <div className="transferFooter"><p>Al confirmar se descuenta del origen y se suma al destino inmediatamente.</p><button className="primaryButton fit" disabled={!selectedTransferVariant || transferQuantity > selectedTransferVariant.onHand - selectedTransferVariant.reserved} onClick={confirmTransfer}>Revisar y transferir</button></div>
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
              <div className="pageHeading"><div><p className="eyebrow">Catálogo</p><h1>Productos</h1><p>Productos, códigos, precios y variantes.</p></div><button className="primaryButton fit" onClick={() => openProductForm()}>Nuevo producto</button></div>
              {productForm && (
                <div className="modalBackdrop" role="presentation">
                  <section className="productModal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
                    <div className="modalHeading"><div><p className="eyebrow">Catálogo</p><h2 id="product-form-title">{productForm.id ? "Editar producto" : "Nuevo producto"}</h2></div><button type="button" className="closeButton" onClick={() => setProductForm(null)} aria-label="Cerrar">×</button></div>
                    <form onSubmit={saveProduct} className="productForm">
                      <label>Nombre del producto<input autoFocus required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="Ejemplo: Palazzo de verano" /></label>
                      <div className="formColumns"><label>Código<input required value={productForm.code} onChange={(event) => setProductForm({ ...productForm, code: event.target.value })} placeholder="PAL-001" /></label><label>Precio mayorista<input required type="number" min="0" step="1" inputMode="numeric" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} placeholder="15000" /></label></div>
                      <label>Categoría<input required value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} placeholder="Ejemplo: Pantalones" /></label>
                      <label>Colores <small>Separalos con comas</small><input required value={productForm.colors} onChange={(event) => setProductForm({ ...productForm, colors: event.target.value })} placeholder="Negro, Crema, Bordó" /></label>
                      <label>Talles <small>Separalos con comas</small><input required value={productForm.sizes} onChange={(event) => setProductForm({ ...productForm, sizes: event.target.value })} placeholder="S, M, L, XL" /></label>
                      <div className="variantSummary"><strong>{productForm.colors.split(",").filter((value) => value.trim()).length * productForm.sizes.split(",").filter((value) => value.trim()).length || 0} variantes</strong><span>Se crea una combinación por cada color y talle. El stock comienza en cero.</span></div>
                      <div className="modalActions"><button type="button" className="secondaryButton" onClick={() => setProductForm(null)}>Cancelar</button><button type="submit" className="primaryButton fit" disabled={savingProduct}>{savingProduct ? "Guardando…" : productForm.id ? "Guardar cambios" : "Crear producto"}</button></div>
                    </form>
                  </section>
                </div>
              )}
              <div className="catalogGrid">
                {products.map((product) => {
                  const total = product.variants.reduce((sum, variant) => sum + variant.onHand, 0);
                  return <article className="catalogCard" key={product.id}><div className="catalogVisual">{product.name.slice(0, 2).toUpperCase()}</div><div className="catalogBody"><span>{product.category}</span><h2>{product.name}</h2><p>{product.code} · {product.variants.length} variantes</p><div><strong>{formatMoney(product.price)}</strong><small>{total} unidades totales</small></div><button className="editProductButton" onClick={() => openProductForm(product)}>Editar producto</button></div></article>;
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
