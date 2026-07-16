const axios = require("axios");

// Fungsi sekarang menerima dua argumen: message dan targetNumber
exports.sendWhatsApp = async (message, targetNumber) => {
  try {
    await axios.post(
      "https://api.fonnte.com/send",
      {
        target: targetNumber, // Menggunakan nomor yang dikirim secara dinamis
        message: message,
      },
      {
        headers: {
          Authorization: process.env.FONNTE_TOKEN, // Token tetap global untuk 1 akun Fonnte
        },
      },
    );

    console.log(`Pesan WhatsApp berhasil dikirim ke ${targetNumber}.`);
  } catch (err) {
    console.log(`Gagal mengirim WhatsApp ke ${targetNumber}`);
    console.log(err.response?.data || err.message);
  }
};
