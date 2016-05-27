let Bot = require('node-telegram-bot-api');

class BotController {
  constructor(token, routes) {
    this.bot = new Bot(token, { polling: true });
  }

  registerRoutes(routes) {
    this.routes = routes;

    for(let command in this.routes) {
      this.bot.onText(new RegExp(command), this.routes[command]);
    }
  }
}

module.exports = BotController
