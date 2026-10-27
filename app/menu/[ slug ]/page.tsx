
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Business = {
  id: string;
  name: string;
  slug: string;
};

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  available: boolean;
  category_id: string | null;
  image_url: string | null;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type CustomerOrderItem = {
  product_name: string;
  quantity: number;
  price: number;
  item_total: number;
};

type CustomerOrder = {
  id: string;
  order_number: number;
  qr_name: string | null;
  total: number;
  created_at: string;
  items: CustomerOrderItem[];
};

export default function MenuPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const restoredCartKeyRef = useRef<string | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState("");
  const [qrName, setQrName] = useState<string | null>(null);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(2 * 60 * 60);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    async function loadMenu() {
      try {
        const slug = window.location.pathname
          .split("/")
          .filter(Boolean)
          .pop();

        if (!slug) {
          setError("Business slug missing");
          setLoading(false);
          return;
        }

        const {
          data: businessData,
          error: businessError,
        } = await supabase
          .from("businesses")
          .select("id, name, slug")
          .eq("slug", slug)
          .maybeSingle();

        if (businessError) {
          setError(businessError.message);
          setLoading(false);
          return;
        }

        if (!businessData) {
          setError("Business not found");
          setLoading(false);
          return;
        }

        setBusiness(businessData);

        // Load today's customer orders
        const orderStorageKey = `customer-orders-${businessData.slug}`;

        try {
          const savedOrders = localStorage.getItem(orderStorageKey);

          if (savedOrders) {
            const parsedOrders = JSON.parse(savedOrders);

            if (Array.isArray(parsedOrders)) {
              const today = new Date().toLocaleDateString("en-CA");

              const validOrders = parsedOrders.filter((order) => {
                if (!order.created_at) return false;

                return (
                  new Date(order.created_at).toLocaleDateString("en-CA") ===
                  today
                );
              });

              setCustomerOrders(validOrders);
              localStorage.setItem(
                orderStorageKey,
                JSON.stringify(validOrders)
              );
            }
          }
        } catch (storageError) {
          console.error("Customer orders load error:", storageError);
        }

        // Validate QR code and session
        const params = new URLSearchParams(window.location.search);
        const qrToken = params.get("qr");

        if (qrToken) {
          const {
            data: qrData,
            error: qrError,
          } = await supabase
            .from("qr_codes")
            .select("id, name, token, enabled")
            .eq("token", qrToken)
            .eq("business_id", businessData.id)
            .eq("enabled", true)
            .maybeSingle();

          if (qrError) {
            setError(qrError.message);
            setLoading(false);
            return;
          }

          if (!qrData) {
            setError("Ye QR code valid nahi hai ya disabled hai.");
            setLoading(false);
            return;
          }

          setQrName(qrData.name);

          const sessionStorageKey =
            `customer-session-${businessData.id}-${qrToken}`;

          let currentSessionId: string | null = null;
          let currentSessionExpiry: number | null = null;
          let shouldCallSessionRpc = true;

          try {
            const savedSession = localStorage.getItem(sessionStorageKey);

            if (savedSession !== null) {
              const parsedSession = JSON.parse(savedSession);

              currentSessionId = parsedSession.session_id ?? null;
              currentSessionExpiry = Number(parsedSession.expires_at);

              if (
                !currentSessionId ||
                !Number.isFinite(currentSessionExpiry)
              ) {
                setError(
                  "Session invalid hai. QR code dobara scan karein."
                );
                setLoading(false);
                return;
              }

              if (currentSessionExpiry <= Date.now()) {
                // Do not renew an expired session.
                setSessionId(currentSessionId);
                setSessionExpiry(currentSessionExpiry);
                setSessionExpired(true);
                shouldCallSessionRpc = false;
              }
            } else {
              currentSessionId = crypto.randomUUID();
            }
          } catch (storageError) {
            console.error(
              "Customer session load error:",
              storageError
            );
            setError(
              "Session check nahi ho paya. Browser storage check karein."
            );
            setLoading(false);
            return;
          }

          if (shouldCallSessionRpc) {
            const {
              data: sessionData,
              error: sessionError,
            } = await supabase.rpc("start_qr_menu_session", {
              p_business_id: businessData.id,
              p_qr_token: qrToken,
              p_session_id: currentSessionId,
            });

            if (sessionError) {
              console.error(
                "START QR MENU SESSION ERROR:",
                sessionError
              );

              if (
                sessionError.message.toLowerCase().includes("expired")
              ) {
                setSessionId(currentSessionId);
                setSessionExpiry(currentSessionExpiry);
                setSessionExpired(true);
              } else {
                setError(`Session error: ${sessionError.message}`);
                setLoading(false);
                return;
              }
            } else {
              const activeSession = Array.isArray(sessionData)
                ? sessionData[0]
                : sessionData;

              if (
                !activeSession?.session_id ||
                !activeSession?.expires_at
              ) {
                setError(
                  "QR session start nahi ho paya. Dobara scan karein."
                );
                setLoading(false);
                return;
              }

              const serverExpiry = new Date(
                activeSession.expires_at
              ).getTime();

              if (!Number.isFinite(serverExpiry)) {
                setError("Server se session expiry valid nahi mili.");
                setLoading(false);
                return;
              }

              setSessionId(activeSession.session_id);
              setSessionExpiry(serverExpiry);
              setSessionExpired(serverExpiry <= Date.now());

              localStorage.setItem(
                sessionStorageKey,
                JSON.stringify({
                  session_id: activeSession.session_id,
                  expires_at: serverExpiry,
                })
              );
            }
          }
        }

        // Load categories
        const {
          data: categoryData,
          error: categoryError,
        } = await supabase
          .from("categories")
          .select("id, name")
          .eq("business_id", businessData.id)
          .order("name");

        if (categoryError) {
          setError(categoryError.message);
          setLoading(false);
          return;
        }

        // Load products
        const {
          data: productData,
          error: productError,
        } = await supabase
          .from("products")
          .select(
            "id, name, price, description, available, category_id, image_url"
          )
          .eq("business_id", businessData.id)
          .order("created_at", { ascending: false });

        if (productError) {
          setError(productError.message);
          setLoading(false);
          return;
        }

        setCategories(categoryData || []);
        setProducts(productData || []);
        setLoading(false);
      } catch (loadError) {
        console.error("Menu load error:", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Menu load nahi ho paya."
        );
        setLoading(false);
      }
    }

    loadMenu();
  }, []);

  // Session countdown
  useEffect(() => {
    if (sessionExpiry === null) return;

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((sessionExpiry - Date.now()) / 1000)
      );

      setTimeLeft(remaining);

      if (remaining <= 0) {
        setSessionExpired(true);
        setShowCart(false);
      }
    };

    updateTimer();

    const timer = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(timer);
  }, [sessionExpiry]);
