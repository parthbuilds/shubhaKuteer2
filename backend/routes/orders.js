import express from "express";
import Razorpay from "razorpay";
import pool from "../utils/db.js";

// ⚠️ Make sure to set these environment variables in your .env file
// The error you were seeing was because these keys were not being loaded.
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const router = express.Router();

// 🔹 POST /api/orders/create-order
router.post("/create-order", async (req, res) => {
    const { amount, currency, receipt } = req.body;
    try {
        const order = await razorpay.orders.create({
            amount,
            currency,
            receipt,
        });
        res.status(201).json(order);
    } catch (err) {
        console.error("Razorpay error:", err);
        res.status(500).json({ message: "Payment gateway error ❌" });
    }
});

// 🔹 POST /api/orders/verify-payment
router.post("/verify-payment", (req, res) => {
    // Payment verification logic here
    // You may need to parse raw body for webhook verification
    res.json({ message: "Payment verification endpoint (implement logic)" });
});

// 🔹 GET /api/orders
router.get("/", async (req, res) => {
    try {
        const [orders] = await pool.query("SELECT * FROM orders ORDER BY id DESC");
        res.json({ success: true, orders });
    } catch (err) {
        console.error("DB error:", err);
        res.status(500).json({ success: false, message: "Database error" });
    }
});

// 🔹 DELETE /api/orders/:id
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query("DELETE FROM orders WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        res.json({ success: true, message: "Order deleted successfully" });
    } catch (err) {
        console.error("Delete order error:", err);
        res.status(500).json({ success: false, message: "Database error" });
    }
});

export default router;
