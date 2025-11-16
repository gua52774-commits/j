const TelegramBot = require('node-telegram-bot-api');

// Token bot
const TOKEN = '8185460043:AAFKlFSdQ6nQe1J1NOUhWvTuWFb012_oSpQ';
const bot = new TelegramBot(TOKEN, { polling: true });

const users = new Map();
let waiting = [];

/* ============================================================
   FUNGSI CEK LINK
============================================================ */
function containsLink(text = "") {
  const regex = /(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i;
  return regex.test(text);
}

/* ============================================================
   FUNGSI AMAN KIRIM
============================================================ */
async function safeSendMessage(chatId, text, options = {}) {
  try {
    await bot.sendMessage(chatId, text, options);
  } catch (err) {
    handleSendError(err, chatId);
  }
}

async function safeSendMedia(method, chatId, ...args) {
  try {
    await bot[method](chatId, ...args);
  } catch (err) {
    handleSendError(err, chatId);
  }
}

function handleSendError(err, chatId) {
  if (err.response && err.response.statusCode === 403) {
    console.log(`⚠️ User ${chatId} memblokir bot. Menghapus dari daftar.`);
    users.delete(chatId);
    waiting = waiting.filter(id => id !== chatId);
    return;
  }
  console.error("❌ Send Error:", err.message);
}

/* ============================================================
   PERINTAH /START
============================================================ */
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  users.set(chatId, { partner: null });

  safeSendMessage(
    chatId,
    `👋 *Selamat datang di Anonymous Chat Bot!*\n\nTekan tombol di bawah untuk mulai mencari partner.`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "😄 Mulai Chat", callback_data: "start_chat" }]]
      }
    }
  );
});

bot.on("callback_query", (query) => {
  if (query.data === "start_chat") {
    bot.answerCallbackQuery(query.id, { text: "🔍 Sedang mencari partner..." });
    findPartner(query.message.chat.id);
  }
});

/* ============================================================
   PERINTAH /next, /stop, /help, /support, /link
============================================================ */
bot.onText(/\/next|\/search/, (msg) => findPartner(msg.chat.id));

bot.onText(/\/stop/, (msg) => {
  stopChat(msg.chat.id, true, false);
});

bot.onText(/\/help/, (msg) => {
  safeSendMessage(msg.chat.id,
`📚 *Panduan Anonymous Chat Bot*

/start — Memulai bot
/next — Cari partner baru
/stop — Hentikan chat
/link — Bagikan username kamu
/support — Dukung bot

Bot ini sepenuhnya anonim dan aman.`,
  { parse_mode: "Markdown" });
});

bot.onText(/\/support/, (msg) => {
  safeSendMedia("sendPhoto", msg.chat.id, "https://files.catbox.moe/mxovdq.jpg", {
    caption: "☕ Dukung bot ini dengan donasi!"
  });
});

bot.onText(/\/link/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const partnerId = users.get(chatId)?.partner;

  if (!user.username) {
    return safeSendMessage(chatId,
      "⚠️ Kamu belum memiliki username Telegram.",
      { parse_mode: "Markdown" }
    );
  }

  const link = `https://t.me/${user.username}`;

  if (!partnerId) {
    return safeSendMessage(chatId,
      `🔗 Username kamu: [@${user.username}](${link})`,
      { parse_mode: "Markdown" }
    );
  }

  safeSendMessage(partnerId,
    `🔗 Partner kamu mengirimkan username:\n[@${user.username}](${link})`,
    { parse_mode: "Markdown" }
  );

  safeSendMessage(chatId, "✅ Username berhasil dikirim ke partner.");
});

/* ============================================================
   HANDLE SEMUA PESAN (anti-link)
============================================================ */
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.text && msg.text.startsWith("/")) return;

  const user = users.get(chatId);
  if (!user) return;

  const partnerId = user.partner;
  if (!partnerId || !users.has(partnerId)) return;

  // 🔥 ANTI-LINK
  if (msg.text && containsLink(msg.text)) {
    return safeSendMessage(chatId,
      "❌ Link tidak diperbolehkan!\nKamu hanya boleh mengirim teks atau media.",
      { parse_mode: "Markdown" }
    );
  }

  forwardMessage(chatId, partnerId, msg);
});

/* ============================================================
   MENCARI PARTNER
============================================================ */
function findPartner(chatId) {
  const user = users.get(chatId);
  if (user?.partner) stopChat(chatId, false);

  waiting = waiting.filter(id => id !== chatId);

  if (waiting.length > 0) {
    const index = Math.floor(Math.random() * waiting.length);
    const partnerId = waiting.splice(index, 1)[0];

    if (partnerId === chatId) return;

    users.set(chatId, { partner: partnerId });
    users.set(partnerId, { partner: chatId });

    safeSendMessage(chatId, "😺 Partner ditemukan!\n/next — baru\n/stop — berhenti");
    safeSendMessage(partnerId, "😺 Partner ditemukan!\n/next — baru\n/stop — berhenti");
  } else {
    waiting.push(chatId);
    safeSendMessage(chatId, "🔍 Mencari partner...");
  }
}

/* ============================================================
   STOP CHAT
============================================================ */
function stopChat(chatId, notify = true) {
  const user = users.get(chatId);
  if (!user) return;

  const partnerId = user.partner;
  waiting = waiting.filter(id => id !== chatId);

  if (partnerId && users.has(partnerId)) {
    users.set(partnerId, { partner: null });
    safeSendMessage(partnerId, "😞 Partner meninggalkan chat.");
  }

  users.set(chatId, { partner: null });
  if (notify) safeSendMessage(chatId, "🙄 Kamu menghentikan chat.");
}

/* ============================================================
   FORWARD ALL MEDIA (super lengkap)
============================================================ */
function forwardMessage(fromId, toId, msg) {
  try {
    if (msg.text) safeSendMessage(toId, msg.text);
    else if (msg.photo) safeSendMedia("sendPhoto", toId, msg.photo.at(-1).file_id, { caption: msg.caption || "" });
    else if (msg.video) safeSendMedia("sendVideo", toId, msg.video.file_id, { caption: msg.caption || "" });
    else if (msg.animation) safeSendMedia("sendAnimation", toId, msg.animation.file_id, { caption: msg.caption || "" });
    else if (msg.voice) safeSendMedia("sendVoice", toId, msg.voice.file_id);
    else if (msg.audio) safeSendMedia("sendAudio", toId, msg.audio.file_id);
    else if (msg.document) safeSendMedia("sendDocument", toId, msg.document.file_id, { caption: msg.caption || "" });
    else if (msg.sticker) safeSendMedia("sendSticker", toId, msg.sticker.file_id);
    else if (msg.video_note) safeSendMedia("sendVideoNote", toId, msg.video_note.file_id);
    else if (msg.location) safeSendMedia("sendLocation", toId, msg.location.latitude, msg.location.longitude);
    else if (msg.contact) safeSendMedia("sendContact", toId, msg.contact.phone_number, msg.contact.first_name);
    else if (msg.poll) safeSendMedia("sendPoll", toId, msg.poll.question, msg.poll.options.map(o => o.text));
    else if (msg.venue) safeSendMedia("sendVenue", toId, msg.venue.location.latitude, msg.venue.location.longitude, msg.venue.title, msg.venue.address);
    else if (msg.invoice) safeSendMessage(toId, "⚠️ Invoice tidak dapat diteruskan.");
  } catch (err) {
    handleSendError(err, toId);
  }
}

/* ============================================================
   BOT READY
============================================================ */
console.log("🤖 Bot is running...");