// Restore cart after menu data has loaded
useEffect(() => {
  if (loading || !business || products.length === 0) return;

  const params = new URLSearchParams(window.location.search);
  const qrToken = params.get("qr") || "no-qr";
    const storageKey = `customer-cart-${business.id}-${qrToken}`;

  if (restoredCartKeyRef.current === storageKey) return;
  restoredCartKeyRef.current = storageKey;

  try {
    const savedCart = localStorage.getItem(storageKey);

    if (savedCart) {
      const parsedCart = JSON.parse(savedCart) as CartItem[];

      const restoredCart = parsedCart
        .filter(
          (item) =>
            item?.product?.id &&
            Number.isFinite(item.quantity) &&
            item.quantity > 0
        )
        .map((item) => {
          const product = products.find(
            (p) => p.id === item.product.id
          );

          return product
            ? { product, quantity: item.quantity }
            : null;
        })
        .filter((item): item is CartItem => item !== null);

      setCart(restoredCart);
    }
  } catch (error) {
    console.error("Cart restore error:", error);
  } finally {
    setCartLoaded(true);
  }
}, [loading, business, products]);

// Persist cart after restoration
useEffect(() => {
  if (!business || !cartLoaded) return;

  const params = new URLSearchParams(window.location.search);
  const qrToken = params.get("qr") || "no-qr";
  const storageKey = `customer-cart-${business.id}-${qrToken}`;

  try {
    localStorage.setItem(storageKey, JSON.stringify(cart));
  } catch (error) {
    console.error("Cart save error:", error);
  }
}, [cart, business, cartLoaded]);
  function addToCart(product: Product) {
    if (!product.available) return;

    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        return currentCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentCart, { product, quantity: 1 }];
    });
  }

  function increaseQuantity(productId: string) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }

  function decreaseQuantity(productId: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.product.id !== productId)
    );
  }

  function getCartQuantity(productId: string) {
    return (
      cart.find((item) => item.product.id === productId)?.quantity || 0
    );
  }

  const cartItemCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const cartTotal = cart.reduce(
    (total, item) =>
      total + Number(item.product.price) * item.quantity,
    0
  );

  async function placeOrder() {
    if (
      !business ||
      cart.length === 0 ||
      sessionExpired ||
      !sessionId
    ) {
      return;
    }

    if (sessionExpiry === null || Date.now() >= sessionExpiry) {
      setSessionExpired(true);
      setShowCart(false);
      return;
    }

    setPlacingOrder(true);
    setOrderSuccess("");

    try {
      const params = new URLSearchParams(window.location.search);
      const qrToken = params.get("qr");

      const orderItems = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      }));

      const {
        data,
        error: orderError,
      } = await supabase.rpc("place_customer_order", {
        p_business_id: business.id,
        p_qr_token: qrToken || null,
        p_items: orderItems,
        p_session_id: sessionId,
      });

      if (orderError) {
        throw new Error(orderError.message);
      }

      if (!data) {
        throw new Error("Order create nahi hua");
      }

      const orderData = Array.isArray(data) ? data[0] : data;

      if (!orderData) {
        throw new Error("Order create nahi hua");
      }

      const customerOrderItems: CustomerOrderItem[] = cart.map(
        (item) => ({
          product_name: item.product.name,
          quantity: item.quantity,
          price: Number(item.product.price),
          item_total:
            Number(item.product.price) * item.quantity,
        })
      );

      const customerOrder: CustomerOrder = {
        id: orderData.id,
        order_number: Number(orderData.order_number),
        qr_name: orderData.qr_name ?? null,
        total: Number(orderData.total),
        created_at: orderData.created_at || new Date().toISOString(),
        items: customerOrderItems,
      };

      const updatedCustomerOrders = [
        customerOrder,
        ...customerOrders,
      ];

      setCustomerOrders(updatedCustomerOrders);

      try {
        localStorage.setItem(
          `customer-orders-${business.slug}`,
          JSON.stringify(updatedCustomerOrders)
        );
      } catch (storageError) {
        console.error("Customer order save error:", storageError);
      }

      setCart([]);
      setShowCart(false);
      setOrderSuccess(
        `Order #${orderData.order_number} placed successfully`
      );
    } catch (orderError) {
      alert(
        orderError instanceof Error
          ? orderError.message
          : "Order place nahi hua"
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  if (loading || (business !== null && products.length > 0 && !cartLoaded)) {
    return (
      <main className="min-h-screen bg-white p-6 text-black">
        <p>Loading menu...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white p-6 text-black">
        <h1 className="text-xl font-bold">Menu Error</h1>
        <p className="mt-3">{error}</p>
      </main>
    );
  }

  if (!business) {
    return (
      <main className="min-h-screen bg-white p-6 text-black">
        <p>Business not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-28 text-black">
      <div className="mx-auto max-w-xl">
        {/* HEADER */}
        <header className="border-b bg-white px-5 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{business.name}</h1>
              <p className="text-gray-500">Menu</p>

              {qrName && (
                <div className="mt-3 inline-block rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                  📱 {qrName}
                </div>
              )}

              {sessionExpiry !== null && (
                <p className="mt-2 text-xs text-gray-500">
                  {sessionExpired
                    ? "QR session expired"
                    : `Session time left: ${Math.floor(timeLeft / 60)} min`}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowOrders(true)}
              className="shrink-0 rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white"
            >
              🧾 Your Orders
              {customerOrders.length > 0 && (
                <span className="ml-1">
                  ({customerOrders.length})
                </span>
              )}
            </button>
          </div>
        </header>

        {/* ORDER SUCCESS */}
        {orderSuccess && (
          <div className="m-4 rounded-xl bg-green-100 p-4 text-center font-semibold text-green-700">
            {orderSuccess}
          </div>
        )}

        {/* MENU */}
        <section className="p-4">
          {categories.map((category) => {
            const categoryProducts = products.filter(
              (product) => product.category_id === category.id
            );

            if (categoryProducts.length === 0) return null;

            return (
              <div key={category.id} className="mb-7">
                <h2 className="mb-3 text-xl font-bold">
                  {category.name}
                </h2>

                <div className="space-y-3">
                  {categoryProducts.map((product) => {
                    const quantity = getCartQuantity(product.id);

                    return (
                      <div
                        key={product.id}
                        className="overflow-hidden rounded-xl border bg-white"
                      >
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-52 w-full object-cover"
                          />
                        )}

                        <div className="p-4">
                          <div className="flex justify-between gap-4">
                            <div className="min-w-0">
                              <h3 className="text-lg font-semibold">
                                {product.name}
                              </h3>

                              {product.description && (
                                <p className="mt-1 text-sm text-gray-500">
                                  {product.description}
                                </p>
                              )}

                              <p
                                className={`mt-2 text-sm font-semibold ${
                                  product.available
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {product.available
                                  ? "Available"
                                  : "Not Available"}
                              </p>
                            </div>

                            <div className="whitespace-nowrap font-bold">
                              ₹{Number(product.price).toFixed(2)}
                            </div>
                          </div>

                          {/* PRODUCT CART BUTTON */}
                          <div className="mt-4">
                            {!product.available ? (
                              <button
                                type="button"
                                disabled
                                className="w-full rounded-lg bg-gray-200 p-3 font-semibold text-gray-500"
                              >
                                Not Available
                              </button>
                            ) : quantity === 0 ? (
                              <button
                                type="button"
                                onClick={() => addToCart(product)}
                                className="w-full rounded-lg bg-black p-3 font-semibold text-white"
                              >
                                Add to Cart
                              </button>
                            ) : (
                              <div className="flex items-center justify-between rounded-lg border bg-white">
                                <button
                                  type="button"
                                  onClick={() =>
                                    decreaseQuantity(product.id)
                                  }
                                  className="px-5 py-3 text-xl font-bold"
                                >
                                  −
                                </button>

                                <span className="font-semibold">
                                  {quantity}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    increaseQuantity(product.id)
                                  }
                                  className="px-5 py-3 text-xl font-bold"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {/* FIXED VIEW CART BUTTON */}
      {cartItemCount > 0 && !showCart && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
          <div className="mx-auto max-w-xl">
            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="flex w-full items-center justify-between rounded-xl bg-black px-5 py-4 font-semibold text-white shadow-lg"
            >
              <span>
                🛒 {cartItemCount} item
                {cartItemCount !== 1 ? "s" : ""}
              </span>

              <span>
                View Cart · ₹{cartTotal.toFixed(2)}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* YOUR ORDERS MODAL */}
      {showOrders && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="absolute bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white">
            <div className="mx-auto max-w-xl p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Your Orders</h2>
                  <p className="text-sm text-gray-500">
                    {customerOrders.length} order
                    {customerOrders.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowOrders(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 font-semibold"
                >
                  Close
                </button>
              </div>

              {customerOrders.length === 0 ? (
                <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                  Abhi tak koi order nahi kiya.
                </div>
              ) : (
                <div className="space-y-4">
                  {customerOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border p-4"
                    >
                      <div>
                        <p className="text-lg font-bold">
                          Order #{order.order_number}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleString()}
                        </p>

                        {order.qr_name && (
                          <p className="mt-1 text-sm font-semibold text-blue-600">
                            📱 {order.qr_name}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 space-y-2">
                        {order.items.map((item, index) => (
                          <div
                            key={`${order.id}-${index}`}
                            className="rounded-lg bg-gray-50 p-3"
                          >
                            <p className="font-semibold">
                              {item.product_name}
                            </p>
                            <p className="text-sm text-gray-500">
                              Quantity: {item.quantity}
                            </p>
                          </div>
                        ))}
                      </div>

                      <p className="mt-3 font-bold">
                        Total: ₹{order.total.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CART MODAL */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white">
            <div className="mx-auto max-w-xl p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Your Cart</h2>
                  <p className="text-sm text-gray-500">
                    {cartItemCount} item
                    {cartItemCount !== 1 ? "s" : ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCart(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 font-semibold"
                >
                  Close
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-5 text-center text-gray-500">
                  Your cart is empty.
                </p>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="rounded-xl border p-4"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">
                            {item.product.name}
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            ₹{Number(item.product.price).toFixed(2)} ×{" "}
                            {item.quantity}
                          </p>
                        </div>

                        <p className="font-bold">
                          ₹
                          {(
                            Number(item.product.price) *
                            item.quantity
                          ).toFixed(2)}
                        </p>
                      </div>

                      {/* CART QUANTITY AND REMOVE */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center rounded-lg border">
                          <button
                            type="button"
                            onClick={() =>
                              decreaseQuantity(item.product.id)
                            }
                            className="px-4 py-2 text-lg font-bold"
                          >
                            −
                          </button>

                          <span className="px-3 font-semibold">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              increaseQuantity(item.product.id)
                            }
                            className="px-4 py-2 text-lg font-bold"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(item.product.id)
                          }
                          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TOTAL */}
              <div className="mt-5 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">
                    Grand Total
                  </span>
                  <span className="text-xl font-bold">
                    ₹{cartTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* PLACE ORDER */}
              <button
                type="button"
                onClick={placeOrder}
                disabled={
                  placingOrder ||
                  cart.length === 0 ||
                  sessionExpired
                }
                className="mt-4 w-full rounded-xl bg-black p-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {placingOrder
                  ? "Placing Order..."
                  : sessionExpired
                    ? "Session Expired"
                    : "Place Order"}
              </button>

              {sessionExpired && (
                <p className="mt-3 text-center text-sm text-red-600">
                  QR session expire ho gaya. Order karne ke liye QR code
                  dobara scan karein.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
