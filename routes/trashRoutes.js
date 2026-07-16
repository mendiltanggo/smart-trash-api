const express = require("express");
const router = express.Router();
const trashController = require("../controllers/trashController");

// 1. DATA SENSOR & DASHBOARD
router.post("/update", trashController.updateTrash);
router.get("/current/:id", trashController.getCurrent);
router.get("/history/:id", trashController.getHistory);
router.get("/device/:id", trashController.getDevice);

// 2. MANAJEMEN PERANGKAT (CRUD)
router.get("/devices", trashController.getAllDevices);
router.post("/devices", trashController.createDevice);
router.put("/devices/:id", trashController.updateDevice);
router.delete("/devices/:id", trashController.deleteDevice);

module.exports = router;
