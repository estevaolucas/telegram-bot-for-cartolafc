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
        reject();
      }
    });
  });
}

function details() {
  return new Promise((resolve, reject) => {
    request({
      url: `${baseAPI}/atletas/pontuados`,
      json: true
    }, (error, response, data) => {
      (!error && response.statusCode == 200) ? resolve(data) : reject();
    });
  });
}

authenticate().then((token) => {
  let defaultParams = {
    parse_mode: 'Markdown'
  };

  bot.onText(/^\/time (.+)$/, (msg, match) => {
    var name = match[1];

    request({
      url: `${baseAPI}/time/${name}`,
      json: true
    }, (error, response, data) => {
      let message = '';

      details().then((details) => {
        if (!error && response.statusCode == 200) {          
          let cartoletas = data.time.nome_cartola ? data.time.nome_cartola : 0,
            points = data.pontos ? data.pontos : 0,
            partial = 0,
            allPlayers = [],
            myPlayers = [],
            players = [];

          for (player in details.atletas) {
            allPlayers.push(details.atletas[player]);
          }

          myPlayers = data.atletas.map((player) => player.apelido);

          players = allPlayers
            .filter((player) => {
              let index = myPlayers.indexOf(player.apelido);
              return index != -1 && data.atletas[index].clube_id == player.clube_id;
            });

          partial =   
            players.reduce((a, b) => {
              return (typeof a == 'number' ? a : a.pontuacao) + b.pontuacao
            });

          message = `O time *${data.time.nome}* do *${cartoletas}* tem:
            - Cartoletas: *$${data.patrimonio}*
            - Pontuação: *${points.toFixed(2)}*
            - Parcial: *${partial.toFixed(2)}*`;
        } else {
          message = 'Esse time não existe!';
        }

        bot.sendMessage(msg.chat.id, message, defaultParams).then(() => {
          console.log('sent message: ', message);
        });
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
      let message;

      if (!error && response.statusCode == 200) {
        message = `Ranking da liga ${data.liga.nome}:\r\n`;

        data.times.forEach((team, i) => {
          let position = ('00' + (i + 1)).substr(-2,2),
            points = team.pontos.campeonato ? team.pontos.campeonato.toFixed(2) : 0;

          message += `*${position}°* - ${team.nome_cartola} *${points}*pts (${team.slug} - $${team.patrimonio.toFixed(2)})\r\n`;
        });
      } else {
        message = data;
      }

      bot.sendMessage(msg.chat.id, message, defaultParams).then(() => {
        console.log('sent message: ', message);
      });
    })
  });

  bot.onText(/^\/status$/, (msg, match) => {
    request({
      url: `${baseAPI}/mercado/status`,
      json: true
    }, (error, response, data) => {
      let message;

      if (!error && response.statusCode == 200) {
        let d = data.fechamento,
          date = new Date(data.fechamento.timestamp * 1000),
          status;

        if (date < new Date()) {
          status = 'já está fechada.';
        } else {
          status = `fecha dia ${d.dia} às ${d.hora}:${d.minuto}`
        }

        message = `A ${data.rodada_atual}° rodada ${status}`;
      } else {
        message = data;
      }

      bot.sendMessage(msg.chat.id, message, defaultParams).then(() => {
        console.log('sent message: ', message);
      });
    })
  });

  bot.onText(/^\/jogador (.+)$/, (msg, match) => {
    var name = match[1];

    request({
      url: `${baseAPI}/atletas/pontuados`,
      json: true
    }, (error, response, data) => {
      let message = `O jogador ${name} não foi encontrado`;

      if (!error && response.statusCode == 200) {
        let players = [];

        for(p in data.atletas) {
          let player = data.atletas[p];

          if (player.apelido.toLowerCase().indexOf(name.toLowerCase()) != -1) {
            players.push(player);
          }
        }

        if (players.length) {
          player = players[0];

          message = `O *${player.apelido}* fez *${player.pontuacao}pts* na ${data.rodada}° rodada`;

          console.log('mensagem enviada',message, msg.chat.id, msg);
        }
      }

      bot.sendMessage(msg.chat.id, message, defaultParams).then(() => {
        console.log('sent message: ', message);
      });
    })
  });
});
