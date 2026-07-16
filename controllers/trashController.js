const supabase = require("../services/supabase");
const whatsapp = require("../services/whatsappService");

// ==========================================
// 1. UPDATE DATA SENSOR DARI ESP32
// ==========================================
exports.updateTrash = async (req, res) => {
  try {
    const {
      device_code,
      jarak_objek,
      jarak_sampah,
      status_tutup,
      status_sampah,
      persentase,
      heartbeat = false,
    } = req.body;

    if (
      !device_code ||
      jarak_objek === undefined ||
      jarak_sampah === undefined ||
      !status_tutup ||
      !status_sampah ||
      persentase === undefined
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Data tidak lengkap." });
    }

    const { data: currentData } = await supabase
      .from("current_status")
      .select("status_sampah")
      .eq("device_code", device_code)
      .single();
    const statusLama = currentData ? currentData.status_sampah : null;

    const { error: currentError } = await supabase
      .from("current_status")
      .upsert({
        device_code,
        jarak_objek,
        jarak_sampah,
        status_tutup,
        status_sampah,
        persentase,
        uploaded_at: new Date().toISOString(),
      });
    if (currentError)
      return res
        .status(500)
        .json({ success: false, error: currentError.message });

    if (heartbeat)
      return res.json({ success: true, message: "Heartbeat diterima" });

    const { error: logError } = await supabase.from("sensor_logs").insert([
      {
        device_code,
        jarak_objek,
        jarak_sampah,
        status_tutup,
        status_sampah,
        persentase,
      },
    ]);
    if (logError)
      return res.status(500).json({ success: false, error: logError.message });

    // KIRIM WHATSAPP
    if (statusLama !== "Penuh" && status_sampah === "Penuh") {
      const { data: devInfo } = await supabase
        .from("devices")
        .select("nama, lokasi, wa_target")
        .eq("device_code", device_code)
        .single();
      const targetWA = devInfo?.wa_target || process.env.WA_TARGET;

      if (targetWA) {
        const pesan = `*⚠️ PERINGATAN TONG SAMPAH PENUH*\n\n📍 *Lokasi:* ${devInfo?.nama || device_code} (${devInfo?.lokasi || "-"}) \n📟 *ID Perangkat:* ${device_code}\n🗑️ *Kapasitas:* ${persentase}%\n\nSegera lakukan pengosongan sampah.`;
        await whatsapp.sendWhatsApp(pesan, targetWA);
      }
    }

    res.json({ success: true, message: "Perubahan berhasil disimpan." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ==========================================
// 2. DATA DASHBOARD
// ==========================================
exports.getCurrent = async (req, res) => {
  const { data, error } = await supabase
    .from("current_status")
    .select("*")
    .eq("device_code", req.params.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.getHistory = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const search = req.query.search || ""; // Menangkap kata kunci

  let query = supabase
    .from("sensor_logs")
    .select("*", { count: "exact" })
    .eq("device_code", req.params.id)
    .order("created_at", { ascending: false });

  // Jika ada kata kunci pencarian
  if (search) {
    if (!isNaN(search)) {
      // Jika yang diketik angka, cari berdasarkan persentase
      query = query.eq("persentase", parseInt(search));
    } else {
      // Jika yang diketik teks, cari berdasarkan status tutup atau sampah
      query = query.or(
        `status_tutup.ilike.%${search}%,status_sampah.ilike.%${search}%`,
      );
    }
  }

  const { data, count, error } = await query.range(
    (page - 1) * limit,
    page * limit - 1,
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, count });
};

exports.getDevice = async (req, res) => {
  const { data: device, error } = await supabase
    .from("devices")
    .select("*")
    .eq("device_code", req.params.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const { data: current } = await supabase
    .from("current_status")
    .select("uploaded_at")
    .eq("device_code", req.params.id)
    .single();
  const selisih = current
    ? (new Date() - new Date(current.uploaded_at)) / 1000
    : 999;

  res.json({
    ...device,
    esp32: selisih <= 30,
    wifi: selisih <= 30,
    server: true,
    database: true,
    whatsapp: true,
    last_update: current ? current.uploaded_at : null,
  });
};

// ==========================================
// 3. CRUD MANAJEMEN PERANGKAT
// ==========================================
exports.getAllDevices = async (req, res) => {
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

exports.createDevice = async (req, res) => {
  const { device_code, nama, lokasi, wa_target } = req.body;

  if (!device_code || !nama) {
    return res
      .status(400)
      .json({ success: false, message: "Device code dan nama wajib diisi." });
  }

  // MENGIRIMKAN STATUS BOOLEAN (true)
  const { error } = await supabase.from("devices").insert([
    {
      device_code,
      nama,
      lokasi,
      wa_target,
      status: true, // <--- UBAH DI SINI: Gunakan true tanpa tanda kutip
    },
  ]);

  if (error)
    return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, message: "Perangkat berhasil ditambahkan." });
};

exports.updateDevice = async (req, res) => {
  const { error } = await supabase
    .from("devices")
    .update(req.body)
    .eq("device_code", req.params.id);
  if (error)
    return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, message: "Berhasil diperbarui" });
};

exports.deleteDevice = async (req, res) => {
  const { error } = await supabase
    .from("devices")
    .delete()
    .eq("device_code", req.params.id);
  if (error)
    return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, message: "Berhasil dihapus" });
};
