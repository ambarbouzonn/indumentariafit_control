"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase/client";
import PhotoCropper from "./photo-cropper";

type View =
  | "stock"
  | "intake"
  | "sale"
  | "reservations"
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
  imageUrl?: string;
  colorImages?: Record<string, string>;
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

type PhotoTarget = { kind: "main" } | { kind: "color"; color: string };

type PhotoEditorState = {
  file: File;
  target: PhotoTarget;
  title: string;
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

const physicalLocations = ["Depósito", "Feria"];
const locations = ["Todo el stock", ...physicalLocations];
const preferredSizeOrder = ["S", "M", "L", "XL", "XXL"];

function compareSizes(first: string, second: string) {
  const normalizedFirst = first.trim().toLocaleUpperCase("es");
  const normalizedSecond = second.trim().toLocaleUpperCase("es");
  const firstIndex = preferredSizeOrder.indexOf(normalizedFirst);
  const secondIndex = preferredSizeOrder.indexOf(normalizedSecond);
  const firstRank = firstIndex === -1 ? preferredSizeOrder.length : firstIndex;
  const secondRank = secondIndex === -1 ? preferredSizeOrder.length : secondIndex;

  return firstRank - secondRank || normalizedFirst.localeCompare(normalizedSecond, "es", { numeric: true });
}

function compareVariantsBySize(first: Variant, second: Variant) {
  return compareSizes(first.size, second.size) || first.color.localeCompare(second.color, "es", { sensitivity: "base" });
}

function orderedSizes(sizes: string[]) {
  return [...new Set(sizes)].sort(compareSizes);
}

function variantsAt(product: Product, selectedLocation: string) {
  const visible = product.variants.filter((variant) => physicalLocations.includes(variant.location));
  if (selectedLocation !== "Todo el stock") return visible.filter((variant) => variant.location === selectedLocation).sort(compareVariantsBySize);
  const grouped = new Map<string, Variant>();
  for (const variant of visible) {
    const key = `${variant.color}::${variant.size}`;
    const current = grouped.get(key);
    if (current) {
      current.onHand += variant.onHand;
      current.reserved += variant.reserved;
    } else {
      grouped.set(key, { ...variant, id: `all-${key}`, stockId: undefined, locationId: undefined, location: "Todo el stock" });
    }
  }
  return [...grouped.values()].sort(compareVariantsBySize);
}

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
  { id: "MOV-301", type: "Ingreso", detail: "Remera Basic · Negro · M · Local Centro", quantity: 6, date: "Hoy, 10:24", user: "Usuario" },
  { id: "MOV-300", type: "Venta", detail: "Palazzo de verano · Negro · S · Local Centro", quantity: -1, date: "Hoy, 09:52", user: "Sofía" },
  { id: "MOV-299", type: "Reserva", detail: "Palazzo de verano · Crema · S · Local Centro", quantity: -1, date: "Hoy, 09:31", user: "Usuario" },
];

const navItems: { view: View; label: string; symbol: string }[] = [
  { view: "stock", label: "Stock", symbol: "⌕" },
  { view: "intake", label: "Ingresos", symbol: "↓" },
  { view: "sale", label: "Ventas", symbol: "+" },
  { view: "products", label: "Productos", symbol: "◇" },
  { view: "reservations", label: "Reservas", symbol: "◷" },
  { view: "movements", label: "Movimientos", symbol: "↔" },
];

const mobileNavItems = navItems;

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

function PhotoPreview({ file, url, alt }: { file?: File | null; url?: string; alt: string }) {
  const fileUrl = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);

  useEffect(() => () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  // This preview may use a temporary blob URL, which is not compatible with Next Image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fileUrl || url} alt={alt} />;
}

