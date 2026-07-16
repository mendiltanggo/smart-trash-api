require("dotenv").config();

const express = require("express");
const cors = require("cors");

// 1. IMPORT ROUTES & SERVICES
const trashRoutes = require("./routes/trashRoutes");
const authRoutes = require("./routes/authRoutes"); // Import auth routes
const supabase = require("./services/supabase");

// 2. INISIALISASI EXPRESS APP (APP LAHIR DI SINI)
const app = express();

// 3. MIDDLEWARE (PENGATURAN CORS BARU)
const corsOptions = {
  origin: [
    'http://localhost:5500', 
    'http://127.0.0.1:5500', 
    'https://smart-trash-dashboard.netlify.app' // <--- GANTI DENGAN LINK NETLIFY ASLI KAMU (tanpa garis miring di akhir)
  ]
};
app.use(cors());
app.use(express.json());

// 4. DAFTARKAN ROUTES
app.use("/api/trash", trashRoutes);
app.use("/api/auth", authRoutes); 

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
  console.log(`Server berjalan di port ${PORT}`);
});
