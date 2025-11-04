import "dotenv/config";
import fs from "fs";
import { Telegraf, Markup } from "telegraf";

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || "");

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error("❌ BOT_TOKEN или ADMIN_CHAT_ID не заданы в .env");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 9_000_000 });

// ===== Файлы =====
const DATA_DIR = "./data";
const ORDERS_FILE = `${DATA_DIR}/orders.json`;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]", "utf8");

const loadOrders = () => {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
  } catch {
    return [];
  }
};
const saveOrders = (orders) =>
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf8");

// ===== Тексты =====
const RU_BTN = "Русский";
const EN_BTN = "English";

const T = {
  ru: {
    chooseLang: "🌍 Выберите язык:",
    langSaved: "✅ Язык сохранён: Русский",
    start: "Привет! Это демо бот-услуг Arr0w.\nВыберите действие:",
    menuShop: "💼 Каталог услуг",
    menuHelp: "ℹ️ О боте",
    back: "🔙 Назад",
    catalogTitle: "💼 Каталог услуг:",
    productCard: (p) =>
      `*${p.name_ru}*\nЦена: *${p.price} ${p.currency}*\n\n${p.desc_ru}`,
    buyBtn: "📝 Оформить заказ",
    askName: "✍️ Введите ваше имя:",
    askPhone: "📱 Введите номер телефона (только цифры):",
    invalidPhone: "❌ Номер должен содержать только цифры. Попробуйте ещё раз:",
    orderConfirmed: (p, name, phone) =>
      `✅ Заявка оформлена!\n\nУслуга: *${p.name_ru}*\nЦена: *${p.price} ${p.currency}*\nИмя: *${name}*\nТелефон: *${phone}*\n\nМы свяжемся с вами для уточнения деталей 👌`,
    adminOrder: (p, name, phone, chatId) =>
      `🆕 Новая заявка на услугу\n\nУслуга: ${p.name_ru}\nЦена: ${p.price} ${p.currency}\nИмя: ${name}\nТелефон: ${phone}\nchatId: ${chatId}`,
    help: "Это демо бот-услуг по разработке Telegram-ботов для портфолио.\n\nКоманды:\n/start — начать\n/help — помощь",
    unknown: "Не понял команду. Используйте меню ниже 👇",
  },
  en: {
    chooseLang: "🌍 Choose language:",
    langSaved: "✅ Language set: English",
    start: "Hi! This is Arr0w demo services bot.\nChoose an action:",
    menuShop: "💼 Services catalog",
    menuHelp: "ℹ️ About bot",
    back: "🔙 Back",
    catalogTitle: "💼 Services catalog:",
    productCard: (p) =>
      `*${p.name_en}*\nPrice: *${p.price} ${p.currency}*\n\n${p.desc_en}`,
    buyBtn: "📝 Order service",
    askName: "✍️ Enter your name:",
    askPhone: "📱 Enter your phone number (digits only):",
    invalidPhone: "❌ Phone must contain digits only. Try again:",
    orderConfirmed: (p, name, phone) =>
      `✅ Request received!\n\nService: *${p.name_en}*\nPrice: *${p.price} ${p.currency}*\nName: *${name}*\nPhone: *${phone}*\n\nWe will contact you to clarify the details 👌`,
    adminOrder: (p, name, phone, chatId) =>
      `🆕 New service request\n\nService: ${p.name_en}\nPrice: ${p.price} ${p.currency}\nName: ${name}\nPhone: ${phone}\nchatId: ${chatId}`,
    help: "This is a demo services bot (Telegram bots development) for portfolio.\n\nCommands:\n/start — start\n/help — help",
    unknown: "I didn't understand. Use the menu below 👇",
  },
};
// ===== Каталог услуг (тарифы ботов) =====
const PRODUCTS = [
  {
    id: "bot_base",
    price: 300,
    currency: "€",
    name_ru: "Базовый Telegram-бот",
    desc_ru:
      "Простой бот с меню и командами: ответы на частые вопросы, базовые формы (заявка/обратная связь), без сложных интеграций.",
    name_en: "Base Telegram bot",
    desc_en:
      "Simple bot with menu and commands: FAQ answers, basic forms (request/contact), no complex integrations.",
  },
  {
    id: "bot_pro",
    price: 800,
    currency: "€",
    name_ru: "Продвинутый Telegram-бот",
    desc_ru:
      "Многошаговые сценарии, сохранение данных, интеграции (например, Google Sheets/Calendar), простая админ-логика.",
    name_en: "Pro Telegram bot",
    desc_en:
      "Multi-step flows, data storage, integrations (e.g. Google Sheets/Calendar), basic admin logic.",
  },
  {
    id: "bot_business",
    price: 2000,
    currency: "€",
    name_ru: "Бизнес-решение под ключ",
    desc_ru:
      "Полноценный бот под бизнес: продуманная архитектура, интеграции с внешними сервисами, деплой на Render, сопровождение на старте.",
    name_en: "Business solution (full)",
    desc_en:
      "Full business bot: solid architecture, integrations with external services, deployment to Render, onboarding support.",
  },
];
const findProduct = (id) => PRODUCTS.find((p) => p.id === id);

// ===== Состояния пользователей =====
const userLang = new Map(); // chatId -> 'ru' | 'en'
const userState = new Map(); // chatId -> { step, productId, name, phone }

