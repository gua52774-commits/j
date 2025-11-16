const TelegramBot = require('node-telegram-bot-api');

// ⚠️ Token bot kamu
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
   FUNGSI KIRIM AMAN
============================================================ */
async function safeSendMessage(chatId, text, options = {}) {
  try {
    await bot.sendMessage(chatId, text, options);
  } catch (err) {
    console.error("Error send message:", err.message);
  }
}

async function safeSendMedia(type, chatId, ...args) {
  try {
    await bot[type](chatId, ...args);
  } catch (err) {
    console.error("Error send media:", err.message);
  }
}

/* ============================================================
   START COMMAND
============================================================ */
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  users.set(chatId, { partner: null, username: msg.from.username });

  safeSendMessage(chatId,
    `👋 *Selamat datang di Anonymous Chat Bot!*\n\nTekan tombol di bawah untuk mulai mencari partner.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: "😄 Mulai Chat", callback_data: "start_chat" }]]
      }
    }
  );
});

bot.on("callback_query", (query) => {
  if (query.data === "start_chat") {
    findPartner(query.message.chat.id);
  }
});

/* ============================================================
   COMMANDS
============================================================ */
bot.onText(/\/next|\/search/, (msg) => findPartner(msg.chat.id));
bot.onText(/\/stop/, (msg) => stopChat(msg.chat.id));

bot.onText(/\/help/, (msg) => {
  safeSendMessage(msg.chat.id,
    `📚 *Panduan Anonymous Chat Bot*\n\n• /start — mulai bot\n• /next — partner baru\n• /stop — berhenti chat\n• /link — melihat username partner`,
    { parse_mode: "Markdown" }
  );
});

/* ============================================================
   /link
============================================================ */
bot.onText(/\/link/, (msg) => {
  const chatId = msg.chat.id;
  const partnerId = users.get(chatId)?.partner;

  if (!partnerId) {
    safeSendMessage(chatId, "⚠️ Kamu belum terhubung dengan siapa pun.");
    return;
  }

  const partner = users.get(partnerId);

  if (!partner || !partner.username) {
    safeSendMessage(chatId, "Partner kamu tidak memiliki username.");
  } else {
    safeSendMessage(chatId, `Username partner kamu: *@${partner.username}*`, {
      parse_mode: "Markdown"
    });
  }
});

/* ============================================================
   HANDLE SEMUA PESAN
============================================================ */
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text?.startsWith("/")) return;

  const user = users.get(chatId);
  if (!user || !user.partner) return;

  const partnerId = user.partner;

  // Blokir link
  if (msg.text && containsLink(msg.text)) {
    safeSendMessage(chatId,
      "❌ Link tidak diperbolehkan! Kamu hanya boleh mengirim *username* (@username).",
      { parse_mode: "Markdown" }
    );
    return;
  }

  forwardMessage(chatId, partnerId, msg);
});

/* ============================================================
   FIND PARTNER
============================================================ */
function findPartner(chatId) {
  const user = users.get(chatId) || {};

  if (user.partner) stopChat(chatId);

  waiting = waiting.filter(id => id !== chatId);

  if (waiting.length > 0) {
    const partnerId = waiting.splice(0, 1)[0];
    if (partnerId === chatId) return;

    const userData = users.get(chatId);
    const partnerData = users.get(partnerId);

    users.set(chatId, { partner: partnerId, username: userData?.username });
    users.set(partnerId, { partner: chatId, username: partnerData?.username });

    const foundText =
`😺 *Partner ditemukan!*

/next — Cari partner baru
/stop — Stop chat

👋 Kamu sudah terhubung! Mulai ngobrol sekarang.`;

    safeSendMessage(chatId, foundText, { parse_mode: "Markdown" });
    safeSendMessage(partnerId, foundText, { parse_mode: "Markdown" });

  } else {
    waiting.push(chatId);
    safeSendMessage(chatId, "🔍 Mencari partner...");
  }
}

/* ============================================================
   STOP CHAT
============================================================ */
function stopChat(chatId) {
  const user = users.get(chatId);
  if (!user) return;

  const partnerId = user.partner;

  waiting = waiting.filter(id => id !== chatId);

  if (partnerId && users.has(partnerId)) {
    users.set(partnerId, { partner: null });
    safeSendMessage(partnerId, "😞 Partner meninggalkan chat.");
  }

  users.set(chatId, { partner: null });
  safeSendMessage(chatId, "🙄 Kamu menghentikan chat.");
}

/* ============================================================
   FORWARD MESSAGE (FULL FIXED)
============================================================ */
async function forwardMessage(fromId, toId, msg) {
  let replyId = null;

  if (msg.reply_to_message) {
    replyId = msg.reply_to_message.forwarded_msg_id || null;
  }

  let sent;

  if (msg.text) {
    sent = await bot.sendMessage(toId, msg.text, {
      reply_to_message_id: replyId
    });
  }

  else if (msg.photo) {
    sent = await bot.sendPhoto(toId, msg.photo.at(-1).file_id, {
      caption: msg.caption || "",
      reply_to_message_id: replyId
    });
  }

  else if (msg.video) {
    sent = await bot.sendVideo(toId, msg.video.file_id, {
      caption: msg.caption || "",
      reply_to_message_id: replyId
    });
  }

  else if (msg.animation) {
    sent = await bot.sendAnimation(toId, msg.animation.file_id, {
      caption: msg.caption || "",
      reply_to_message_id: replyId
    });
  }

  else if (msg.sticker) {
    sent = await bot.sendSticker(toId, msg.sticker.file_id, {
      reply_to_message_id: replyId
    });
  }

  else if (msg.voice) {
    sent = await bot.sendVoice(toId, msg.voice.file_id, {
      reply_to_message_id: replyId
    });
  }

  else if (msg.audio) {
    sent = await bot.sendAudio(toId, msg.audio.file_id, {
      caption: msg.caption || "",
      reply_to_message_id: replyId
    });
  }

  else if (msg.document) {
    sent = await bot.sendDocument(toId, msg.document.file_id, {
      caption: msg.caption || "",
      reply_to_message_id: replyId
    });
  }

  else if (msg.video_note) {
    sent = await bot.sendVideoNote(toId, msg.video_note.file_id, {
      reply_to_message_id: replyId
    });
  }

  else if (msg.location) {
    sent = await bot.sendLocation(
      toId,
      msg.location.latitude,
      msg.location.longitude,
      { reply_to_message_id: replyId }
    );
  }

  if (sent) {
    msg.forwarded_msg_id = sent.message_id;
  }
}

/* ============================================================
   BOT READY
============================================================ */
console.log("🤖 Bot berjalan...");