export default function StockApp({ supabaseUrl, supabasePublishableKey }: { supabaseUrl: string; supabasePublishableKey: string }) {
  const supabase = useMemo(() => createClient(supabaseUrl, supabasePublishableKey), [supabasePublishableKey, supabaseUrl]);
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
  const [view, setView] = useState<View>("stock");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [location, setLocation] = useState("Todo el stock");
  const [search, setSearch] = useState("");
  const [saleProductId, setSaleProductId] = useState(initialProducts[0].id);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Transferencia");
  const [stockProductId, setStockProductId] = useState(initialProducts[0].id);
  const [messageSize, setMessageSize] = useState("S");
  const [includePrice, setIncludePrice] = useState(true);
  const [showQuantities, setShowQuantities] = useState(false);
  const [showStockMessage, setShowStockMessage] = useState(false);
  const [showStockDetail, setShowStockDetail] = useState(false);
  const [editingStock, setEditingStock] = useState(false);
  const [stockEditValues, setStockEditValues] = useState<Record<string, number>>({});
  const [stockEditReason, setStockEditReason] = useState("Corrección manual de stock");
  const [intakeProductId, setIntakeProductId] = useState(initialProducts[0].id);
  const [intakeValues, setIntakeValues] = useState<Record<string, number>>({});
  const [productForm, setProductForm] = useState<ProductForm | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [mainPhotoFile, setMainPhotoFile] = useState<File | null>(null);
  const [colorPhotoFiles, setColorPhotoFiles] = useState<Record<string, File>>({});
  const [photoEditor, setPhotoEditor] = useState<PhotoEditorState | null>(null);
  const [toast, setToast] = useState("");

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setDataLoading(true);
    setDatabaseError("");

    const [stockResult, reservationResult, movementResult, profileResult, photoResult] = await Promise.all([
      supabase
        .from("stock_by_location")
        .select("id, on_hand, reserved, variant_id, location_id, locations(name, active), variants(id, products(id, name, code, price, active, categories(name)), colors(name), sizes(name))")
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
      supabase.from("products").select("id, image_url, product_color_images(image_url, colors(name))"),
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

    const productPhotos = new Map<string, { imageUrl?: string; colorImages: Record<string, string> }>();
    if (!photoResult.error) {
      for (const entry of (photoResult.data ?? []) as unknown as Array<Record<string, any>>) {
        productPhotos.set(entry.id, {
          imageUrl: entry.image_url ?? undefined,
          colorImages: Object.fromEntries((entry.product_color_images ?? []).flatMap((image: Record<string, any>) => {
            const color = Array.isArray(image.colors) ? image.colors[0] : image.colors;
            return color?.name && image.image_url ? [[color.name, image.image_url]] : [];
          })),
        });
      }
    }
    const groupedProducts = new Map<string, Product>();
    for (const rawRow of (stockResult.data ?? []) as unknown as Array<Record<string, any>>) {
      const variantRelation = Array.isArray(rawRow.variants) ? rawRow.variants[0] : rawRow.variants;
      const productRelation = Array.isArray(variantRelation?.products) ? variantRelation.products[0] : variantRelation?.products;
      const colorRelation = Array.isArray(variantRelation?.colors) ? variantRelation.colors[0] : variantRelation?.colors;
      const sizeRelation = Array.isArray(variantRelation?.sizes) ? variantRelation.sizes[0] : variantRelation?.sizes;
      const locationRelation = Array.isArray(rawRow.locations) ? rawRow.locations[0] : rawRow.locations;
      const categoryRelation = Array.isArray(productRelation?.categories) ? productRelation.categories[0] : productRelation?.categories;
      if (!productRelation || !productRelation.active || !variantRelation || !locationRelation?.active) continue;
      if (!groupedProducts.has(productRelation.id)) {
        groupedProducts.set(productRelation.id, {
          id: productRelation.id,
          name: productRelation.name,
          code: productRelation.code,
          category: categoryRelation?.name ?? "Sin categoría",
          price: Number(productRelation.price),
          imageUrl: productPhotos.get(productRelation.id)?.imageUrl,
          colorImages: productPhotos.get(productRelation.id)?.colorImages ?? {},
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
        type: rawMovement.movement_type === "sale" ? "Venta" : rawMovement.movement_type === "intake" ? "Ingreso" : rawMovement.movement_type === "adjustment" ? "Ajuste" : rawMovement.movement_type === "product_deleted" ? "Eliminación" : rawMovement.movement_type.startsWith("transfer_") ? "Transferencia" : rawMovement.movement_type,
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
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_by_location" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_movements" }, () => void loadData(true))
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));
    return () => { void supabase.removeChannel(channel); };
  }, [loadData, session, supabase]);

  useEffect(() => {
    if (!showStockDetail) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowStockDetail(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showStockDetail]);

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
    (sum, product) => sum + variantsAt(product, location).reduce(
      (variantSum, variant) => variantSum + Math.max(0, variant.onHand - variant.reserved),
      0,
    ),
    0,
  );
  const lowStockCount = products.reduce(
    (sum, product) =>
      sum +
      variantsAt(product, location).filter(
        (variant) => variant.onHand - variant.reserved > 0 && variant.onHand - variant.reserved <= 2,
      ).length,
    0,
  );
  const outOfStockCount = products.reduce(
    (sum, product) => sum + variantsAt(product, location).filter(
      (variant) => variant.onHand - variant.reserved <= 0,
    ).length,
    0,
  );
  const productsWithStock = products.filter((product) =>
    variantsAt(product, location).some((variant) => variant.onHand - variant.reserved > 0),
  ).length;

  const currentSaleProduct = products.find((product) => product.id === saleProductId) ?? products[0];
  const saleVariants = currentSaleProduct.variants.filter((variant) => variant.location === location).sort(compareVariantsBySize);
  const saleColors = [...new Set(saleVariants.map((variant) => variant.color))];
  const currentStockProduct = products.find((product) => product.id === stockProductId) ?? products[0];
  const currentIntakeProduct = products.find((product) => product.id === intakeProductId) ?? products[0];
  const editingProduct = productForm?.id ? products.find((product) => product.id === productForm.id) : undefined;
  const stockLocationVariants = variantsAt(currentStockProduct, location);
  const stockColors = [...new Set(stockLocationVariants.map((variant) => variant.color))];
  const stockSizes = orderedSizes(stockLocationVariants.map((variant) => variant.size));
  const stockOnHand = stockLocationVariants.reduce((sum, variant) => sum + variant.onHand, 0);
  const stockReserved = stockLocationVariants.reduce((sum, variant) => sum + variant.reserved, 0);
  const stockAvailable = stockOnHand - stockReserved;
  const intakeLocationVariants = currentIntakeProduct.variants.filter((variant) => variant.location === location);
  const intakeColors = [...new Set(intakeLocationVariants.map((variant) => variant.color))];
  const intakeSizes = orderedSizes(intakeLocationVariants.map((variant) => variant.size));

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

  const availableMessageVariants = variantsAt(currentStockProduct, location).filter(
    (variant) => variant.onHand - variant.reserved > 0,
  );
  const formatMessageVariants = (variants: Variant[]) => variants
    .map((variant) => showQuantities
      ? `${variant.onHand - variant.reserved} - ${variant.color}`
      : `- ${variant.color}`)
    .join("\n");
  const messageLines = messageSize === "Todos los talles"
    ? stockSizes.flatMap((size) => {
        const variants = availableMessageVariants.filter((variant) => variant.size === size);
        return variants.length ? [`Talle ${size}:\n${formatMessageVariants(variants)}`] : [];
      })
    : [`Talle ${messageSize}:\n${formatMessageVariants(availableMessageVariants.filter((variant) => variant.size === messageSize)) || "Sin stock disponible"}`];
  const stockMessage = `${currentStockProduct.name}\n\n${messageLines.length ? messageLines.join("\n\n") : "Sin stock disponible"}${includePrice ? `\n\nPrecio mayorista: ${formatMoney(currentStockProduct.price)}` : ""}`;

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

  function changeVariantReserved(productId: string, variantId: string, difference: number) {
    setProducts((current) => current.map((product) => product.id !== productId ? product : {
      ...product,
      variants: product.variants.map((variant) => variant.id !== variantId ? variant : {
        ...variant,
        reserved: Math.max(0, variant.reserved + difference),
      }),
    }));
  }

  async function addToCart(productId: string, variantId: string) {
    const product = products.find((entry) => entry.id === productId);
    const variant = product?.variants.find((entry) => entry.id === variantId);
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
        await loadData(true);
        return;
      }
      setReservationId(data as string);
    }
    changeVariantReserved(productId, variant.id, 1);
    setCart((current) => {
      const existing = current.find(
        (item) => item.productId === productId && item.variantId === variant.id,
      );
      return existing
        ? current.map((item) =>
            item === existing ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...current, { productId, variantId: variant.id, quantity: 1 }];
    });
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
    }
    if (variant) {
      changeVariantReserved(item.productId, item.variantId, -1);
    }
    setCart((current) =>
      current.flatMap((entry) => {
        if (entry.productId !== item.productId || entry.variantId !== item.variantId) return [entry];
        return entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : [];
      }),
    );
  }

  async function confirmSale() {
    if (!cartDetails.length) return;
    const accepted = window.confirm(
      `¿Confirmar la venta por ${formatMoney(cartTotal)}? El stock se descontará ahora.`,
    );
    if (!accepted) return;

    const completedDetails = cartDetails.map((item) => ({ ...item }));
    const completedCustomer = customer.trim() || "Consumidor final";
    const completedPhone = customerPhone.trim() || "No informado";
    const completedPayment = paymentMethod;
    const completedTotal = cartTotal;
    const completedAt = new Date();

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
      setCustomerPhone("");
      await loadData();
      setView("stock");
      downloadSaleReceipt(completedDetails, completedCustomer, completedPhone, completedPayment, completedTotal, completedAt);
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
      user: profileName,
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
    setCustomerPhone("");
    setView("stock");
    downloadSaleReceipt(completedDetails, completedCustomer, completedPhone, completedPayment, completedTotal, completedAt);
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
                  user: profileName,
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

  function downloadSaleReceipt(
    details: Array<CartItem & { product: Product; variant: Variant }>,
    customerName: string,
    phone: string,
    payment: string,
    total: number,
    createdAt: Date,
  ) {
    const width = 1080;
    const height = 1350;
    const receiptNumber = createdAt.toISOString().replace(/\D/g, "").slice(0, 14);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fffefa";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#176b49";
    context.fillRect(0, 0, width, 220);
    context.fillStyle = "#ffffff";
    context.font = "700 52px Arial";
    context.fillText("INDUMENTARIA FIT", 64, 82);
    context.font = "700 27px Arial";
    context.fillText("COMPROBANTE DE VENTA", 64, 132);
    context.font = "22px Arial";
    context.fillText(`N.º ${receiptNumber}`, 64, 174);
    context.textAlign = "right";
    context.fillText(createdAt.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }), width - 64, 174);
    context.textAlign = "left";
    context.fillStyle = "#f5f1e8";
    context.fillRect(64, 258, width - 128, 142);
    context.fillStyle = "#17231d";
    context.font = "700 30px Arial";
    context.fillText(customerName, 92, 310);
    context.fillStyle = "#647068";
    context.font = "22px Arial";
    context.fillText(`Teléfono: ${phone}`, 92, 350);
    context.fillText(`Pago: ${payment}`, 92, 380);
    const headerY = 456;
    context.fillStyle = "#17231d";
    context.font = "700 18px Arial";
    context.fillText("PRODUCTO", 64, headerY);
    context.textAlign = "center"; context.fillText("CANT.", 650, headerY);
    context.textAlign = "right"; context.fillText("UNITARIO", 840, headerY); context.fillText("SUBTOTAL", 1016, headerY);
    context.textAlign = "left";
    let y = 512;
    const rowHeight = Math.max(52, Math.min(82, 520 / Math.max(1, details.length)));
    context.strokeStyle = "#dfe5e0";
    for (const item of details) {
      context.beginPath(); context.moveTo(64, y - 28); context.lineTo(width - 64, y - 28); context.stroke();
      context.fillStyle = "#17231d"; context.font = "700 22px Arial"; context.fillText(item.product.name.slice(0, 32), 64, y);
      context.fillStyle = "#647068"; context.font = "18px Arial"; context.fillText(`${item.variant.color} · Talle ${item.variant.size}`, 64, y + 27);
      context.textAlign = "center"; context.fillStyle = "#17231d"; context.font = "700 22px Arial"; context.fillText(String(item.quantity), 650, y + 8);
      context.textAlign = "right"; context.font = "20px Arial"; context.fillText(formatMoney(item.product.price), 840, y + 8);
      context.font = "700 21px Arial"; context.fillText(formatMoney(item.product.price * item.quantity), 1016, y + 8);
      context.textAlign = "left";
      y += rowHeight;
    }
    context.fillStyle = "#e1f0e7";
    context.fillRect(64, 1120, width - 128, 118);
    context.fillStyle = "#0f5036";
    context.font = "700 30px Arial";
    context.fillText("TOTAL", 92, 1192);
    context.textAlign = "right";
    context.font = "700 44px Arial";
    context.fillText(formatMoney(total), width - 92, 1194);
    context.textAlign = "center";
    context.fillStyle = "#647068";
    context.font = "18px Arial";
    context.fillText("Gracias por tu compra", width / 2, 1292);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `comprobante-${receiptNumber}-${customerName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
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
    setMainPhotoFile(null);
    setColorPhotoFiles({});
    setPhotoEditor(null);
    setProductForm(product ? {
      id: product.id,
      name: product.name,
      code: product.code,
      category: product.category,
      price: String(product.price),
      colors: [...new Set(product.variants.map((variant) => variant.color))].join(", "),
      sizes: orderedSizes(product.variants.map((variant) => variant.size)).join(", "),
    } : { ...emptyProductForm });
  }

  function openStockEditor() {
    if (location === "Todo el stock") {
      showToast("Elegí Depósito o Feria para editar el stock");
      return;
    }
    setStockEditValues(Object.fromEntries(stockLocationVariants.flatMap((variant) => variant.stockId ? [[variant.stockId, variant.onHand]] : [])));
    setStockEditReason("Corrección manual de stock");
    setEditingStock(true);
  }

  function openStockDetail(product: Product, variants: Variant[]) {
    setStockProductId(product.id);
    setMessageSize(variants[0]?.size ?? "S");
    setShowStockMessage(false);
    setShowStockDetail(true);
  }

  async function saveStockChanges() {
    const changed = stockLocationVariants.flatMap((variant) => {
      const nextQuantity = variant.stockId ? Number(stockEditValues[variant.stockId] ?? variant.onHand) : variant.onHand;
      return variant.stockId && nextQuantity !== variant.onHand ? [{ stock_id: variant.stockId, new_quantity: nextQuantity }] : [];
    });
    if (!changed.length) {
      showToast("No cambiaste ninguna cantidad");
      return;
    }
    if (!window.confirm(`¿Guardar ${changed.length} cambio${changed.length === 1 ? "" : "s"} de stock en ${location}?\n\nLos cambios quedarán registrados en Movimientos.`)) return;
    const { error } = await supabase.rpc("adjust_inventory_stock", { p_lines: changed, p_reason: stockEditReason.trim() || "Corrección manual de stock" });
    if (error) {
      showToast(error.message.includes("adjust_inventory_stock") ? "Falta ejecutar la actualización SQL de Inventario" : error.message);
      return;
    }
    setEditingStock(false);
    await loadData();
    showToast("Stock actualizado correctamente");
  }

  function validPhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      showToast("Elegí un archivo de imagen");
      return false;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("La foto debe pesar menos de 8 MB");
      return false;
    }
    return true;
  }

  function choosePhoto(file: File | undefined, target: PhotoTarget, title: string) {
    if (!file || !validPhoto(file)) return;
    setPhotoEditor({ file, target, title });
  }

  async function adjustPhoto(file: File | null | undefined, url: string | undefined, target: PhotoTarget, title: string) {
    if (file) {
      setPhotoEditor({ file, target, title });
      return;
    }
    if (!url) return;
    try {
      showToast("Preparando la foto para editar…");
      const response = await fetch(url);
      if (!response.ok) throw new Error("No se pudo descargar la foto");
      const blob = await response.blob();
      const source = new File([blob], `${title.toLocaleLowerCase("es").replace(/[^a-z0-9]+/gi, "-") || "producto"}.jpg`, {
        type: blob.type || "image/jpeg",
        lastModified: Date.now(),
      });
      if (validPhoto(source)) setPhotoEditor({ file: source, target, title });
    } catch {
      showToast("No se pudo abrir esa foto. Elegila nuevamente desde tu dispositivo.");
    }
  }

  function applyPhotoCrop(file: File) {
    if (!photoEditor) return;
    if (photoEditor.target.kind === "main") {
      setMainPhotoFile(file);
    } else {
      const color = photoEditor.target.color;
      setColorPhotoFiles((current) => ({ ...current, [color]: file }));
    }
    setPhotoEditor(null);
    showToast("Recorte listo. Se guardará junto con el producto.");
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
    const { data: savedProductId, error } = await supabase.rpc("save_product", {
      p_product_id: productForm.id,
      p_name: productForm.name.trim(),
      p_code: productForm.code.trim().toUpperCase(),
      p_category: productForm.category.trim(),
      p_price: Number(productForm.price),
      p_colors: colors,
      p_sizes: sizes,
    });
    if (error) {
      setSavingProduct(false);
      showToast(error.message.includes("save_product") ? "Falta ejecutar la actualización SQL de Productos" : error.message);
      return;
    }
    const productId = String(savedProductId);
    const photos = [
      ...(mainPhotoFile ? [{ color: "", file: mainPhotoFile }] : []),
      ...Object.entries(colorPhotoFiles).map(([color, file]) => ({ color, file })),
    ];
    for (const photo of photos) {
      const extension = photo.file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeColor = photo.color.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-") || "principal";
      const path = `${productId}/${safeColor}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(path, photo.file, { contentType: photo.file.type, upsert: false });
      if (uploadError) {
        setSavingProduct(false);
        showToast(uploadError.message.includes("Bucket") ? "Falta ejecutar la actualización SQL de Fotos" : `No se pudo subir la foto de ${photo.color || "producto"}`);
        return;
      }
      const { data: publicUrl } = supabase.storage.from("product-images").getPublicUrl(path);
      const { error: photoError } = await supabase.rpc("set_product_photo", { p_product_id: productId, p_color_name: photo.color || null, p_image_url: publicUrl.publicUrl });
      if (photoError) {
        setSavingProduct(false);
        showToast("Falta ejecutar la actualización SQL de Fotos");
        return;
      }
    }
    setProductForm(null);
    setSavingProduct(false);
    setMainPhotoFile(null);
    setColorPhotoFiles({});
    await loadData();
    showToast(productForm.id ? "Producto actualizado" : "Producto creado correctamente");
  }

  async function archiveProduct(product: Product) {
    const total = product.variants.reduce((sum, variant) => sum + variant.onHand, 0);
    const reserved = product.variants.reduce((sum, variant) => sum + variant.reserved, 0);
    if (!window.confirm(`¿Eliminar ${product.name} del catálogo?\n\nSe quitarán ${total} unidades de stock${reserved ? ` y se cancelarán sus reservas (${reserved} unidades)` : ""}. El historial se conservará.`)) return;
    const { error } = await supabase.rpc("archive_product", { p_product_id: product.id });
    if (error) {
      showToast(error.message.includes("archive_product") ? "Falta ejecutar la actualización SQL de Productos" : error.message);
      return;
    }
    await loadData();
    showToast("Producto eliminado del catálogo");
  }

  function navigate(nextView: View) {
    if (nextView !== "stock" && location === "Todo el stock") setLocation("Depósito");
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
        <button className="brand" onClick={() => navigate("stock")} aria-label="Ir al control de stock">
          <span className="brandMark">IF</span>
          <span>
            <strong>Indumentaria Fit</strong>
            <small>Control de stock</small>
          </span>
        </button>
        <div className="topbarActions">
          <label className="locationPicker">
            <span>Ubicación</span>
            <select value={location} onChange={(event) => { setLocation(event.target.value); setIntakeValues({}); }}>
              {(view === "stock" ? locations : physicalLocations).map((entry) => (
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
          {view === "sale" && (
            <section className="pageSection">
              <div className="pageHeading">
                <div><p className="eyebrow">Venta o encargo</p><h1>Nueva venta</h1><p>Tomá el pedido, ajustá cantidades y descontalo del stock al confirmar.</p></div>
                {cartDetails.length > 0 && <span className="countBadge">{cartDetails.reduce((sum, item) => sum + item.quantity, 0)} unidades</span>}
              </div>

              <div className="saleLayout">
                <div>
                  <label className="fieldLabel" htmlFor="sale-product">Producto</label>
                  <select id="sale-product" className="largeSelect" value={saleProductId} onChange={(event) => setSaleProductId(event.target.value)}>
                    {products.map((product) => <option value={product.id} key={product.id}>{product.name} · {formatMoney(product.price)}</option>)}
                  </select>

                  <div className="colorVariantList">
                    {saleColors.map((color) => {
                      const variants = saleVariants.filter((variant) => variant.color === color);
                      const availableByColor = variants.reduce((sum, variant) => sum + Math.max(0, variant.onHand - variant.reserved), 0);
                      return (
                        <details className="colorVariantGroup" key={color}>
                          <summary>
                            <span className="colorVariantIdentity"><span className="colorDot" data-color={color} aria-hidden="true" /><span><strong>{color}</strong><small>{variants.length} talle{variants.length === 1 ? "" : "s"}</small></span></span>
                            <span className={`colorVariantTotal ${availableByColor <= 2 ? "low" : ""}`}><strong>{availableByColor}</strong><small>disponibles</small></span>
                            <span className="colorVariantChevron" aria-hidden="true">⌄</span>
                          </summary>
                          <div className="sizeVariantList">
                            {variants.map((variant) => {
                              const available = variant.onHand - variant.reserved;
                              return (
                                <div className="sizeVariantRow" key={variant.id}>
                                  <span className="sizeBadge">{variant.size}</span>
                                  <span className={`sizeAvailability ${available <= 2 ? "low" : ""}`}><strong>{Math.max(0, available)}</strong><small>{available === 1 ? "disponible" : "disponibles"}</small></span>
                                  <button className="addButton" disabled={available <= 0} onClick={() => addToCart(currentSaleProduct.id, variant.id)}>{available > 0 ? "Agregar" : "Agotado"}</button>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>

                <aside className="checkoutCard">
                  <div className="checkoutHeader"><h2>Venta en curso</h2><span>Stock separado</span></div>
                  {cartDetails.length === 0 ? (
                    <div className="emptyState compact"><span>＋</span><p>Todavía no agregaste productos.</p></div>
                  ) : (
                    <div className="cartList">
                      {cartDetails.map((item) => (
                        <div className="cartItem" key={`${item.productId}-${item.variantId}`}>
                          <div><strong>{item.product.name}</strong><span>{item.variant.color} · {item.variant.size}</span></div>
                          <div className="cartQuantity"><button onClick={() => removeFromCart(item)} aria-label={`Quitar una unidad de ${item.product.name}`}>−</button><span>{item.quantity}</span><button onClick={() => addToCart(item.productId, item.variantId)} disabled={item.variant.onHand - item.variant.reserved <= 0} aria-label={`Agregar una unidad de ${item.product.name}`}>+</button></div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="saleCustomerFields"><label><span>Nombre del cliente</span><input id="customer" className="textInput" value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Consumidor final" /></label><label><span>Teléfono</span><input className="textInput" type="tel" inputMode="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Opcional" /></label></div>
                  <label className="fieldLabel" htmlFor="payment">Forma de pago</label>
                  <select id="payment" className="largeSelect" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                    <option>Transferencia</option><option>Efectivo</option><option>Tarjeta</option><option>Seña</option>
                  </select>
                  <div className="checkoutTotal"><span>Total</span><strong>{formatMoney(cartTotal)}</strong></div>
                  <button className="primaryButton" disabled={!cartDetails.length} onClick={confirmSale}>Confirmar y descargar comprobante</button>
                  <p className="saleReceiptNotice">Al confirmar se descuenta el stock y se descarga la factura en formato imagen.</p>
                </aside>
              </div>
            </section>
          )}

          {view === "stock" && (
            <section className="pageSection">
              <div className="pageHeading stockPageHeading"><div><p className="eyebrow">Vista general</p><h1>Control de stock</h1><p>Todo lo que tenés, ordenado por producto, color y talle.</p></div><button className="primaryButton fit" onClick={() => navigate("intake")}>Ingresar mercadería</button></div>
              {editingStock && (
                <div className="modalBackdrop stockEditorBackdrop" role="presentation">
                  <section className="productModal stockEditModal" role="dialog" aria-modal="true" aria-labelledby="stock-edit-title">
                    <div className="modalHeading"><div><p className="eyebrow">{currentStockProduct.name} · {location}</p><h2 id="stock-edit-title">Editar stock físico</h2></div><button type="button" className="closeButton" onClick={() => setEditingStock(false)} aria-label="Cerrar">×</button></div>
                    <p className="stockEditIntro">Escribí la cantidad real que hay. Las reservas no se modifican y cada diferencia queda guardada en Movimientos.</p>
                    <div className="stockEditList">
                      {stockLocationVariants.map((variant) => <label key={variant.stockId}>
                        <span><strong>{variant.color} · Talle {variant.size}</strong><small>Actual: {variant.onHand}{variant.reserved ? ` · ${variant.reserved} reservado${variant.reserved === 1 ? "" : "s"}` : ""}</small></span>
                        <input type="number" min={variant.reserved} step="1" inputMode="numeric" value={variant.stockId ? stockEditValues[variant.stockId] ?? variant.onHand : variant.onHand} onChange={(event) => variant.stockId && setStockEditValues((current) => ({ ...current, [variant.stockId!]: Math.max(0, Math.floor(Number(event.target.value))) }))} aria-label={`Stock físico de ${variant.color}, talle ${variant.size}`} />
                      </label>)}
                    </div>
                    <label className="stockEditReason">Motivo del cambio<input value={stockEditReason} onChange={(event) => setStockEditReason(event.target.value)} placeholder="Ejemplo: Conteo físico" /></label>
                    <div className="modalActions"><button className="secondaryButton" onClick={() => setEditingStock(false)}>Cancelar</button><button className="primaryButton fit" onClick={saveStockChanges}>Revisar y guardar</button></div>
                  </section>
                </div>
              )}
              <div className="stockSummaryStrip" aria-label={`Resumen de ${location}`}>
                <div className="stockSummaryMain"><span>Disponibles</span><strong>{totalAvailable}</strong><small>{location}</small></div>
                <div><span>Productos con stock</span><strong>{productsWithStock}<small> / {products.length}</small></strong></div>
                <div><span>Stock bajo</span><strong>{lowStockCount}</strong><small>variantes con 1 o 2</small></div>
                <div><span>Agotados</span><strong>{outOfStockCount}</strong><small>variantes en cero</small></div>
              </div>

              <div className="stockToolbar">
                <div><h2>Productos</h2><p>Elegí uno para ampliar el detalle.</p></div>
                <div className="searchBar"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o código" aria-label="Buscar producto" /></div>
              </div>

              <div className="stockOverviewGrid">
                {filteredProducts.map((product) => {
                  const variants = variantsAt(product, location);
                  const available = variants.reduce((sum, variant) => sum + Math.max(0, variant.onHand - variant.reserved), 0);
                  const reserved = variants.reduce((sum, variant) => sum + variant.reserved, 0);
                  const colors = [...new Set(variants.map((variant) => variant.color))];
                  return (
                    <button className="stockOverviewCard" key={product.id} aria-label={`Ver detalle de ${product.name}`} onClick={() => openStockDetail(product, variants)}>
                      <span className="stockOverviewHead">
                        {product.imageUrl ? <img className="productThumbnail" src={product.imageUrl} alt="" /> : <span className="productInitial">{product.name.slice(0, 2).toUpperCase()}</span>}
                        <span className="stockOverviewIdentity"><strong>{product.name}</strong><small>{product.code} · {product.category}</small></span>
                        <span className="stockOverviewTotal"><strong>{available}</strong><small>disponibles</small>{reserved > 0 && <em>{reserved} reservados</em>}</span>
                      </span>
                      <span className="stockOverviewRows">
                        {colors.map((color) => (
                          <span className="stockOverviewColor" key={color}>
                            <span className="stockOverviewColorName">{product.colorImages?.[color] ? <img className="colorThumbnail" src={product.colorImages[color]} alt="" /> : <span className="colorDot" data-color={color} />}<strong>{color}</strong></span>
                            <span className="stockOverviewSizes">{orderedSizes(variants.filter((variant) => variant.color === color).map((variant) => variant.size)).map((size) => {
                              const variant = variants.find((entry) => entry.color === color && entry.size === size);
                              const quantity = Math.max(0, (variant?.onHand ?? 0) - (variant?.reserved ?? 0));
                              return <span className={quantity <= 0 ? "out" : quantity <= 2 ? "low" : ""} key={size}><b>{size}</b><strong>{quantity}</strong></span>;
                            })}</span>
                          </span>
                        ))}
                      </span>
                      <span className="stockOverviewAction">Ver detalle <span aria-hidden="true">→</span></span>
                    </button>
                  );
                })}
                {!filteredProducts.length && <div className="emptyState stockOverviewEmpty"><span>⌕</span><h2>No encontramos productos</h2><p>Probá con otro nombre o código.</p></div>}
              </div>

              {showStockDetail && (
                <div className="modalBackdrop stockDetailBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowStockDetail(false); }}>
                  <section className="stockDetailModal" role="dialog" aria-modal="true" aria-labelledby="stock-detail-title">
                    <div className="stockDetailModalTop"><div><p className="eyebrow">Detalle de producto</p><span>Stock por color y talle</span></div><button type="button" className="closeButton" onClick={() => setShowStockDetail(false)} aria-label="Cerrar detalle">×</button></div>
                    <div className="stockDetail">
                  <div className="stockDetailHeading"><div className="stockProductIdentity">{currentStockProduct.imageUrl && <img src={currentStockProduct.imageUrl} alt={currentStockProduct.name} />}<div><p className="eyebrow">{currentStockProduct.code} · {location}</p><h2 id="stock-detail-title">{currentStockProduct.name}</h2><p>{currentStockProduct.category} · {formatMoney(currentStockProduct.price)}</p></div></div><div className="stockHeadingActions"><button className="secondaryButton" onClick={openStockEditor}>Editar stock</button><button className="secondaryButton" onClick={() => setShowStockMessage((current) => !current)}>{showStockMessage ? "Cerrar mensaje" : "Compartir stock"}</button></div></div>
                  <div className="stockTotals"><div className="available"><span>Disponible</span><strong>{stockAvailable}</strong></div><div><span>Stock físico</span><strong>{stockOnHand}</strong></div><div className={stockReserved ? "reserved" : ""}><span>Reservado</span><strong>{stockReserved}</strong></div></div>

                  <div className="stockLegend"><span><i className="legendAvailable" /> Disponible</span><span><i className="legendLow" /> Quedan 1 o 2</span><span><i className="legendOut" /> Agotado</span></div>
                  <div className="stockMatrixWrap">
                    <table className="stockMatrix">
                      <thead><tr><th>Color</th>{stockSizes.map((size) => <th key={size}>Talle {size}</th>)}</tr></thead>
                      <tbody>{stockColors.map((color) => <tr key={color}><th scope="row">{currentStockProduct.colorImages?.[color] ? <img className="colorThumbnail" src={currentStockProduct.colorImages[color]} alt={color} /> : <span className="colorDot" data-color={color} />}<strong>{color}</strong></th>{stockSizes.map((size) => {
                        const variant = stockLocationVariants.find((entry) => entry.color === color && entry.size === size);
                        if (!variant) return <td key={size}><span className="stockUnavailable">—</span></td>;
                        const available = variant.onHand - variant.reserved;
                        const status = available <= 0 ? "out" : available <= 2 ? "low" : "ok";
                        return <td key={size}><div className={`stockCell ${status}`}><strong>{available}</strong><span>{available === 1 ? "disponible" : "disponibles"}</span>{variant.reserved > 0 && <small>{variant.reserved} reservado{variant.reserved === 1 ? "" : "s"}</small>}</div></td>;
                      })}</tr>)}</tbody>
                    </table>
                  </div>
                  <div className="stockMobileList">
                    {stockColors.map((color) => {
                      const colorVariants = stockSizes.flatMap((size) => {
                        const variant = stockLocationVariants.find((entry) => entry.color === color && entry.size === size);
                        return variant ? [variant] : [];
                      });
                      return <article className="stockMobileColor" key={color}>
                        <div className="stockMobileColorHead">{currentStockProduct.colorImages?.[color] ? <img className="colorThumbnail" src={currentStockProduct.colorImages[color]} alt={color} /> : <span className="colorDot" data-color={color} />}<strong>{color}</strong></div>
                        <div className="stockMobileSizes">{colorVariants.map((variant) => {
                          const available = variant.onHand - variant.reserved;
                          const status = available <= 0 ? "out" : available <= 2 ? "low" : "ok";
                          return <div className={`stockMobileSize ${status}`} key={`${variant.color}-${variant.size}`}><span>{variant.size}</span><strong>{available}</strong>{variant.reserved > 0 && <small>{variant.reserved} reservada{variant.reserved === 1 ? "" : "s"}</small>}</div>;
                        })}</div>
                      </article>;
                    })}
                  </div>

                  {showStockMessage && <div className="stockMessagePanel"><div><p className="eyebrow">Mensaje para WhatsApp</p><h3>Preparar mensaje</h3></div><div className="stockMessageOptions"><label>Talle<select value={messageSize} onChange={(event) => setMessageSize(event.target.value)}><option>Todos los talles</option>{stockSizes.map((size) => <option key={size}>{size}</option>)}</select></label><label className="checkRow"><input type="checkbox" checked={includePrice} onChange={(event) => setIncludePrice(event.target.checked)} /><span>Incluir precio</span></label><label className="checkRow"><input type="checkbox" checked={showQuantities} onChange={(event) => setShowQuantities(event.target.checked)} /><span>Mostrar cantidades</span></label></div><textarea className="messagePreview" readOnly value={stockMessage} aria-label="Vista previa del mensaje" /><button className="primaryButton fit" onClick={copyMessage}>Copiar mensaje</button></div>}
                    </div>
                  </section>
                </div>
              )}
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
                      <div className="photoEditor">
                        <div><strong>Fotos del producto</strong><small>Elegí una foto y después acomodala, acercala o recortala como quieras.</small></div>
                        <div className="photoUploadRow">
                          {(mainPhotoFile || editingProduct?.imageUrl) ? <PhotoPreview file={mainPhotoFile} url={editingProduct?.imageUrl} alt="Foto principal" /> : <span className="photoPlaceholder">Foto</span>}
                          <span><strong>Foto principal</strong><small>{mainPhotoFile?.name || "La que se verá en el catálogo"}</small></span>
                          <span className="photoRowActions">
                            {(mainPhotoFile || editingProduct?.imageUrl) && <button type="button" onClick={() => void adjustPhoto(mainPhotoFile, editingProduct?.imageUrl, { kind: "main" }, "Foto principal")}>Ajustar</button>}
                            <label>Elegir<input type="file" accept="image/*" onChange={(event) => { choosePhoto(event.target.files?.[0], { kind: "main" }, "Foto principal"); event.currentTarget.value = ""; }} /></label>
                          </span>
                        </div>
                        <div className="colorPhotoList">
                          {[...new Set(productForm.colors.split(",").map((value) => value.trim()).filter(Boolean))].map((color) => {
                            const selectedFile = colorPhotoFiles[color];
                            const existingUrl = editingProduct?.colorImages?.[color];
                            return <div className="photoUploadRow" key={color}>
                              {(selectedFile || existingUrl) ? <PhotoPreview file={selectedFile} url={existingUrl} alt={color} /> : <span className="photoPlaceholder"><span className="colorDot" data-color={color} /></span>}
                              <span><strong>{color}</strong><small>{selectedFile?.name || (existingUrl ? "Foto cargada" : "Sin foto propia")}</small></span>
                              <span className="photoRowActions">
                                {(selectedFile || existingUrl) && <button type="button" onClick={() => void adjustPhoto(selectedFile, existingUrl, { kind: "color", color }, `Foto ${color}`)}>Ajustar</button>}
                                <label>Elegir<input type="file" accept="image/*" onChange={(event) => { choosePhoto(event.target.files?.[0], { kind: "color", color }, `Foto ${color}`); event.currentTarget.value = ""; }} /></label>
                              </span>
                            </div>;
                          })}
                        </div>
                      </div>
                      <div className="variantSummary"><strong>{productForm.colors.split(",").filter((value) => value.trim()).length * productForm.sizes.split(",").filter((value) => value.trim()).length || 0} variantes</strong><span>Se crea una combinación por cada color y talle. El stock comienza en cero.</span></div>
                      <div className="modalActions"><button type="button" className="secondaryButton" onClick={() => setProductForm(null)}>Cancelar</button><button type="submit" className="primaryButton fit" disabled={savingProduct}>{savingProduct ? "Guardando…" : productForm.id ? "Guardar cambios" : "Crear producto"}</button></div>
                    </form>
                  </section>
                </div>
              )}
              {photoEditor && <PhotoCropper file={photoEditor.file} title={photoEditor.title} onCancel={() => setPhotoEditor(null)} onSave={applyPhotoCrop} />}
              <div className="catalogGrid">
                {products.map((product) => {
                  const total = product.variants.reduce((sum, variant) => sum + variant.onHand, 0);
                  return <article className="catalogCard" key={product.id}>{product.imageUrl ? <img className="catalogVisual catalogPhoto" src={product.imageUrl} alt={product.name} /> : <div className="catalogVisual">{product.name.slice(0, 2).toUpperCase()}</div>}<div className="catalogBody"><span>{product.category}</span><h2>{product.name}</h2><p>{product.code} · {product.variants.length} variantes</p><div><strong>{formatMoney(product.price)}</strong><small>{total} unidades totales</small></div><div className="productCardActions"><button className="editProductButton" onClick={() => openProductForm(product)}>Editar y fotos</button><button className="deleteProductButton" onClick={() => archiveProduct(product)}>Eliminar</button></div></div></article>;
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
        {mobileNavItems.map((item) => (
          <button key={item.view} className={view === item.view ? "active" : ""} onClick={() => navigate(item.view)}><span aria-hidden="true">{item.symbol}</span>{item.label}</button>
        ))}
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
