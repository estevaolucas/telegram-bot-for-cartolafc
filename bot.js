require('dotenv').config();

var CartolaFC = require('./cartolafc'),
  BotController = require('./bot_controller'),
  request = require('request'),
  Promise = require('promise'),
  cartola_token;

let cartola = new CartolaFC();

cartola.fetchBasicData({
  email: process.env.CARTOLA_USER,
  password: process.env.CARTOLA_PASS
}).then(() => {
  let botController = new BotController(process.env.TELEGRAM_BOT_TOKEN);

  cartola.setTelegramBot(botController.bot);

  // COMMANDS
  botController.registerRoutes({
    // Team
    '^/time (.+)$': (message, match) => {
      cartola.teamCommand(message, match);
    },
    // League
    '^/liga (.+)$': (message, match) => {
      cartola.leagueCommand(message, match);
    },
    // Player
    '^/jogador (.+)$': (message, match) => {
      cartola.playerCommand.apply(cartola, [message].concat(match.splice(1)));
    },
    // Status
    '^/status$': (message, match) => {
      cartola.statusCommand(message, match);
    },
    // Help
    '^/help$': (message, match) => {
      cartola.helpCommand(message, match);
    },
    // About
    '^/about$': (message, match) => {
      cartola.aboutCommand(message, match);
    }
  });
}, (error) => console.log('ERROR', error))

console.log('CartolaFC bot running...');

