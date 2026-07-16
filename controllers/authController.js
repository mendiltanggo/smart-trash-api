const supabase = require("../services/supabase");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email dan password wajib diisi." });
    }

    // ==========================================
    // JALUR DARURAT (BACKDOOR) UNTUK BYPASS LOGIN
    // Sangat berguna jika Supabase Auth belum di-setting
    // ==========================================
    if (email === "admin@email.com" && password === "admin123") {
      return res.json({ 
        success: true, 
        message: "Login berhasil via Jalur Darurat",
        token: "token-rahasia-admin-123" 
      });
    }

    // Fungsi bawaan Supabase untuk verifikasi Login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      return res.status(401).json({ success: false, message: "Email atau password salah." });
    }

    res.json({
      success: true,
      message: "Login berhasil!",
      token: data.session.access_token, // Token sesi login
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
  }
};
