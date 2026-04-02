// nome-check.js
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const fs = require("fs");

// ================= CONFIG =================
const apiId = 25531373;
const apiHash = "b4351e2d05023dbc2b0929e17f721525";
const SESSION_FILE = "telegram.session";
const envSession = process.env.TELEGRAM_STRING_SESSION || "";
const fileSession = fs.existsSync(SESSION_FILE)
  ? fs.readFileSync(SESSION_FILE, "utf8").trim()
  : "";
const stringSession = new StringSession(envSession || fileSession);
const TARGET_GROUP = "paineljsisis";
const RESULT_BOT_USERNAME = "@FindexGrupo_Bot";
const LOG_FILE = "debug.log";
// =========================================

function log(msg, data = "") {
  const line = `[${new Date().toISOString()}] ${msg} ` + (data ? JSON.stringify(data) : "") + "\n";
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg, data || "");
}

let nomeAtual = null;
let linkEncontrado = false;
let timeoutId = null;

(async () => {
  log("🚀 Iniciando consulta (escutando grupo + privado)");

  const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

  await client.connect();
  const isAuthorized = await client.isUserAuthorized();
  if (!isAuthorized) {
    log("❌ Sessão do Telegram inválida ou expirada");
    console.log("ERROR_CODE: TELEGRAM_SESSION_INVALID");
    process.exit(2);
  }

  const savedSession = client.session.save();
  if (savedSession) {
    fs.writeFileSync(SESSION_FILE, savedSession, "utf8");
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
      const senderName = sender ? sender.username || sender.id.toString() : "Desconhecido";

      log("📩 Mensagem detectada", {
        chat_id: chatId,
        chat: chatTitle,
        sender: senderName,
        texto: msg.message ? msg.message.substring(0, 120) + "..." : "(sem texto)",
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
              if (btn.url.includes("api.fdxapis.us/temp/") || btn.url.includes("pastebin.sbs/view/")) {
                log("🎯 LINK FINAL ENCONTRADO via botão!", btn.url);
                console.log("LINK_FINAL:", btn.url);
                linkEncontrado = true;
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
          linkEncontrado = true;
          clearTimeout(timeoutId);
          process.exit(0);
        }
      }
    },
    new NewMessage({ incoming: true }),
  );
})();
