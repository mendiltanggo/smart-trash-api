const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/login", authController.login);

// BARIS INI SANGAT KRUSIAL. JANGAN SAMPAI KETINGGALAN!
module.exports = router;
