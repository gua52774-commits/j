const TelegramBot = require('node-telegram-bot-api');

// ⚠️ Ganti dengan token bot kamu
const TOKEN = '8185460043:AAFKlFSdQ6nQe1J1NOUhWvTuWFb012_oSpQ';
const bot = new TelegramBot(TOKEN, { polling: true });

// Menyimpan status user dan daftar tunggu
const users = new Map();
const waiting = [];

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

  bot.sendMessage(
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
  stopChat(chatId, true, true);
});

// 🔹 /help selalu aktif
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpText = `
📚 *Panduan Anonymous Chat Bot*

Berikut perintah yang bisa kamu gunakan:

• /start — Memulai bot
• /next atau /search — Ganti partner
• /stop — Menghentikan chat
• /link — Kirim username kamu agar partner bisa mengenalmu (opsional)
• /help — Menampilkan panduan ini
• /support — Dukung bot ini dengan donasi

💡 *Cara pakai:*
1. Ketik /start untuk memulai.
2. Tekan tombol "😄 Mulai Chat" untuk mencari partner anonim.
3. Jika ingin ganti orang, ketik /next.
4. Untuk berhenti, ketik /stop.
5. Jika ingin kenalan lebih jauh, ketik /link untuk mengirim username kamu ke partner.
  `;
  bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// 🔹 /support selalu aktif
bot.onText(/\/support/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendPhoto(
    chatId,
    'https://files.catbox.moe/mxovdq.jpg',
    {
      caption: '☕ Scan QR di atas untuk donasi. Terima kasih atas dukungannya!',
      parse_mode: 'Markdown',
    }
  );
});

// 🔹 /link selalu aktif
bot.onText(/\/link/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const partnerId = users.get(chatId)?.partner;

  if (!user.username) {
    bot.sendMessage(
      chatId,
      `⚠️ Kamu belum memiliki username Telegram.\nSilakan buat di *Pengaturan > Akun > Username*.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const usernameLink = `https://t.me/${user.username}`;

  if (!partnerId) {
    bot.sendMessage(
      chatId,
      `🔗 Username kamu: [@${user.username}](${usernameLink})\n💡 Gunakan perintah ini saat sedang chatting agar partner bisa melihat username kamu.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  bot.sendMessage(
    partnerId,
    `🔗 Partner kamu membagikan link Telegram-nya:\n👉 [@${user.username}](${usernameLink})`,
    { parse_mode: 'Markdown' }
  );
  bot.sendMessage(chatId, `✅ Username kamu telah dikirim ke partner.`);
});

// 🔹 Saat user kirim pesan biasa
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  // Abaikan command di sini
  if (msg.text && msg.text.startsWith('/')) return;

  const user = users.get(chatId);
  if (!user) return;

  const partnerId = user.partner;
  if (partnerId && users.has(partnerId)) {
    forwardMessage(chatId, partnerId, msg);
  }
});

// 🔹 Fungsi mencari partner
function findPartner(chatId) {
  const user = users.get(chatId) || {};

  if (user.partner) stopChat(chatId, false);

  if (waiting.length > 0) {
    const partnerId = waiting.shift();
    if (partnerId === chatId) return;

    users.set(chatId, { partner: partnerId });
    users.set(partnerId, { partner: chatId });

    // Pesan utama
    bot.sendMessage(chatId, `😺 Partner found!\n\n/next — find a new partner\n/stop — stop this chat`);
    bot.sendMessage(partnerId, `😺 Partner found!\n\n/next — find a new partner\n/stop — stop this chat`);

    // 🔹 Auto welcome message
    bot.sendMessage(chatId, `👋 Hai! Kamu sudah terhubung dengan partner anonimmu. Mulai ngobrol sekarang!`);
    bot.sendMessage(partnerId, `👋 Hai! Kamu sudah terhubung dengan partner anonimmu. Mulai ngobrol sekarang!`);

  } else {
    waiting.push(chatId);
    bot.sendMessage(chatId, `🚀 Mencari partner...\nSilakan tunggu seseorang untuk terhubung.`);
  }
}

// 🔹 Fungsi menghentikan chat
function stopChat(chatId, notify = true, autoFind = false) {
  const user = users.get(chatId);
  if (!user) return;

  const partnerId = user.partner;

  if (partnerId && users.has(partnerId)) {
    users.set(partnerId, { partner: null });
    bot.sendMessage(partnerId, `😞 Partner kamu telah menghentikan chat.\nMencarikan partner baru...`);
    findPartner(partnerId);
  }

  users.set(chatId, { partner: null });

  if (notify) bot.sendMessage(chatId, `🙄 Kamu menghentikan chat.`);

  if (autoFind) {
    setTimeout(() => {
      bot.sendMessage(chatId, `🔍 Mencari partner baru...`);
      findPartner(chatId);
    }, 1000);
  }
}

// 🔹 Fungsi meneruskan pesan
function forwardMessage(fromId, toId, msg) {
  try {
    if (msg.text) bot.sendMessage(toId, msg.text);
    else if (msg.photo) bot.sendPhoto(toId, msg.photo.at(-1).file_id, { caption: msg.caption || '' });
    else if (msg.video) bot.sendVideo(toId, msg.video.file_id, { caption: msg.caption || '' });
    else if (msg.voice) bot.sendVoice(toId, msg.voice.file_id);
    else if (msg.audio) bot.sendAudio(toId, msg.audio.file_id);
    else if (msg.document) bot.sendDocument(toId, msg.document.file_id, { caption: msg.caption || '' });
    else if (msg.sticker) bot.sendSticker(toId, msg.sticker.file_id);
    else if (msg.video_note) bot.sendVideoNote(toId, msg.video_note.file_id);
    else if (msg.animation) bot.sendAnimation(toId, msg.animation.file_id, { caption: msg.caption || '' });
    else if (msg.location) bot.sendLocation(toId, msg.location.latitude, msg.location.longitude);
    else if (msg.contact) bot.sendContact(toId, msg.contact.phone_number, msg.contact.first_name);
  } catch (err) {
    console.error('❌ Error forwarding message:', err.message);
  }
}

console.log('🤖 Bot is running...');