const getLang = (ctx) => userLang.get(ctx.chat.id) || "ru";

const mainMenu = (lang) =>
  Markup.keyboard([[T[lang].menuShop, T[lang].menuHelp]]).resize();

// ===== /start =====
bot.start(async (ctx) => {
  await ctx.reply(
    T.ru.chooseLang,
    Markup.keyboard([[RU_BTN, EN_BTN]]).resize()
  );
});

// ===== выбор языка =====
bot.hears([RU_BTN, EN_BTN], async (ctx) => {
  const text = ctx.message.text;
  const lang = text === EN_BTN ? "en" : "ru";
  userLang.set(ctx.chat.id, lang);

  await ctx.reply(T[lang].langSaved, mainMenu(lang));
  await ctx.reply(T[lang].start, mainMenu(lang));
});

// ===== /help =====
bot.help(async (ctx) => {
  const lang = getLang(ctx);
  await ctx.reply(T[lang].help, mainMenu(lang));
});

// ===== Каталог =====
async function showCatalog(ctx) {
  const lang = getLang(ctx);
  const rows = PRODUCTS.map((p) => {
    const title =
      lang === "ru"
        ? `${p.name_ru} · ${p.price} ${p.currency}`
        : `${p.name_en} · ${p.price} ${p.currency}`;
    return [Markup.button.callback(title, `prod_${p.id}`)];
  });

  await ctx.reply(T[lang].catalogTitle, Markup.inlineKeyboard(rows));
}

// Кнопка "Каталог" / "Shop"
bot.hears(
  (text, ctx) => {
    const lang = getLang(ctx);
    return (
      text === T[lang].menuShop ||
      text === T.ru.menuShop ||
      text === T.en.menuShop
    );
  },
  async (ctx) => showCatalog(ctx)
);

// Кнопка "О боте"
bot.hears(
  (text, ctx) => {
    const lang = getLang(ctx);
    return (
      text === T[lang].menuHelp ||
      text === T.ru.menuHelp ||
      text === T.en.menuHelp
    );
  },
  async (ctx) => {
    const lang = getLang(ctx);
    await ctx.reply(T[lang].help, mainMenu(lang));
  }
);

// ===== callback: выбор товара =====
bot.action(/^prod_(.+)$/, async (ctx) => {
  const lang = getLang(ctx);
  const productId = ctx.match[1];
  const p = findProduct(productId);
  if (!p) {
    await ctx.answerCbQuery("Товар не найден");
    return;
  }

  await ctx.answerCbQuery();

  await ctx.replyWithMarkdown(
    T[lang].productCard(p),
    Markup.inlineKeyboard([
      [Markup.button.callback(T[lang].buyBtn, `buy_${p.id}`)],
    ])
  );
});

// ===== callback: покупка товара =====
bot.action(/^buy_(.+)$/, async (ctx) => {
  const lang = getLang(ctx);
  const productId = ctx.match[1];
  const p = findProduct(productId);
  if (!p) {
    await ctx.answerCbQuery("Товар не найден");
    return;
  }

  await ctx.answerCbQuery();

  userState.set(ctx.chat.id, {
    step: "name",
    productId,
    name: "",
    phone: "",
  });

  await ctx.reply(T[lang].askName, mainMenu(lang));
});

// ===== обработка текста по шагам =====
bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const lang = getLang(ctx);
  const state = userState.get(chatId);

  const text = ctx.message.text.trim();

  // если нет активного шага — просто игнор / показать меню
  if (!state || !state.step) {
    // /start уже обрабатывается отдельно, тут просто подстрахуемся:
    if (text.startsWith("/")) return;
    await ctx.reply(T[lang].unknown, mainMenu(lang));
    return;
  }

  if (state.step === "name") {
    state.name = text;
    state.step = "phone";
    userState.set(chatId, state);
    return ctx.reply(T[lang].askPhone, mainMenu(lang));
  }

  if (state.step === "phone") {
    if (!/^\d+$/.test(text)) {
      return ctx.reply(T[lang].invalidPhone);
    }
    state.phone = text;

    const p = findProduct(state.productId);
    if (!p) {
      userState.delete(chatId);
      return ctx.reply("❌ Ошибка: товар не найден. Попробуйте ещё раз.");
    }

    // Сохраняем заказ
    const orders = loadOrders();
    const order = {
      id: Date.now(),
      chatId: String(chatId),
      productId: p.id,
      productName_ru: p.name_ru,
      productName_en: p.name_en,
      price: p.price,
      currency: p.currency,
      name: state.name,
      phone: state.phone,
      createdAt: new Date().toISOString(),
    };
    orders.push(order);
    saveOrders(orders);

    // Сообщение пользователю
    await ctx.replyWithMarkdown(
      T[lang].orderConfirmed(p, state.name, state.phone),
      mainMenu(lang)
    );

    // Уведомление админу
    await ctx.telegram.sendMessage(
      ADMIN_CHAT_ID,
      T[lang].adminOrder(p, state.name, state.phone, chatId)
    );

    userState.delete(chatId);
    return;
  }
});

// ===== Запуск =====
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

bot.launch().then(() => {
  console.log("✅ Arr0w-shop-bot is running…");
});
