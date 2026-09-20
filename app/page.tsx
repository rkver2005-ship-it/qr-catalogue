"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
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

type QRCode = {
  id: string;
  name: string;
  token: string;
  enabled: boolean;
};

type Order = {
  id: string;
  order_number: number;
  qr_name: string | null;
  total: number;
  created_at: string;
  cancelled: boolean;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  price: number;
  item_total: number;
};

export default function Home() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [showQRCodes, setShowQRCodes] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);

  const [newOrderNotification, setNewOrderNotification] =
    useState("");

  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  function getLocalDate(dateString: string) {
    const date = new Date(dateString);

    return `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function formatMoney(value: number) {
    return `₹${Number(value || 0).toFixed(2)}`;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function getMyBusiness() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(userError);
      return null;
    }

    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, slug")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      return null;
    }

    if (!data) {
      console.error("Business not found");
      return null;
    }

    setBusiness(data);
    return data;
  }

  async function loadProducts() {
    const businessData = await getMyBusiness();

    if (!businessData) return;

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, price, description, available, category_id, image_url"
      )
      .eq("business_id", businessData.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setProducts(data || []);
  }

  async function loadQRCodes() {
    const businessData = await getMyBusiness();

    if (!businessData) return;

    const { data, error } = await supabase
      .from("qr_codes")
      .select("id, name, token, enabled")
      .eq("business_id", businessData.id)
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setQrCodes(data || []);
  }

  async function loadOrders() {
    const businessData = await getMyBusiness();

    if (!businessData) return;

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, order_number, qr_name, total, created_at, cancelled"
      )
      .eq("business_id", businessData.id)
      .order("created_at", { ascending: false });

    if (orderError) {
      console.error(orderError);
      return;
    }

    setOrders(orderData || []);

    if (!orderData || orderData.length === 0) {
      setOrderItems([]);
      return;
    }

    const orderIds = orderData.map((order) => order.id);

    const { data: itemData, error: itemError } = await supabase
      .from("order_items")
      .select(
        "id, order_id, product_name, quantity, price, item_total"
      )
      .in("order_id", orderIds);

    if (itemError) {
      console.error(itemError);
      return;
    }

    setOrderItems(itemData || []);
  }

  async function cancelOrder(orderId: string) {
    const confirmed = window.confirm(
      "Kya aap is order ko cancel karna chahte hain?"
    );

    if (!confirmed) return;

    const businessData = await getMyBusiness();

    if (!businessData) {
      alert("Business not found");
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({ cancelled: true })
      .eq("id", orderId)
      .eq("business_id", businessData.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadOrders();
    alert("Order cancelled successfully");
  }

  function printBill(order: Order) {
    const items = orderItems.filter(
      (item) => item.order_id === order.id
    );

    const businessName = business?.name || "Restaurant";
    const orderDate = new Date(order.created_at).toLocaleString();

    const itemsHtml = items
      .map(
        (item) => `
          <tr>
            <td class="item-name">${escapeHtml(item.product_name)}</td>
            <td class="qty">${item.quantity}</td>
            <td class="price">${formatMoney(item.price)}</td>
            <td class="total">${formatMoney(item.item_total)}</td>
          </tr>
        `
      )
      .join("");

    const printWindow = window.open(
      "",
      "_blank",
      "width=500,height=700"
    );

    if (!printWindow) {
      alert("Print window open nahi hua. Browser popup allow karo.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill #${order.order_number}</title>

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 10px;
              background: #fff;
              color: #000;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
            }

            .bill {
              width: 100%;
              max-width: 80mm;
              margin: 0 auto;
            }

            .center {
              text-align: center;
            }

            .business-name {
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 4px;
            }

            .bill-title {
              font-size: 15px;
              font-weight: 700;
              margin: 8px 0;
            }

            .meta {
              font-size: 11px;
              line-height: 1.5;
            }

            .line {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }

            th,
            td {
              padding: 4px 1px;
              vertical-align: top;
            }

            th {
              border-bottom: 1px solid #000;
              font-size: 10px;
            }

            .item-name {
              width: 40%;
              text-align: left;
              word-break: break-word;
            }

            .qty {
              width: 12%;
              text-align: center;
            }

            .price {
              width: 23%;
              text-align: right;
            }

            .total {
              width: 25%;
              text-align: right;
            }

            .grand-total {
              display: flex;
              justify-content: space-between;
              font-size: 15px;
              font-weight: 700;
              margin-top: 8px;
            }

            .footer {
              text-align: center;
              margin-top: 14px;
              font-size: 10px;
            }

            @media print {
              @page {
                size: auto;
                margin: 3mm;
              }

              body {
                padding: 0;
              }

              .bill {
                max-width: none;
                width: 100%;
              }
            }
          </style>
        </head>

        <body>
          <div class="bill">

            <div class="center">
              <div class="business-name">
                ${escapeHtml(businessName)}
              </div>

              <div class="bill-title">
                BILL
              </div>
            </div>

            <div class="meta">
              <div>
                <strong>Order:</strong>
                #${order.order_number}
              </div>

              <div>
                <strong>Date:</strong>
                ${escapeHtml(orderDate)}
              </div>

              <div>
                <strong>Table:</strong>
                ${escapeHtml(
                  order.qr_name || "Direct Order"
                )}
              </div>
            </div>

            <div class="line"></div>

            <table>
              <thead>
                <tr>
                  <th class="item-name">Item</th>
                  <th class="qty">Qty</th>
                  <th class="price">Price</th>
                  <th class="total">Total</th>
                </tr>
              </thead>

              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="line"></div>

            <div class="grand-total">
              <span>Grand Total</span>
              <span>${formatMoney(order.total)}</span>
            </div>

            <div class="footer">
              Thank you
            </div>

          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.focus();

    setTimeout(() => {
      printWindow.print();

      setTimeout(() => {
        printWindow.close();
      }, 500);
    }, 300);
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function toggleQRCode(qr: QRCode) {
    const businessData = await getMyBusiness();

    if (!businessData) {
      alert("Business not found");
      return;
    }

    const { error } = await supabase
      .from("qr_codes")
      .update({ enabled: !qr.enabled })
      .eq("id", qr.id)
      .eq("business_id", businessData.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadQRCodes();
  }

  function getQRUrl(qr: QRCode) {
    if (!business) return "";

    return `${window.location.origin}/menu/${business.slug}?qr=${qr.token}`;
  }

  function downloadQR(qr: QRCode) {
    const canvas = document.getElementById(
      `qr-${qr.id}`
    ) as HTMLCanvasElement | null;

    if (!canvas) {
      alert("QR code ready nahi hai");
      return;
    }

    const link = document.createElement("a");

    link.download = `${qr.name.replace(/\s+/g, "-")}-QR.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function handleImageChange(file: File | null) {
    setImageFile(file);

    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview("");
    }
  }

  async function uploadImage(productId: string) {
    if (!imageFile) return null;

    const extension =
      imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath =
      `products/${productId}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from("product-image")
      .upload(filePath, imageFile);

    if (error) {
      alert(error.message);
      return null;
    }

    const { data } = supabase.storage
      .from("product-image")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function deleteStorageImage(imageUrl: string | null) {
    if (!imageUrl) return;

    const marker =
      "/storage/v1/object/public/product-image/";

    const index = imageUrl.indexOf(marker);

    if (index === -1) return;

    const filePath = decodeURIComponent(
      imageUrl.substring(index + marker.length)
    );

    await supabase.storage
      .from("product-image")
      .remove([filePath]);
  }

  async function saveProduct() {
    if (!name.trim() || !price) {
      alert("Product name aur price required hai");
      return;
    }

    if (!categoryId) {
      alert("Category select karo");
      return;
    }

    setSaving(true);

    try {
      const businessData = await getMyBusiness();

      if (!businessData) {
        alert("Business not found");
        setSaving(false);
        return;
      }

      if (editingId) {
        const existingProduct = products.find(
          (product) => product.id === editingId
        );

        let imageUrl = existingProduct?.image_url || null;

        if (imageFile) {
          const newImageUrl = await uploadImage(editingId);

          if (!newImageUrl) {
            setSaving(false);
            return;
          }

          await deleteStorageImage(imageUrl);
          imageUrl = newImageUrl;
        }

        const { error } = await supabase
          .from("products")
          .update({
            name: name.trim(),
            price: Number(price),
            description: description.trim() || null,
            category_id: categoryId,
            image_url: imageUrl,
          })
          .eq("id", editingId)
          .eq("business_id", businessData.id);

        if (error) {
          alert(error.message);
          setSaving(false);
          return;
        }

        alert("Product updated successfully");
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert({
            business_id: businessData.id,
            name: name.trim(),
            price: Number(price),
            description: description.trim() || null,
            category_id: categoryId,
            available: true,
            image_url: null,
          })
          .select()
          .single();

        if (error) {
          alert(error.message);
          setSaving(false);
          return;
        }

        if (imageFile && newProduct) {
          const imageUrl = await uploadImage(newProduct.id);

          if (imageUrl) {
            await supabase
              .from("products")
              .update({ image_url: imageUrl })
              .eq("id", newProduct.id)
              .eq("business_id", businessData.id);
          }
        }

        alert("Product added successfully");
      }

      clearForm();
      await loadProducts();
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    }

    setSaving(false);
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setPrice(String(product.price));
    setDescription(product.description || "");
    setCategoryId(product.category_id || "");
    setImageFile(null);
    setImagePreview(product.image_url || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function clearForm() {
    setEditingId(null);
    setName("");
    setPrice("");
    setDescription("");
    setCategoryId("");
    setImageFile(null);
    setImagePreview("");
  }

  function cancelEdit() {
    clearForm();
  }

  async function removePhoto(product: Product) {
    const confirmed = confirm("Photo remove karni hai?");

    if (!confirmed) return;

    await deleteStorageImage(product.image_url);

    const businessData = await getMyBusiness();

    if (!businessData) {
      alert("Business not found");
      return;
    }

    const { error } = await supabase
      .from("products")
      .update({ image_url: null })
      .eq("id", product.id)
      .eq("business_id", businessData.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (editingId === product.id) {
      setImageFile(null);
      setImagePreview("");
    }

    await loadProducts();
    alert("Photo removed");
  }

  async function deleteProduct(id: string) {
    const confirmed = confirm(
      "Ye product delete karna hai?"
    );

    if (!confirmed) return;

    const product = products.find(
      (item) => item.id === id
    );

    if (product?.image_url) {
      await deleteStorageImage(product.image_url);
    }

    const businessData = await getMyBusiness();

    if (!businessData) {
      alert("Business not found");
      return;
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .eq("business_id", businessData.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (editingId === id) {
      clearForm();
    }

    await loadProducts();
    alert("Product deleted");
  }

  async function toggleAvailability(product: Product) {
    const businessData = await getMyBusiness();

    if (!businessData) {
      alert("Business not found");
      return;
    }

    const { error } = await supabase
      .from("products")
      .update({
        available: !product.available,
      })
      .eq("id", product.id)
      .eq("business_id", businessData.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadProducts();
  }

  function getCategoryName(categoryId: string | null) {
    if (!categoryId) return "No Category";

    const category = categories.find(
      (item) => item.id === categoryId
    );

    return category?.name || "No Category";
  }

  const filteredProducts = products.filter((product) => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) return true;

    return (
      product.name.toLowerCase().includes(searchText) ||
      getCategoryName(product.category_id)
        .toLowerCase()
        .includes(searchText)
    );
  });

  /*
    =========================
    ANALYTICS
    =========================
  */

  const selectedDateOrders = useMemo(() => {
    return orders.filter(
      (order) => getLocalDate(order.created_at) === selectedDate
    );
  }, [orders, selectedDate]);

  const normalOrders = useMemo(() => {
    return selectedDateOrders.filter(
      (order) => !order.cancelled
    );
  }, [selectedDateOrders]);

  const cancelledOrders = useMemo(() => {
    return selectedDateOrders.filter(
      (order) => order.cancelled
    );
  }, [selectedDateOrders]);

  const todaySales = useMemo(() => {
    return normalOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0
    );
  }, [normalOrders]);

  const cancelledAmount = useMemo(() => {
    return cancelledOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0
    );
  }, [cancelledOrders]);

  const selectedOrderIds = useMemo(() => {
    return new Set(
      selectedDateOrders.map((order) => order.id)
    );
  }, [selectedDateOrders]);

  const analyticsItems = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        quantity: number;
        revenue: number;
      }
    > = {};

    orderItems.forEach((item) => {
      if (!selectedOrderIds.has(item.order_id)) return;

      const order = selectedDateOrders.find(
        (itemOrder) => itemOrder.id === item.order_id
      );

      if (!order || order.cancelled) return;

      if (!map[item.product_name]) {
        map[item.product_name] = {
          name: item.product_name,
          quantity: 0,
          revenue: 0,
        };
      }

      map[item.product_name].quantity += Number(
        item.quantity
      );

      map[item.product_name].revenue += Number(
        item.item_total
      );
    });

    return Object.values(map).sort(
      (a, b) => b.quantity - a.quantity
    );
  }, [orderItems, selectedOrderIds, selectedDateOrders]);

  const itemsSold = useMemo(() => {
    return analyticsItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }, [analyticsItems]);

  const topSellingItem =
    analyticsItems.length > 0
      ? analyticsItems[0].name
      : "No sales yet";

  const donutItems = analyticsItems.slice(0, 6);

  const donutTotal = donutItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  let donutStart = 0;

  const donutSegments = donutItems.map((item) => {
    const percentage =
      donutTotal > 0
        ? (item.quantity / donutTotal) * 100
        : 0;

    const start = donutStart;
    const end = donutStart + percentage;

    donutStart = end;

    return {
      ...item,
      start,
      end,
    };
  });

  const donutBackground =
    donutSegments.length > 0
      ? `conic-gradient(${donutSegments
          .map(
            (item, index) =>
              `hsl(${index * 55}, 70%, 55%) ${item.start}% ${item.end}%`
          )
          .join(", ")})`
      : "conic-gradient(#e5e7eb 0% 100%)";

  /*
    =========================
    INITIAL LOAD + REALTIME
    =========================
  */

  useEffect(() => {
    let ordersChannel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    async function loadAdmin() {
      const businessData = await getMyBusiness();

      if (!businessData) return;

      const { data: categoryData } = await supabase
        .from("categories")
        .select("id, name")
        .eq("business_id", businessData.id)
        .order("name");

      setCategories(categoryData || []);

      const { data: productData } = await supabase
        .from("products")
        .select(
          "id, name, price, description, available, category_id, image_url"
        )
        .eq("business_id", businessData.id)
        .order("created_at", { ascending: false });

      setProducts(productData || []);

      const { data: qrData, error: qrError } = await supabase
        .from("qr_codes")
        .select("id, name, token, enabled")
        .eq("business_id", businessData.id)
        .order("name");

      if (qrError) {
        console.error(qrError);
      } else {
        setQrCodes(qrData || []);
      }

      await loadOrders();

      ordersChannel = supabase
        .channel(`orders-realtime-${businessData.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
            filter: `business_id=eq.${businessData.id}`,
          },
          async (payload) => {
            console.log(
              "New order received:",
              payload.new
            );

            setNewOrderNotification(
              `🔔 New Order #${payload.new.order_number}`
            );

            setShowOrders(true);

            setTimeout(() => {
              setNewOrderNotification("");
            }, 5000);

            await loadOrders();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "order_items",
          },
          async () => {
            await loadOrders();
          }
        )
        .subscribe((status) => {
          console.log(
            "Orders realtime status:",
            status
          );
        });
    }

    loadAdmin();

    return () => {
      if (ordersChannel) {
        supabase.removeChannel(ordersChannel);
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-5 text-black">
      <div className="mx-auto max-w-3xl">

        {/* HEADER */}

        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {business?.name || "Restaurant Admin"}
            </h1>

            <p className="mt-1 text-gray-500">
              Manage your menu
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white"
          >
            Logout
          </button>
        </div>

        {/* NEW ORDER NOTIFICATION */}

        {newOrderNotification && (
          <div className="mb-6 rounded-xl bg-green-600 p-4 text-center text-lg font-bold text-white shadow-lg">
            {newOrderNotification}
          </div>
        )}

        {/* ANALYTICS */}

        <div className="mb-6 rounded-xl bg-white shadow">
          <button
            onClick={() =>
              setShowAnalytics(!showAnalytics)
            }
            className="flex w-full items-center justify-between p-5 text-left"
          >
            <div>
              <h2 className="text-xl font-bold">
                Sales Analytics
              </h2>

              <p className="text-sm text-gray-500">
                Sales aur order summary
              </p>
            </div>

            <span className="text-xl">
              {showAnalytics ? "▲" : "▼"}
            </span>
          </button>

          {showAnalytics && (
            <div className="border-t px-5 pb-5 pt-4">

              {/* DATE */}

              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold">
                  Sales Date
                </label>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) =>
                    setSelectedDate(e.target.value)
                  }
                  className="w-full rounded-lg border p-3"
                />
              </div>

              {/* KPI GRID */}

              <div className="grid grid-cols-2 gap-3">

                <div className="rounded-xl bg-green-50 p-4">
                  <p className="text-sm font-medium text-gray-600">
                    Sales
                  </p>

                  <p className="mt-1 text-xl font-bold text-green-700">
                    {formatMoney(todaySales)}
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-sm font-medium text-gray-600">
                    Orders
                  </p>

                  <p className="mt-1 text-xl font-bold text-blue-700">
                    {normalOrders.length}
                  </p>
                </div>

                <div className="rounded-xl bg-purple-50 p-4">
                  <p className="text-sm font-medium text-gray-600">
                    Items Sold
                  </p>

                  <p className="mt-1 text-xl font-bold text-purple-700">
                    {itemsSold}
                  </p>
                </div>

                <div className="rounded-xl bg-orange-50 p-4">
                  <p className="text-sm font-medium text-gray-600">
                    Top Selling
                  </p>

                  <p className="mt-1 truncate text-lg font-bold text-orange-700">
                    {topSellingItem}
                  </p>
                </div>

                <div className="rounded-xl bg-red-50 p-4">
                  <p className="text-sm font-medium text-gray-600">
                    Cancelled Orders
                  </p>

                  <p className="mt-1 text-xl font-bold text-red-700">
                    {cancelledOrders.length}
                  </p>
                </div>

                <div className="rounded-xl bg-red-50 p-4">
                  <p className="text-sm font-medium text-gray-600">
                    Cancelled Amount
                  </p>

                  <p className="mt-1 text-xl font-bold text-red-700">
                    {formatMoney(cancelledAmount)}
                  </p>
                </div>

              </div>

              {/* DAILY SUMMARY */}

              <div className="mt-6 rounded-xl border p-4">
                <h3 className="mb-4 text-lg font-bold">
                  Daily Sales Summary
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Total Sales</span>
                    <span className="font-bold">
                      {formatMoney(todaySales)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Total Orders</span>
                    <span className="font-bold">
                      {normalOrders.length}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Items Sold</span>
                    <span className="font-bold">
                      {itemsSold}
                    </span>
                  </div>

                  <div className="flex justify-between text-red-600">
                    <span>Cancelled Orders</span>
                    <span className="font-bold">
                      {cancelledOrders.length}
                    </span>
                  </div>

                  <div className="flex justify-between text-red-600">
                    <span>Cancelled Amount</span>
                    <span className="font-bold">
                      {formatMoney(cancelledAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* DONUT CHART */}

              <div className="mt-6 rounded-xl border p-4">
                <h3 className="text-lg font-bold">
                  What Sold Most
                </h3>

                {donutItems.length === 0 ? (
                  <div className="mt-4 rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
                    Is date par sales data nahi hai.
                  </div>
                ) : (
                  <>
                    <div className="mt-5 flex flex-col items-center">

                      <div
                        className="relative h-52 w-52 rounded-full"
                        style={{
                          background: donutBackground,
                        }}
                      >
                        <div className="absolute inset-8 flex items-center justify-center rounded-full bg-white">
                          <div className="text-center">
                            <p className="text-2xl font-bold">
                              {itemsSold}
                            </p>

                            <p className="text-xs text-gray-500">
                              Items
                            </p>
                          </div>
                        </div>
                      </div>

                    </div>

                    <div className="mt-5 space-y-3">
                      {donutItems.map(
                        (item, index) => (
                          <div
                            key={item.name}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: `hsl(${index * 55}, 70%, 55%)`,
                                }}
                              />

                              <span className="truncate font-medium">
                                {item.name}
                              </span>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="font-semibold">
                                {item.quantity} sold
                              </p>

                              <p className="text-xs text-gray-500">
                                {formatMoney(
                                  item.revenue
                                )}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    {/* REVENUE PER ITEM */}

                    <div className="mt-6 border-t pt-4">
                      <h3 className="mb-3 font-bold">
                        Item Sales
                      </h3>

                      <div className="space-y-2">
                        {analyticsItems.map(
                          (item) => (
                            <div
                              key={item.name}
                              className="flex justify-between gap-3 rounded-lg bg-gray-50 p-3"
                            >
                              <div>
                                <p className="font-semibold">
                                  {item.name}
                                </p>

                                <p className="text-xs text-gray-500">
                                  {item.quantity} item
                                  {item.quantity !== 1
                                    ? "s"
                                    : ""}{" "}
                                  sold
                                </p>
                              </div>

                              <p className="font-bold">
                                {formatMoney(
                                  item.revenue
                                )}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
          )}
        </div>

        {/* QR SCANNERS */}

        <div className="mb-6 rounded-xl bg-white shadow">
          <button
            onClick={() =>
              setShowQRCodes(!showQRCodes)
            }
            className="flex w-full items-center justify-between p-5 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                📱
              </div>

              <div>
                <h2 className="text-lg font-semibold">
                  QR Scanners
                </h2>

                <p className="text-sm text-gray-500">
                  {
                    qrCodes.filter(
                      (qr) => qr.enabled
                    ).length
                  }{" "}
                  / {qrCodes.length} Active
                </p>
              </div>
            </div>

            <span className="text-xl">
              {showQRCodes ? "▲" : "▼"}
            </span>
          </button>

          {showQRCodes && (
            <div className="border-t px-5 pb-5 pt-4">
              <div className="space-y-3">
                {qrCodes.map((qr) => (
                  <div
                    key={qr.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                          📱
                        </div>

                        <div>
                          <p className="font-semibold">
                            {qr.name}
                          </p>

                          <p
                            className={`text-xs font-semibold ${
                              qr.enabled
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {qr.enabled
                              ? "Enabled"
                              : "Disabled"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          toggleQRCode(qr)
                        }
                        className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${
                          qr.enabled
                            ? "bg-red-600"
                            : "bg-green-600"
                        }`}
                      >
                        {qr.enabled
                          ? "Disable"
                          : "Enable"}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-col items-center rounded-lg bg-gray-50 p-4">
                      <QRCodeCanvas
                        id={`qr-${qr.id}`}
                        value={getQRUrl(qr)}
                        size={180}
                        level="H"
                        includeMargin
                      />

                      <p className="mt-2 text-center text-xs text-gray-500">
                        Scan karke menu open hoga
                      </p>

                      <div className="mt-3 flex gap-2">
                        <a
                          href={getQRUrl(qr)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border px-3 py-2 text-sm font-semibold"
                        >
                          Open QR
                        </a>

                        <button
                          onClick={() =>
                            downloadQR(qr)
                          }
                          className="rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white"
                        >
                          Download QR
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {qrCodes.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No QR scanners found.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ORDERS */}

        <div className="mb-6 rounded-xl bg-white shadow">
          <button
            onClick={() =>
              setShowOrders(!showOrders)
            }
            className="flex w-full items-center justify-between p-5 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                🧾
              </div>

              <div>
                <h2 className="text-lg font-semibold">
                  Orders
                </h2>

                <p className="text-sm text-gray-500">
                  {orders.length} order
                  {orders.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <span className="text-xl">
              {showOrders ? "▲" : "▼"}
            </span>
          </button>

          {showOrders && (
            <div className="border-t px-5 pb-5 pt-4">
              {orders.length === 0 ? (
                <div className="rounded-lg bg-gray-50 p-5 text-center text-sm text-gray-500">
                  No orders yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const items =
                      orderItems.filter(
                        (item) =>
                          item.order_id === order.id
                      );

                    return (
                      <div
                        key={order.id}
                        className={`rounded-xl border p-4 ${
                          order.cancelled
                            ? "border-red-200 bg-red-50"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-bold">
                              Order #{order.order_number}
                            </p>

                            <p className="mt-1 text-sm text-gray-500">
                              {new Date(
                                order.created_at
                              ).toLocaleString()}
                            </p>

                            <p className="mt-1 text-sm font-semibold text-blue-600">
                              {order.qr_name ||
                                "Direct Order"}
                            </p>

                            {order.cancelled && (
                              <p className="mt-2 inline-block rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white">
                                CANCELLED
                              </p>
                            )}
                          </div>

                          <p className="whitespace-nowrap text-lg font-bold">
                            {formatMoney(
                              order.total
                            )}
                          </p>
                        </div>

                        <div className="mt-4 space-y-2">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between gap-3 rounded-lg bg-gray-50 p-3"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold">
                                  {item.product_name}
                                </p>

                                <p className="text-sm text-gray-500">
                                  {formatMoney(
                                    item.price
                                  )}{" "}
                                  ×{" "}
                                  {item.quantity}
                                </p>
                              </div>

                              <p className="font-semibold">
                                {formatMoney(
                                  item.item_total
                                )}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex justify-between border-t pt-3 text-lg font-bold">
                          <span>Grand Total</span>

                          <span>
                            {formatMoney(
                              order.total
                            )}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            onClick={() =>
                              printBill(order)
                            }
                            className="rounded-lg bg-black p-3 font-semibold text-white"
                          >
                            🖨️ Print Bill
                          </button>

                          {!order.cancelled ? (
                            <button
                              onClick={() =>
                                cancelOrder(
                                  order.id
                                )
                              }
                              className="rounded-lg bg-red-600 p-3 font-semibold text-white"
                            >
                              Cancel Order
                            </button>
                          ) : (
                            <div className="flex items-center justify-center rounded-lg bg-red-100 p-3 text-sm font-bold text-red-700">
                              CANCELLED
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ADD / EDIT PRODUCT */}

        <div className="mb-6 rounded-xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-semibold">
            {editingId
              ? "Edit Menu Item"
              : "Add Menu Item"}
          </h2>

          <input
            className="mb-3 w-full rounded-lg border p-3"
            placeholder="Product name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
          />

          <input
            className="mb-3 w-full rounded-lg border p-3"
            placeholder="Price"
            type="number"
            min="0"
            value={price}
            onChange={(e) =>
              setPrice(e.target.value)
            }
          />

          <textarea
            className="mb-3 w-full rounded-lg border p-3"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
          />

          <select
            className="mb-3 w-full rounded-lg border bg-white p-3"
            value={categoryId}
            onChange={(e) =>
              setCategoryId(e.target.value)
            }
          >
            <option value="">
              Select Category
            </option>

            {categories.map((category) => (
              <option
                key={category.id}
                value={category.id}
              >
                {category.name}
              </option>
            ))}
          </select>

          <div className="mb-4">
            <p className="mb-2 font-medium">
              Product Photo
            </p>

            <label className="inline-block cursor-pointer rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">
              📷 Choose Photo

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file =
                    e.target.files?.[0] || null;

                  handleImageChange(file);
                }}
              />
            </label>

            <p className="mt-2 text-sm text-gray-500">
              Mobile: Gallery/Photos se photo select karein
              <br />
              Laptop: Computer se photo select karein
            </p>
          </div>

          {imagePreview && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium">
                Photo Preview
              </p>

              <img
                src={imagePreview}
                alt="Product preview"
                className="h-40 w-40 rounded-xl object-cover"
              />
            </div>
          )}

          <button
            onClick={saveProduct}
            disabled={saving}
            className="w-full rounded-lg bg-black p-3 font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Save Changes"
              : "+ Add Product"}
          </button>

          {editingId && (
            <button
              onClick={cancelEdit}
              className="mt-2 w-full rounded-lg border p-3 font-semibold"
            >
              Cancel
            </button>
          )}
        </div>

        {/* SEARCH */}

        <div className="mb-4 rounded-xl bg-white p-4 shadow">
          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="🔎 Search product or category..."
            className="w-full rounded-lg border p-3 outline-none focus:border-black"
          />

          {search.trim() && (
            <p className="mt-2 text-sm text-gray-500">
              {filteredProducts.length} product
              {filteredProducts.length !== 1
                ? "s"
                : ""}{" "}
              found
            </p>
          )}
        </div>

        {/* PRODUCT LIST */}

        <div className="space-y-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="rounded-xl bg-white p-4 shadow"
            >
              <div className="flex gap-4">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-24 w-24 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-center text-xs text-gray-500">
                    No Photo
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">
                    {product.name}
                  </h3>

                  <p className="text-gray-600">
                    ₹{product.price}
                  </p>

                  <p className="mt-1 text-sm font-medium text-blue-600">
                    {getCategoryName(
                      product.category_id
                    )}
                  </p>

                  {product.description && (
                    <p className="mt-1 text-sm text-gray-500">
                      {product.description}
                    </p>
                  )}

                  <p
                    className={`mt-1 text-sm font-semibold ${
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
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    startEdit(product)
                  }
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                >
                  Edit
                </button>

                {product.image_url && (
                  <button
                    onClick={() =>
                      removePhoto(product)
                    }
                    className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Remove Photo
                  </button>
                )}

                <button
                  onClick={() =>
                    deleteProduct(product.id)
                  }
                  className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white"
                >
                  Delete
                </button>

                <button
                  onClick={() =>
                    toggleAvailability(product)
                  }
                  className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${
                    product.available
                      ? "bg-green-600"
                      : "bg-gray-500"
                  }`}
                >
                  {product.available
                    ? "Available"
                    : "Unavailable"}
                </button>
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow">
              No products added yet.
            </div>
          )}

          {products.length > 0 &&
            filteredProducts.length === 0 && (
              <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow">
                No matching product found.
              </div>
            )}
        </div>
      </div>
    </main>
  );
}