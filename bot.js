require('dotenv').config();

var telegram_token = process.env.TELEGRAM_BOT_TOKEN,
  baseAPI = 'https://api.cartolafc.globo.com',
  Bot = require('node-telegram-bot-api'),
  bot = new Bot(telegram_token, { polling: true }),
  request = require('request'),
  Promise = require('promise'),
  cartola_token;

console.log('CartolaFC bot running...');

function authenticate() {
  return new Promise((resolve, reject) => {
    request({
      url: 'https://login.globo.com/api/authentication',
      method: 'POST',
      json: true,
      body: {
        payload: {
          email: process.env.CARTOLA_USER,
          password: process.env.CARTOLA_PASS,
          serviceId: 438
        }
      }
    }, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        resolve(body.glbId);
      } else {
        console.log('user not logged');
        reject();
      }
    });
  });
}

authenticate().then((token) => {
  let defaultParams = {
    parse_mode: 'Markdown'
  };
  console.log('authenticado', token); 

  bot.onText(/^\/time (.+)$/, (msg, match) => {
    var name = match[1];

    request({
      url: `${baseAPI}/time/${name}`,
      json: true
    }, (error, response, data) => {
      let message = '';

      if (!error && response.statusCode == 200) {
        message = `O time *${data.time.nome}* do *${data.time.nome_cartola}* tem:
         Cartoletas: *$${data.patrimonio}*
         Pontuação: *${data.pontos.toFixed(2)}*`;
      } else {
        message = 'Esse time não existe!';
      }

      bot.sendMessage(msg.chat.id, message, defaultParams).then(() => {
        console.log('sent message: ', message);
      });
    })
  });

  bot.onText(/^\/liga (.+)$/, (msg, match) => {
    var name = match[1];

    request({
      url: `${baseAPI}/auth/liga/${name}`,
      json: true,
      headers: {
        'X-GLB-Token': token
      }
    }, (error, response, data) => {
      let teams, message;

      if (!error && response.statusCode == 200) {
        message = `Ranking da liga ${data.liga.nome}:\r\n`;

        data.times.forEach((team, i) => {
          let position = ('00' + (i + 1)).substr(-2,2),
            points = team.pontos.campeonato ? team.pontos.campeonato.toFixed(2) : 0;

          message += `*${position}°* - *${points}* pts ${team.nome_cartola} (${team.slug} - $${team.patrimonio.toFixed(2)})\r\n`;
        });
      } else {
        message = data;
      }

      bot.sendMessage(msg.chat.id, message, defaultParams).then(() => {
        console.log('sent message: ', message);
      });
    })
  });
});
