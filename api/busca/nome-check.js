const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const path = require("path");
const fs = require("fs");

const apiId = Number(process.env.TELEGRAM_API_ID || "25531373");
const apiHash = process.env.TELEGRAM_API_HASH || "b4351e2d05023dbc2b0929e17f721525";
const TARGET_GROUP = process.env.TELEGRAM_TARGET_GROUP || "paineljsisis";
const LOG_FILE = path.join(__dirname, "debug.log");
const SESSION_FILE = path.join(__dirname, "telegram.session");

function readSessionString() {
  const fromEnv = process.env.TELEGRAM_STRING_SESSION?.trim();
  if (fromEnv) return fromEnv;

  if (fs.existsSync(SESSION_FILE)) {
    const fromFile = fs.readFileSync(SESSION_FILE, "utf8").trim();
    if (fromFile) return fromFile;
  }

  return "";
}

function log(msg, data = "") {
  const line = `[${new Date().toISOString()}] ${msg} ` + (data ? JSON.stringify(data) : "") + "\n";
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg, data || "");
}

let nomeAtual = null;
let timeoutId = null;

(async () => {
  log("🚀 Iniciando consulta (JSON-only / Telegram session)");

  const sessionValue = readSessionString();
  if (!sessionValue) {
    log("❌ Sessão Telegram ausente (TELEGRAM_STRING_SESSION/telegram.session)");
    console.log("TELEGRAM_SESSION_INVALID: sessão ausente");
    process.exit(2);
  }

  const stringSession = new StringSession(sessionValue);
  const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

  await client.connect();
  const authorized = await client.isUserAuthorized();
  if (!authorized) {
    log("❌ Sessão Telegram inválida ou expirada");
    console.log("TELEGRAM_SESSION_INVALID: sessão inválida/expirada");
    await client.disconnect();
    process.exit(2);
  }

  log("✅ Sessão Telegram válida");

  nomeAtual = process.argv.slice(2).join(" ").trim();
  if (!nomeAtual) {
    log("❌ Nome não informado");
    process.exit(1);
  }

  log("Nome para consultar:", nomeAtual);

  await client.sendMessage(TARGET_GROUP, { message: `/nome ${nomeAtual}` });
  log("📤 Comando enviado para o grupo:", TARGET_GROUP);

  timeoutId = setTimeout(() => {
    log("⌛ Timeout: nenhum link encontrado em 90 segundos");
    process.exit(1);
  }, 90000);

  client.addEventHandler(
    async (event) => {
      const msg = event.message;
      if (!msg) return;

      const chat = await msg.getChat();
      const chatId = chat.id.toString();
      const chatTitle = chat.title || chat.username || chat.firstName || "Chat privado";

      const sender = await msg.getSender();
      const senderName = sender ? (sender.username || sender.id.toString()) : "Desconhecido";

      log("📩 Mensagem detectada", {
        chat_id: chatId,
        chat: chatTitle,
        sender: senderName,
        texto: msg.message ? msg.message.substring(0, 120) + "..." : "(sem texto)"
      });

      if (msg.buttons?.length) {
        for (const row of msg.buttons) {
          for (const btn of row) {
            log("🔘 Botão encontrado", { texto: btn.text, url: btn.url || "(sem url)" });

            if (
              (btn.text?.toLowerCase().includes("abrir resultado") ||
               btn.text?.toLowerCase().includes("ver resultado") ||
               btn.text?.toLowerCase().includes("resultado completo")) &&
              btn.url
            ) {
              if (
                btn.url.includes("api.fdxapis.us/temp/") ||
                btn.url.includes("pastebin.sbs/view/")
              ) {
                log("🎯 LINK FINAL ENCONTRADO via botão!", btn.url);
                console.log("LINK_FINAL:", btn.url);
                clearTimeout(timeoutId);
                process.exit(0);
              }
            }
          }
        }
      }

      if (msg.message) {
        const regexLink = /https?:\/\/(?:api\.fdxapis\.us\/temp\/|pastebin\.sbs\/view\/)[A-Za-z0-9\-]+/g;
        const matches = msg.message.match(regexLink);
        if (matches) {
          const link = matches[0];
          log("🎯 LINK FINAL ENCONTRADO no texto!", link);
          console.log("LINK_FINAL:", link);
          clearTimeout(timeoutId);
          process.exit(0);
        }
      }
    },
    new NewMessage({ incoming: true })
  );
})();