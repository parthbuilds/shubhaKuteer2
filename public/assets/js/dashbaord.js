document.addEventListener("DOMContentLoaded", () => {
    const userNameDisplay = document.getElementById("userName");
    const userEmailDisplay = document.getElementById("userEmail");

    // Dashboard Overview Elements (using new IDs)
    const awaitingPickupCountEl = document.getElementById("awaitingPickupCount");
    const cancelledOrdersCountEl = document.getElementById("cancelledOrdersCount");
    const totalOrdersCountEl = document.getElementById("totalOrdersCount");

    // Dashboard Recent Orders Table Body
    const recentOrdersTableBody = document.querySelector('.filter-item[data-item="dashboard"] .recent_order table tbody');

    // History Orders Tab Container
    const listOrderContainer = document.querySelector(".filter-item.tab_order .list_order");

    const isLoggedIn = localStorage.getItem("isLoggedIn");
    const storedUserName = localStorage.getItem("userName");
    const storedUserEmail = localStorage.getItem("userEmail");

    // Helper function to determine order status display text and class
    // This now strictly follows the timestamp logic for delivery statuses
    const getOrderStatusDisplay = (order) => {
        let statusText = "Pending";
        let statusClass = "bg-blue text-blue"; // Default: Payment Pending/Processing

        // Priority for status display
        if (order.canceled_at) { // Check for the new canceled_at timestamp
            statusText = "Cancelled";
            statusClass = "bg-red text-red";
        } else if (order.delivered_at) {
            statusText = "Delivered";
            statusClass = "bg-green text-green";
        } else if (order.out_for_delivery_at) {
            statusText = "Out for Delivery";
            statusClass = "bg-purple text-purple";
        } else if (order.status === "completed") {
            statusText = "Processing"; // Payment completed, awaiting shipment
            statusClass = "bg-yellow text-yellow"; // Using yellow for processing
        } else if (order.status === "pending") {
            statusText = "Payment Pending"; // Payment not yet captured/completed
            statusClass = "bg-gray text-gray";
        }

        return { statusText, statusClass };
    };

    // Function to fetch and render user orders
    async function fetchAndRenderUserOrders() {
        if (!storedUserEmail) {
            console.warn("No user email found for fetching orders. User might not be logged in.");
            if (listOrderContainer) listOrderContainer.innerHTML = "<p>Please log in to view your orders.</p>";
            if (recentOrdersTableBody) recentOrdersTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5">Please log in to view recent orders.</td></tr>';
            if (awaitingPickupCountEl) awaitingPickupCountEl.textContent = "0";
            if (cancelledOrdersCountEl) cancelledOrdersCountEl.textContent = "0";
            if (totalOrdersCountEl) totalOrdersCountEl.textContent = "0";
            return;
        }

        const apiOrdersUrl = "/api/orders";

        try {
            const response = await fetch(apiOrdersUrl);
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(`HTTP error! status: ${response.status} - ${err.error || response.statusText}`);
            }
            const data = await response.json();

            if (data.success && Array.isArray(data.orders)) {
                const allOrders = data.orders;
                console.log("All orders fetched from API:", data);

                const userOrders = allOrders.filter(
                    (order) => order.email === storedUserEmail
                ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Sort by most recent first
                console.log("Filtered and sorted orders for the current user:", userOrders);

                // Clear existing content before rendering
                if (listOrderContainer) listOrderContainer.innerHTML = "";
                if (recentOrdersTableBody) recentOrdersTableBody.innerHTML = "";

                if (userOrders.length > 0) {
                    // --- Populate Dashboard Overview Counts ---
                    let awaitingPickup = 0;
                    let cancelled = 0;
                    const total = userOrders.length;

                    userOrders.forEach(order => {
                        if (order.canceled_at) { // Use the new canceled_at timestamp
                            cancelled++;
                        } else if (order.status === 'completed' && !order.delivered_at && !order.out_for_delivery_at) {
                            // "Awaiting Pickup": payment completed, but not yet out for delivery or delivered
                            awaitingPickup++;
                        } else if (order.out_for_delivery_at && !order.delivered_at) {
                            // Also count as awaiting pickup if out for delivery but not yet delivered
                            awaitingPickup++;
                        }
                    });

                    if (awaitingPickupCountEl) awaitingPickupCountEl.textContent = awaitingPickup;
                    if (cancelledOrdersCountEl) cancelledOrdersCountEl.textContent = cancelled;
                    if (totalOrdersCountEl) totalOrdersCountEl.textContent = total;

                    // --- Populate History Orders Tab ---
                    if (listOrderContainer) {
                        userOrders.forEach((order) => {
                            const { statusText, statusClass } = getOrderStatusDisplay(order);

                            let productsHtml = "";
                            let showCancelButton = false;

                            // Determine if the cancel button should be shown
                            // Conditions: not yet delivered/out for delivery, and not already cancelled
                            if (
                                (order.status === "pending" || order.status === "completed") &&
                                !order.delivered_at &&
                                !order.out_for_delivery_at &&
                                !order.canceled_at
                            ) {
                                showCancelButton = true;
                            }

                            let productsArray = order.products;
                            if (typeof productsArray === "string") {
                                try {
                                    productsArray = JSON.parse(productsArray);
                                } catch (e) {
                                    console.error(`Error parsing products for order ${order.id}:`, e);
                                    productsArray = [];
                                }
                            }

                            if (Array.isArray(productsArray) && productsArray.length > 0) {
                                productsHtml = productsArray
                                    .map(
                                        (product) => `
                                            <div class="prd_item flex flex-wrap items-center justify-between gap-3 py-5 border-b border-line">
                                                <a href="product-default.html?id=${product.id || ""}" class="flex items-center gap-5">
                                                    <div class="bg-img flex-shrink-0 md:w-[100px] w-20 aspect-square rounded-lg overflow-hidden">
                                                        <img src="${product.image || "/assets/images/product/productDefault.png"}"
                                                            alt="${product.name || "Product Image"}"
                                                            class="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <div class="prd_name text-title">${product.name || "Unknown Product"}</div>
                                                        <div class="caption1 text-secondary mt-2">
                                                            ${product.size ? `<span class="prd_size uppercase">${product.size}</span>` : ""}
                                                            ${product.size && product.color ? `<span>/</span>` : ""}
                                                            ${product.color ? `<span class="prd_color capitalize">${product.color}</span>` : ""}
                                                        </div>
                                                    </div>
                                                </a>
                                                <div class="text-title">
                                                    <span class="prd_quantity">${product.quantity}</span>
                                                    <span> X </span>
                                                    <span class="prd_price">₹${parseFloat(product.price).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        `
                                    )
                                    .join("");
                            } else {
                                productsHtml = `<div class="prd_item py-5 text-secondary">No product details available for this order.</div>`;
                            }


                            listOrderContainer.innerHTML += `
                                <div class="order_item mt-5 border border-line rounded-lg box-shadow-xs" data-order-id="${order.id}">
                                    <div class="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-line">
                                        <div class="flex items-center gap-2">
                                            <strong class="text-title">Order Number:</strong>
                                            <strong class="order_number text-button uppercase">${order.id}</strong>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <strong class="text-title">Order status:</strong>
                                            <span class="tag px-4 py-1.5 rounded-full bg-opacity-10 ${statusClass} caption1 font-semibold">${statusText}</span>
                                        </div>
                                    </div>
                                    <div class="list_prd px-5">
                                        ${productsHtml}
                                    </div>
                                    <div class="flex flex-wrap gap-4 p-5">
                                        ${showCancelButton ?
                                            `<button class="button-main bg-red border border-line hover:bg-black text-white hover:text-white cancel-order-btn" data-order-id="${order.id}">Cancel Order</button>`
                                            : ''
                                        }
                                    </div>
                                </div>
                            `;
                        });

                        // Attach event listeners for cancel buttons AFTER they are added to the DOM
                        document.querySelectorAll(".cancel-order-btn").forEach((button) => {
                            button.addEventListener("click", handleCancelOrder);
                        });
                    }

                    // --- Populate Dashboard Recent Orders (e.g., top 3) ---
                    if (recentOrdersTableBody) {
                        const recentThreeOrders = userOrders.slice(0, 3); // Get the 3 most recent orders
                        if (recentThreeOrders.length === 0) {
                            recentOrdersTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5">No recent orders.</td></tr>';
                        } else {
                            recentThreeOrders.forEach((order) => {
                                let mainProduct = { name: "N/A", category: "N/A", image: "/assets/images/product/productDefault.png", id: "" };
                                let productsArray = order.products;
                                if (typeof productsArray === "string") {
                                    try {
                                        productsArray = JSON.parse(productsArray);
                                    } catch (e) {
                                        console.error(`Error parsing products for recent order ${order.id}:`, e);
                                        productsArray = [];
                                    }
                                }
                                if (Array.isArray(productsArray) && productsArray.length > 0) {
                                    mainProduct = productsArray[0];
                                }

                                const { statusText, statusClass } = getOrderStatusDisplay(order);

                                recentOrdersTableBody.innerHTML += `
                                    <tr class="item duration-300">
                                        <th scope="row" class="py-3 text-left">
                                            <strong class="text-title">${order.id}</strong>
                                        </th>
                                        <td class="py-3">
                                            <a href="product-default.html?id=${mainProduct.id || ""}" class="product flex items-center gap-3">
                                                <img src="${mainProduct.image || "/assets/images/product/productDefault.png"}"
                                                    alt="${mainProduct.name}"
                                                    class="flex-shrink-0 w-12 h-12 rounded" />
                                                <div class="info flex flex-col">
                                                    <strong class="product_name text-secondary">${mainProduct.name}</strong>
                                                    <span class="product_tag caption1 text-secondary">${mainProduct.category || "Category"}</span>
                                                </div>
                                            </a>
                                        </td>
                                        <td class="py-3 price">₹${parseFloat(order.amount).toFixed(2)}</td>
                                        <td class="py-3 text-right">
                                            <span class="tag px-4 py-1.5 rounded-full bg-opacity-10 ${statusClass} caption1 font-semibold">${statusText}</span>
                                        </td>
                                    </tr>
                                `;
                            });
                        }
                    }
                } else {
                    if (listOrderContainer) listOrderContainer.innerHTML = "<p>No orders found for this user.</p>";
                    if (recentOrdersTableBody) recentOrdersTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5">No recent orders.</td></tr>';
                    if (awaitingPickupCountEl) awaitingPickupCountEl.textContent = "0";
                    if (cancelledOrdersCountEl) cancelledOrdersCountEl.textContent = "0";
                    if (totalOrdersCountEl) totalOrdersCountEl.textContent = "0";
                    console.log("No orders found for the current user:", storedUserEmail);
                }
            } else {
                console.error("API response format error: 'success' flag is false or 'orders' is not an array.", data);
                if (listOrderContainer) listOrderContainer.innerHTML = "<p>Failed to process orders from the server.</p>";
            }
        } catch (error) {
            console.error("Error fetching or processing orders:", error);
            if (listOrderContainer) listOrderContainer.innerHTML = `<p>Failed to load orders: ${error.message}. Please try again later.</p>`;
        }
    } // End of fetchAndRenderUserOrders

    // Handle "Cancel Order" button click
    async function handleCancelOrder(event) {
        const button = event.target;
        const orderId = button.getAttribute("data-order-id");

        if (!orderId) {
            alert("Error: Order ID not found for cancel button.");
            return;
        }

        if (
            !confirm(
                `Are you sure you want to cancel Order #${orderId}? This action cannot be undone.`
            )
        ) {
            return;
        }

        button.disabled = true;
        button.textContent = "Canceling...";
        button.classList.add("opacity-50", "cursor-not-allowed");

        try {
            const res = await fetch(
                `/api/orders/cancel-order`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        // 'Authorization': `Bearer ${localStorage.getItem('userAuthToken')}` // Uncomment if needed
                    },
                    body: JSON.stringify({
                        order_id: orderId,
                        // Optionally send cancelled_at timestamp from frontend if backend isn't doing it automatically
                        // cancelled_at: new Date().toISOString()
                    }),
                }
            );

            if (!res.ok) {
                const errorData = await res
                    .json()
                    .catch(() => ({ message: "Unknown error" }));
                throw new Error(
                    errorData.message || `Failed to cancel order (status: ${res.status}).`
                );
            }

            const data = await res.json();
            alert(`Order #${orderId} has been successfully cancelled.`);
            console.log("Order cancelled response:", data);

            // Re-fetch and re-render all orders to update the UI
            await fetchAndRenderUserOrders();
        } catch (error) {
            console.error("Error cancelling order:", error);
            alert("Failed to cancel order: " + error.message);
            button.disabled = false;
            button.textContent = "Cancel Order";
            button.classList.remove("opacity-50", "cursor-not-allowed");
        }
    }

    // --- Load user profile and pre-fill Setting form ---
    async function loadUserProfile() {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            const res = await fetch("/api/user/profile", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            const user = data.user;

            if (user) {
                const firstNameEl = document.getElementById("firstName");
                const lastNameEl = document.getElementById("lastName");
                const phoneNumberEl = document.getElementById("phoneNumber");
                const settingEmailEl = document.getElementById("settingEmail");

                if (firstNameEl) firstNameEl.value = user.first_name || "";
                if (lastNameEl) lastNameEl.value = user.last_name || "";
                if (phoneNumberEl) phoneNumberEl.value = user.phone_number || "";
                if (settingEmailEl) settingEmailEl.value = user.email || "";
            }
        } catch (err) {
            console.error("Error loading user profile:", err);
        }
    }

    // --- Setting form submission (profile update + password change) ---
    const settingForm = document.getElementById("settingForm");
    if (settingForm) {
        settingForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const token = localStorage.getItem("token");
            const msgEl = document.getElementById("settingMessage");
            if (!token) {
                if (msgEl) { msgEl.textContent = "Please log in first."; msgEl.style.color = "red"; }
                return;
            }

            const submitBtn = settingForm.querySelector('button[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving..."; }
            if (msgEl) { msgEl.textContent = ""; }

            try {
                // 1. Update profile info
                const profileRes = await fetch("/api/user/profile", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        first_name: document.getElementById("firstName").value.trim(),
                        last_name: document.getElementById("lastName").value.trim(),
                        phone_number: document.getElementById("phoneNumber").value.trim(),
                        email: document.getElementById("settingEmail").value.trim()
                    })
                });
                const profileData = await profileRes.json();
                if (!profileRes.ok) throw new Error(profileData.message || "Failed to update profile.");

                // Update localStorage with new name/email
                const newName = `${document.getElementById("firstName").value.trim()} ${document.getElementById("lastName").value.trim()}`.trim();
                localStorage.setItem("userName", newName);
                localStorage.setItem("userEmail", document.getElementById("settingEmail").value.trim());
                if (userNameDisplay) userNameDisplay.textContent = newName;
                if (userEmailDisplay) userEmailDisplay.textContent = document.getElementById("settingEmail").value.trim();

                // 2. Change password if fields are filled
                const currentPwd = document.getElementById("currentPassword").value;
                const newPwd = document.getElementById("newPassword").value;
                const confirmPwd = document.getElementById("confirmPassword").value;

                if (currentPwd && newPwd) {
                    if (newPwd !== confirmPwd) {
                        if (msgEl) { msgEl.textContent = "Profile updated, but new passwords don't match."; msgEl.style.color = "orange"; }
                        return;
                    }
                    const pwdRes = await fetch("/api/user/password", {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            current_password: currentPwd,
                            new_password: newPwd,
                            confirm_new_password: confirmPwd
                        })
                    });
                    const pwdData = await pwdRes.json();
                    if (!pwdRes.ok) throw new Error(pwdData.message || "Failed to change password.");

                    // Clear password fields
                    document.getElementById("currentPassword").value = "";
                    document.getElementById("newPassword").value = "";
                    document.getElementById("confirmPassword").value = "";

                    if (msgEl) { msgEl.textContent = "Profile and password updated!"; msgEl.style.color = "green"; }
                } else {
                    if (msgEl) { msgEl.textContent = "Profile updated!"; msgEl.style.color = "green"; }
                }
            } catch (err) {
                console.error("Setting save error:", err);
                if (msgEl) { msgEl.textContent = err.message; msgEl.style.color = "red"; }
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Save Change"; }
            }
        });
    }

    // --- Address form submission (save to localStorage) ---
    const addressForm = document.getElementById("addressForm");
    if (addressForm) {
        // Load saved address from localStorage
        const savedAddress = JSON.parse(localStorage.getItem("shippingAddress") || "{}");
        const addressFields = ["shippingFirstName", "shippingLastName", "shippingCompany", "shippingCountry", "shippingStreet", "shippingCity", "shippingState", "shippingZip", "shippingPhone", "shippingEmail"];
        addressFields.forEach(id => {
            const el = document.getElementById(id);
            if (el && savedAddress[id]) el.value = savedAddress[id];
        });

        addressForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const addressData = {};
            addressFields.forEach(id => {
                const el = document.getElementById(id);
                if (el) addressData[id] = el.value.trim();
            });
            localStorage.setItem("shippingAddress", JSON.stringify(addressData));
            alert("Address saved successfully!");
        });
    }

    // --- Initial setup on DOMContentLoaded ---
    if (isLoggedIn === "true" && storedUserEmail) {
        if (userNameDisplay) userNameDisplay.textContent = storedUserName || "Guest User";
        if (userEmailDisplay) userEmailDisplay.textContent = storedUserEmail || "No Email";
        console.log("User is logged in. Loading orders...");
        fetchAndRenderUserOrders();
        loadUserProfile();
    } else {
        // Fallback for not logged in
        if (userNameDisplay) userNameDisplay.textContent = "";
        if (userEmailDisplay) userEmailDisplay.textContent = "";
        if (listOrderContainer) listOrderContainer.innerHTML = "Please log in to view your orders.";
        if (recentOrdersTableBody) recentOrdersTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5">Please log in to view recent orders.</td></tr>';
        if (awaitingPickupCountEl) awaitingPickupCountEl.textContent = "0";
        if (cancelledOrdersCountEl) cancelledOrdersCountEl.textContent = "0";
        if (totalOrdersCountEl) totalOrdersCountEl.textContent = "0";
        console.log("User is not logged in or email is not available in localStorage.");
    }

    // --- Tab Switching Logic (for main dashboard tabs) ---
    const tabItems = document.querySelectorAll(".menu-tab .category-item");
    const filterItems = document.querySelectorAll(".right .filter-item");

    tabItems.forEach((item) => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const targetTab = item.dataset.item;

            tabItems.forEach((tab) => tab.classList.remove("active"));
            filterItems.forEach((filter) => filter.classList.remove("active"));

            item.classList.add("active");
            document.querySelector(`.filter-item[data-item="${targetTab}"]`).classList.add("active");

            // Re-fetch orders when switching to the 'orders' or 'dashboard' tab if user is logged in
            if ((targetTab === "orders" || targetTab === "dashboard") && isLoggedIn === "true" && storedUserEmail) {
                fetchAndRenderUserOrders();
            }
        });
    });

    // --- Tab Switching Logic (for internal order tabs like All, Pending, Delivery) ---
    // (This part is commented out in your HTML, but keeping the JS for future use)
    const orderTabButtons = document.querySelectorAll(".tab_order .menu-tab .tab-item");
    const orderTabIndicator = document.querySelector(".tab_order .menu-tab .indicator");

    orderTabButtons.forEach((button, index) => {
        button.addEventListener("click", () => {
            orderTabButtons.forEach((btn) => btn.classList.remove("active"));
            button.classList.add("active");

            const buttonWidth = button.offsetWidth;
            const buttonLeft = button.offsetLeft;
            if (orderTabIndicator) {
                orderTabIndicator.style.width = `${buttonWidth}px`;
                orderTabIndicator.style.transform = `translateX(${buttonLeft}px)`;
            }

            const filterType = button.getAttribute("data-filter");
            console.log("Order tab clicked:", filterType || button.textContent.trim());

            // To implement this, you would need to modify fetchAndRenderUserOrders
            // to accept a filter parameter, or filter the 'userOrders' array here
            // before rendering.
        });
    });

    // Initialize indicator position for the initial active order tab
    const initialActiveOrderTab = document.querySelector(".tab_order .menu-tab .tab-item.active");
    if (initialActiveOrderTab && orderTabIndicator) {
        orderTabIndicator.style.width = `${initialActiveOrderTab.offsetWidth}px`;
        orderTabIndicator.style.transform = `translateX(${initialActiveOrderTab.offsetLeft}px)`;
    }
});