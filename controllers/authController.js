const supabase = require("../services/supabase");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email dan password wajib diisi." });
    }

    // Fungsi bawaan Supabase untuk verifikasi Login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      return res
        .status(401)
        .json({ success: false, message: "Email atau password salah." });
    }

    res.json({
      success: true,
      message: "Login berhasil!",
      token: data.session.access_token, // Token sesi login
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
