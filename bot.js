const TelegramBot = require('node-telegram-bot-api');

// ⚠️ Ganti dengan token bot kamu
const TOKEN = '8185460043:AAFKlFSdQ6nQe1J1NOUhWvTuWFb012_oSpQ';
const bot = new TelegramBot(TOKEN, { polling: true });

const users = new Map();
let waiting = [];

// Fungsi aman untuk kirim pesan
async function safeSendMessage(chatId, text, options = {}) {
  try {
    await bot.sendMessage(chatId, text, options);
  } catch (err) {
    handleSendError(err, chatId);
  }
}

// Fungsi aman untuk kirim media
async function safeSendMedia(type, chatId, ...args) {
  try {
    await bot[type](chatId, ...args);
  } catch (err) {
    handleSendError(err, chatId);
  }
}

// Penanganan error kirim
function handleSendError(err, chatId) {
  if (err.response && err.response.statusCode === 403) {
    console.warn(`⚠️ User ${chatId} telah memblokir bot. Menghapus dari daftar.`);
    users.delete(chatId);
    waiting = waiting.filter(id => id !== chatId);
  } else {
    console.error('❌ Error kirim pesan:', err.message);
  }
}

// 🔹 /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  users.set(chatId, { partner: null });

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '😄 Mulai Chat', callback_data: 'start_chat' }]],
    },
  };

  safeSendMessage(
    chatId,
    `👋 *Selamat datang di Anonymous Chat Bot!*\n\nTekan tombol di bawah untuk mulai mencari teman ngobrol anonim.\n\nKetik */help* untuk melihat panduan lengkap.`,
    options
  );
});

// 🔹 Callback tombol "Mulai Chat"
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  if (query.data === 'start_chat') {
    bot.answerCallbackQuery(query.id, { text: '🔍 Mencari partner...' });
    findPartner(chatId);
  }
});

// 🔹 /next dan /search
bot.onText(/\/next|\/search/, (msg) => {
  const chatId = msg.chat.id;
  findPartner(chatId);
});

// 🔹 /stop
bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;
  stopChat(chatId, true, false); // tidak otomatis cari partner baru
});

// 🔹 /help
bot.onText(/\/help/, (msg) => {
  const helpText = `
📚 *Panduan Anonymous Chat Bot*

Perintah yang tersedia:
• /start — Memulai bot
• /next atau /search — Ganti partner
• /stop — Hentikan chat atau pencarian
• /link — Kirim username kamu ke partner
• /help — Tampilkan panduan
• /support — Dukung bot dengan donasi
  `;
  safeSendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

// 🔹 /support
bot.onText(/\/support/, (msg) => {
  const chatId = msg.chat.id;
  safeSendMedia('sendPhoto', chatId, 'https://files.catbox.moe/mxovdq.jpg', {
    caption: '☕ Scan QR di atas untuk donasi. Terima kasih atas dukungannya!',
  });
});

// 🔹 /link
bot.onText(/\/link/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const partnerId = users.get(chatId)?.partner;

  if (!user.username) {
    return safeSendMessage(
      chatId,
      `⚠️ Kamu belum memiliki username Telegram.\nSilakan buat di *Pengaturan > Akun > Username*.`,
      { parse_mode: 'Markdown' }
    );
  }

  const usernameLink = `https://t.me/${user.username}`;

  if (!partnerId) {
    safeSendMessage(
      chatId,
      `🔗 Username kamu: [@${user.username}](${usernameLink})\nGunakan perintah ini saat sedang chatting.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    safeSendMessage(
      partnerId,
      `🔗 Partner kamu membagikan link Telegram-nya:\n👉 [@${user.username}](${usernameLink})`,
      { parse_mode: 'Markdown' }
    );
    safeSendMessage(chatId, `✅ Username kamu telah dikirim ke partner.`);
  }
});

// 🔹 Kirim pesan antar user
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (msg.text && msg.text.startsWith('/')) return;

  const user = users.get(chatId);
  if (!user) return;

  const partnerId = user.partner;
  if (partnerId && users.has(partnerId)) {
    forwardMessage(chatId, partnerId, msg);
  }
});

// 🔹 Fungsi mencari partner (acak)
function findPartner(chatId) {
  const user = users.get(chatId) || {};
  if (user.partner) stopChat(chatId, false);

  // Jika sedang menunggu, hapus dulu agar tidak duplikat
  waiting = waiting.filter(id => id !== chatId);

  if (waiting.length > 0) {
    // Pilih partner acak
    const randomIndex = Math.floor(Math.random() * waiting.length);
    const partnerId = waiting.splice(randomIndex, 1)[0];
    if (partnerId === chatId) return;

    users.set(chatId, { partner: partnerId });
    users.set(partnerId, { partner: chatId });

    safeSendMessage(chatId, `😺 Partner found!\n\n/next — cari baru\n/stop — hentikan chat`);
    safeSendMessage(partnerId, `😺 Partner found!\n\n/next — cari baru\n/stop — hentikan chat`);

    safeSendMessage(chatId, `👋 Kamu sudah terhubung! Mulai ngobrol sekarang.`);
    safeSendMessage(partnerId, `👋 Kamu sudah terhubung! Mulai ngobrol sekarang.`);
  } else {
    waiting.push(chatId);
    safeSendMessage(chatId, `🚀 Mencari partner...\nSilakan tunggu seseorang untuk terhubung.`);
  }
}

// 🔹 Fungsi menghentikan chat
function stopChat(chatId, notify = true, autoFind = false) {
  const user = users.get(chatId);
  if (!user) return;

  const partnerId = user.partner;
  waiting = waiting.filter(id => id !== chatId); // Hapus dari antrian

  if (partnerId && users.has(partnerId)) {
    users.set(partnerId, { partner: null });
    safeSendMessage(partnerId, `😞 Partner kamu menghentikan chat.`);
  }

  users.set(chatId, { partner: null });
  if (notify) safeSendMessage(chatId, `🙄 Kamu menghentikan chat.`);

  if (autoFind) {
    setTimeout(() => {
      safeSendMessage(chatId, `🔍 Mencari partner baru...`);
      findPartner(chatId);
    }, 1000);
  }
}

// 🔹 Fungsi meneruskan pesan
function forwardMessage(fromId, toId, msg) {
  try {
    if (msg.text) safeSendMessage(toId, msg.text);
    else if (msg.photo) safeSendMedia('sendPhoto', toId, msg.photo.at(-1).file_id, { caption: msg.caption || '' });
    else if (msg.video) safeSendMedia('sendVideo', toId, msg.video.file_id, { caption: msg.caption || '' });
    else if (msg.voice) safeSendMedia('sendVoice', toId, msg.voice.file_id);
    else if (msg.audio) safeSendMedia('sendAudio', toId, msg.audio.file_id);
    else if (msg.document) safeSendMedia('sendDocument', toId, msg.document.file_id, { caption: msg.caption || '' });
    else if (msg.sticker) safeSendMedia('sendSticker', toId, msg.sticker.file_id);
    else if (msg.video_note) safeSendMedia('sendVideoNote', toId, msg.video_note.file_id);
    else if (msg.animation) safeSendMedia('sendAnimation', toId, msg.animation.file_id, { caption: msg.caption || '' });
    else if (msg.location) safeSendMedia('sendLocation', toId, msg.location.latitude, msg.location.longitude);
    else if (msg.contact) safeSendMedia('sendContact', toId, msg.contact.phone_number, msg.contact.first_name);
  } catch (err) {
    handleSendError(err, toId);
  }
}

console.log('🤖 Bot is running...');
