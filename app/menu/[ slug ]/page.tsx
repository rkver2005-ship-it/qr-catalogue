"use client";

import { useEffect, useState } from "react";
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
  const [business, setBusiness] =
    useState<Business | null>(null);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [cart, setCart] =
    useState<CartItem[]>([]);

  const [customerOrders, setCustomerOrders] =
    useState<CustomerOrder[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showCart, setShowCart] =
    useState(false);

  const [showOrders, setShowOrders] =
    useState(false);

  const [placingOrder, setPlacingOrder] =
    useState(false);

  const [orderSuccess, setOrderSuccess] =
    useState("");

  const [qrName, setQrName] =
    useState<string | null>(null);
    const [sessionExpiry, setSessionExpiry] =
    useState<number | null>(null);

const [timeLeft, setTimeLeft] =
    useState(3 * 60 * 60);

const [sessionExpired, setSessionExpired] =
    useState(false);


  useEffect(() => {
    async function loadMenu() {
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

      /*
        =========================
        LOAD CUSTOMER ORDERS
        =========================
      */

      const orderStorageKey =
        `customer-orders-${businessData.slug}`;

      try {
        const savedOrders =
          localStorage.getItem(orderStorageKey);

        if (savedOrders) {
          const parsedOrders =
            JSON.parse(savedOrders);

          if (Array.isArray(parsedOrders)) {
  const today = new Date().toLocaleDateString("en-CA");

  const validOrders = parsedOrders.filter((order) => {
    if (!order.created_at) {
      return false;
    }

    return (
      new Date(order.created_at).toLocaleDateString(
        "en-CA"
      ) === today
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
        console.error(
          "Customer orders load error:",
          storageError
        );
      }

      /*
        =========================
        QR CHECK
        =========================
      */

      const params = new URLSearchParams(
        window.location.search
      );

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
          setError(
            "Ye QR code valid nahi hai ya disabled hai."
          );
          setLoading(false);
          return;
        }

        setQrName(qrData.name);
        const expiry = Date.now() + 3 * 60 * 60 * 1000;

setSessionExpiry(expiry);
      }

      /*
        =========================
        LOAD CATEGORIES
        =========================
      */

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

      /*
        =========================
        LOAD PRODUCTS
        =========================
      */

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select(
          "id, name, price, description, available, category_id, image_url"
        )
        .eq("business_id", businessData.id)
        .order("created_at", {
          ascending: false,
        });

      if (productError) {
        setError(productError.message);
        setLoading(false);
        return;
      }

      setCategories(categoryData || []);
      setProducts(productData || []);
      setLoading(false);
    }

    loadMenu();
  }, []);
    useEffect(() => {
    if (sessionExpiry === null) {
      return;
    }

    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor(
          (sessionExpiry - Date.now()) / 1000
        )
      );

      setTimeLeft(remaining);

      if (remaining <= 0) {
        setSessionExpired(true);
        setCart([]);
        setShowCart(false);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [sessionExpiry]);

  async function placeOrder() {
  if (
    !business ||
    cart.length === 0 ||
    sessionExpired
  ) {
    return;
  }

  if (
    sessionExpiry === null ||
    Date.now() >= sessionExpiry
  ) {
    setSessionExpired(true);
    setCart([]);
    setShowCart(false);
    return;
  }

    setPlacingOrder(true);
    setOrderSuccess("");

    try {
      /*
        =========================
        QR TOKEN
        =========================
      */

      const params = new URLSearchParams(
        window.location.search
      );

      const qrToken = params.get("qr");

      /*
        =========================
        SECURE ORDER DATA
        =========================

        Browser se sirf product ID
        aur quantity database ko bhej rahe hain.

        Price aur total database
        khud calculate karega.
      */

      const orderItems = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      }));

      /*
        =========================
        CREATE SECURE ORDER
        =========================
      */

      const {
        data,
        error: orderError,
      } = await supabase.rpc(
        "place_customer_order",
        {
          p_business_id: business.id,
          p_qr_token: qrToken || null,
          p_items: orderItems,
        }
      );

      if (orderError) {
        throw new Error(orderError.message);
      }

      if (!data) {
        throw new Error("Order create nahi hua");
      }

      const orderData = Array.isArray(data)
        ? data[0]
        : data;

      if (!orderData) {
        throw new Error("Order create nahi hua");
      }

      /*
        =========================
        SAVE CUSTOMER ORDER
        =========================

        Your Orders ke liye localStorage
        mein order history save kar rahe hain.
      */

      const customerOrderItems: CustomerOrderItem[] =
        cart.map((item) => ({
          product_name: item.product.name,
          quantity: item.quantity,
          price: Number(item.product.price),
          item_total:
            Number(item.product.price) *
            item.quantity,
        }));

      const customerOrder: CustomerOrder = {
        id: orderData.id,
        order_number: Number(
          orderData.order_number
        ),
        qr_name:
          orderData.qr_name ?? null,
        total: Number(orderData.total),
        created_at:
          orderData.created_at ||
          new Date().toISOString(),
        items: customerOrderItems,
      };

      const updatedCustomerOrders = [
        customerOrder,
        ...customerOrders,
      ];

      setCustomerOrders(
        updatedCustomerOrders
      );

      try {
        localStorage.setItem(
          `customer-orders-${business.slug}`,
          JSON.stringify(
            updatedCustomerOrders
          )
        );
      } catch (storageError) {
        console.error(
          "Customer order save error:",
          storageError
        );
      }

      /*
        =========================
        CLEAR CART
        =========================
      */

      setCart([]);
      setShowCart(false);

      setOrderSuccess(
        `Order #${orderData.order_number} placed successfully`
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Order place nahi hua"
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  function addToCart(product: Product) {
    if (!product.available) {
      return;
    }

    setCart((currentCart) => {
      const existingItem =
        currentCart.find(
          (item) =>
            item.product.id === product.id
        );

      if (existingItem) {
        return currentCart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity:
                  item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          product,
          quantity: 1,
        },
      ];
    });
  }

  function increaseQuantity(
    productId: string
  ) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity:
                item.quantity + 1,
            }
          : item
      )
    );
  }

  function decreaseQuantity(
    productId: string
  ) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity:
                  item.quantity - 1,
              }
            : item
        )
        .filter(
          (item) => item.quantity > 0
        )
    );
  }

  function getCartQuantity(
    productId: string
  ) {
    return (
      cart.find(
        (item) =>
          item.product.id === productId
      )?.quantity || 0
    );
  }

  const cartItemCount = cart.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );

  const cartTotal = cart.reduce(
    (total, item) =>
      total +
      Number(item.product.price) *
        item.quantity,
    0
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-6 text-black">
        <p>Loading menu...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white p-6 text-black">
        <h1 className="text-xl font-bold">
          Menu Error
        </h1>

        <p className="mt-3">
          {error}
        </p>
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
              <h1 className="text-2xl font-bold">
                {business.name}
              </h1>

              <p className="text-gray-500">
                Menu
              </p>

              {qrName && (
                <div className="mt-3 inline-block rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                  📱 {qrName}
                </div>
              )}
            </div>

            {/* YOUR ORDERS */}

            <button
              onClick={() =>
                setShowOrders(true)
              }
              className="shrink-0 rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white"
            >
              🧾 Your Orders

              {customerOrders.length >
                0 && (
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
            const categoryProducts =
              products.filter(
                (product) =>
                  product.category_id ===
                  category.id
              );

            if (
              categoryProducts.length === 0
            ) {
              return null;
            }

            return (
              <div
                key={category.id}
                className="mb-7"
              >
                <h2 className="mb-3 text-xl font-bold">
                  {category.name}
                </h2>

                <div className="space-y-3">
                  {categoryProducts.map(
                    (product) => {
                      const quantity =
                        getCartQuantity(
                          product.id
                        );

                      return (
                        <div
                          key={product.id}
                          className="overflow-hidden rounded-xl border bg-white"
                        >
                          {product.image_url && (
                            <img
                              src={
                                product.image_url
                              }
                              alt={
                                product.name
                              }
                              className="h-52 w-full object-cover"
                            />
                          )}

                          <div className="p-4">
                            <div className="flex justify-between gap-4">
                              <div className="min-w-0">
                                <h3 className="text-lg font-semibold">
                                  {
                                    product.name
                                  }
                                </h3>

                                {product.description && (
                                  <p className="mt-1 text-sm text-gray-500">
                                    {
                                      product.description
                                    }
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
                                ₹
                                {Number(
                                  product.price
                                ).toFixed(2)}
                              </div>
                            </div>

                            {/* CART BUTTON */}

                            <div className="mt-4">
                              {!product.available ? (
                                <button
                                  disabled
                                  className="w-full rounded-lg bg-gray-200 p-3 font-semibold text-gray-500"
                                >
                                  Not Available
                                </button>
                              ) : quantity ===
                                0 ? (
                                <button
                                  onClick={() =>
                                    addToCart(
                                      product
                                    )
                                  }
                                  className="w-full rounded-lg bg-black p-3 font-semibold text-white"
                                >
                                  Add to Cart
                                </button>
                              ) : (
                                <div className="flex items-center justify-between rounded-lg border bg-white">
                                  <button
                                    onClick={() =>
                                      decreaseQuantity(
                                        product.id
                                      )
                                    }
                                    className="px-5 py-3 text-xl font-bold"
                                  >
                                    −
                                  </button>

                                  <span className="font-semibold">
                                    {quantity}
                                  </span>

                                  <button
                                    onClick={() =>
                                      increaseQuantity(
                                        product.id
                                      )
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
                    }
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {/* CART BUTTON */}

      {cartItemCount > 0 &&
        !showCart && (
          <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
            <div className="mx-auto max-w-xl">
              <button
                onClick={() =>
                  setShowCart(true)
                }
                className="flex w-full items-center justify-between rounded-xl bg-black px-5 py-4 font-semibold text-white shadow-lg"
              >
                <span>
                  🛒 {cartItemCount} item
                  {cartItemCount !== 1
                    ? "s"
                    : ""}
                </span>

                <span>
                  View Cart · ₹
                  {cartTotal.toFixed(2)}
                </span>
              </button>
            </div>
          </div>
        )}

      {/* YOUR ORDERS */}

      {showOrders && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="absolute bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white">
            <div className="mx-auto max-w-xl p-5">

              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    Your Orders
                  </h2>

                  <p className="text-sm text-gray-500">
                    {customerOrders.length}{" "}
                    order
                    {customerOrders.length !==
                    1
                      ? "s"
                      : ""}
                  </p>
                </div>

                <button
                  onClick={() =>
                    setShowOrders(false)
                  }
                  className="rounded-lg bg-gray-100 px-4 py-2 font-semibold"
                >
                  Close
                </button>
              </div>

              {customerOrders.length ===
              0 ? (
                <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                  Abhi tak koi order nahi
                  kiya.
                </div>
              ) : (
                <div className="space-y-4">
                  {customerOrders.map(
                    (order) => (
                      <div
                        key={order.id}
                        className="rounded-xl border p-4"
                      >
                        <div>
                          <p className="text-lg font-bold">
                            Order #
                            {
                              order.order_number
                            }
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {new Date(
                              order.created_at
                            ).toLocaleString()}
                          </p>

                          {order.qr_name && (
                            <p className="mt-1 text-sm font-semibold text-blue-600">
                              📱{" "}
                              {
                                order.qr_name
                              }
                            </p>
                          )}
                        </div>

                        <div className="mt-4 space-y-2">
                          {order.items.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                key={`${order.id}-${index}`}
                                className="rounded-lg bg-gray-50 p-3"
                              >
                                <p className="font-semibold">
                                  {
                                    item.product_name
                                  }
                                </p>

                                <p className="text-sm text-gray-500">
                                  Quantity:{" "}
                                  {
                                    item.quantity
                                  }
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CART */}

      {showCart && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white">
            <div className="mx-auto max-w-xl p-5">

              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    Your Cart
                  </h2>

                  <p className="text-sm text-gray-500">
                    {cartItemCount} item
                    {cartItemCount !== 1
                      ? "s"
                      : ""}
                  </p>
                </div>

                <button
                  onClick={() =>
                    setShowCart(false)
                  }
                  className="rounded-lg bg-gray-100 px-4 py-2 font-semibold"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="rounded-xl border p-4"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">
                          {
                            item.product
                              .name
                          }
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          ₹
                          {Number(
                            item.product
                              .price
                          ).toFixed(2)}{" "}
                          ×{" "}
                          {item.quantity}
                        </p>
                      </div>

                      <p className="font-bold">
                        ₹
                        {(
                          Number(
                            item.product
                              .price
                          ) *
                          item.quantity
                        ).toFixed(2)}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border">
                        <button
                          onClick={() =>
                            decreaseQuantity(
                              item.product
                                .id
                            )
                          }
                          className="px-4 py-2 text-lg font-bold"
                        >
                          −
                        </button>

                        <span className="px-3 font-semibold">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() =>
                            increaseQuantity(
                              item.product
                                .id
                            )
                          }
                          className="px-4 py-2 text-lg font-bold"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setCart(
                            (currentCart) =>
                              currentCart.filter(
                                (cartItem) =>
                                  cartItem
                                    .product
                                    .id !==
                                  item
                                    .product
                                    .id
                              )
                          );
                        }}
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

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
                onClick={placeOrder}
                disabled={
                  placingOrder ||
                  cart.length === 0
                }
                className="mt-4 w-full rounded-xl bg-black p-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {placingOrder
                  ? "Placing Order..."
                  : "Place Order"}
              </button>

            </div>
          </div>
        </div>
      )}
    </main>
  );
}