require('dotenv').config();

var token = process.env.TELEGRAM_BOT_TOKEN,
  baseAPI = 'https://api.cartolafc.globo.com',
  Bot = require('node-telegram-bot-api'),
  bot = new Bot(token, { polling: true }),
  request = require('request');

console.log('CartolaFC bot rodando');

bot.onText(/^\/time (.+)$/, function (msg, match) {
  var name = match[1];

  request(`${baseAPI}/time/${name}`, function (error, response, body) {
    let message = '';

    if (!error && response.statusCode == 200) {
      let data = JSON.parse(body);
      message = `O time *${data.time.nome}* do *${data.time.nome_cartola}* tem *$${data.patrimonio}* cartoletas e *${data.pontos.toFixed(2)} pontos!*`;
    } else {
      message = 'Esse time não existe!';
    }

    bot.sendMessage(msg.chat.id, message, {
      parse_mode: 'Markdown'
    }).then(() => {
      console.log('mensagem enviada: ', message);
    });
  })
});
