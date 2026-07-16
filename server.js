require("dotenv").config();

const express = require("express");
const cors = require("cors");

// 1. IMPORT ROUTES & SERVICES
const trashRoutes = require("./routes/trashRoutes");
const authRoutes = require("./routes/authRoutes"); // Import auth routes
const supabase = require("./services/supabase");

// 2. INISIALISASI EXPRESS APP (APP LAHIR DI SINI)
const app = express();

// 3. MIDDLEWARE
app.use(cors());
app.use(express.json());

// 4. DAFTARKAN ROUTES
app.use("/api/trash", trashRoutes);
app.use("/api/auth", authRoutes); // <-- Aman karena diletakkan setelah "const app = express();"

// 5. ROOT ENDPOINT
app.get("/", async (req, res) => {
  const { data, error } = await supabase.from("devices").select("*");

  if (error) {
    return res.json(error);
  }

  res.json(data);
});

// 6. JALANKAN SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
