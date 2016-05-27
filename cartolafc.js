request = require('request');
Promise = require('promise');

const baseAPI = 'https://api.cartolafc.globo.com';

class CartolaFC {
  fetchBasicData(credentials) {
    let authentication = this.authenticate(credentials),
      details = this.getDetails();

    return new Promise((resolve, reject) => {
      Promise.all([authentication, details]).then(function(values) { 
        let [authenticated] = values;

        if (authenticated.success) {
          resolve(authenticated.token);
        } else {
          reject(authenticated.reason);
        }
      });
    });
  }

  authenticate(credentials) {
    return new Promise((resolve, reject) => {
      request({
        url: 'https://login.globo.com/api/authentication',
        method: 'POST',
        json: true,
        body: {
          payload: {
            email: credentials.email,
            password: credentials.password,
            serviceId: 438
          }
        }
      }, (error, response, body) => {
        if (!error && response.statusCode == 200) {
          this.token = body.glbId;
          resolve({
            success: true,
            token: this.token
          });
        } else {
          reject({
            success: false, 
            reason: error
          });
        }
      });
    });
  }

  request(endpoint, needToken) {
    let options = {
        url: `${baseAPI}/${endpoint}`,
        json: true
      };

    if (needToken) {
      options.headers = {
        'X-GLB-Token': this.token
      }
    }

    return new Promise((resolve, reject) => {
      request(options, (error, response, data) => {
        if (!error && response.statusCode == 200) {
          resolve(data);
        } else {
          if (data.mensagem) {
            reject(data.mensagem);
          }

          reject(data);
        }
      })
    });
  }

  getTeam(name) {
    return this.request(`time/${name}`);
  }

  getLeague(name) {
    return this.request(`auth/liga/${this.slugify(name)}`, true)
  }

  getStatus() {
    return new Promise((resolve, reject) => {
      this.request(`mercado/status`).then((data) => {
        let date = new Date(data.fechamento.timestamp * 1000);
          
        this.market = {
          closed: date < new Date(),
          timestamp: date.getTime(),
          isClosed: () => {
            return this.market.timestamp < new Date();
          }
        }

        this.status = data;

        resolve(data);
      }, reject)
    });
  }

  slugify(t) {
    let text = t.replace(/^\s+|\s+$/g, ''),
      from = 'àáâãäçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ·/_,:;',
      to   = 'aaaaaceeeeiiiinooooouuuuyyAAAAACEEEEIIIINOOOOOUUUUY------';

    for (var i = 0, l = from.length; i < l; i++) {
      text = text.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }

    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }

  getDetails() {
    return new Promise((resolve, reject) => {
      let callback = () => {
          if (this.market.closed) {
            this.request('atletas/pontuados').then((data) => {
              this.details = data;
              resolve(data);
            }, reject);
          } else {
            resolve([]);
          }
        }

      if (this.market) {
        callback();
      } else {
        this.getStatus().then(callback, reject);
      }
      
    });
  }

  setTelegramBot(bot) {
    this.bot = bot;
  }

  sendMessage(chatId, text, params) {
    let defaultParams = {
        parse_mode: 'Markdown'
      };

    console.log('sending message:', text);
    return this.bot.sendMessage(chatId, text, defaultParams).then(() => {
      console.log('sent message:', text);
    });
  }

  calculatePartial(players) {
    let allPlayers = [],
      myPlayers = [],
      filteredPlayers = [],
      partialPoints = 0;

    if (!this.details) {
      return partialPoints;
    }

    for (player in this.details.atletas) {
      allPlayers.push(this.details.atletas[player]);
    }

    myPlayers = players.map((player) => player.apelido);

    filteredPlayers = allPlayers.filter((player) => {
      let index = myPlayers.indexOf(player.apelido);
      return index != -1 && players[index].clube_id == player.clube_id;
    });

    partialPoints = filteredPlayers.reduce((a, b) => {
      return (typeof a == 'number' ? a : a.pontuacao) + b.pontuacao
    });

    return partialPoints;
  }

  // Commands
  teamCommand(message, match) {
    this.getTeam(match[1]).then((data) => {
      let cartoletas = data.time.nome_cartola ? data.time.nome_cartola : 0,
        partial = '',
        text;

      if (this.details) {
        let partialPoints = this.calculatePartial(data.atletas);

        partial = `- Parcial: *${partialPoints.toFixed(2)}*`
      }

      text = `O time *${data.time.nome}* do *${cartoletas}* tem:
        - Cartoletas: *$${data.patrimonio || 0}*
        - Pontuação: *${data.pontos ? data.pontos.toFixed(2): 0}*
        ${partial}`;

      console.log('TESTE', message, text);
      this.sendMessage(message.chat.id, text);
    }, (data) => {
      this.sendMessage(message.chat.id, 'Erro');
    });
  }

  leagueCommand(message, match) {
    let text;

    this.getLeague(match[1]).then((data) => {
      text = `Ranking da liga ${data.liga.nome}:\r\n`;

      data.times.forEach((team, i) => {
        let position = ('00' + (i + 1)).substr(-2,2),
          points = team.pontos.campeonato ? team.pontos.campeonato.toFixed(2) : 0;

        text += `*${position}°* - ${team.nome_cartola} *${points}*pts (${team.slug})\r\n`;
      });
    }, (error) => {
      text = `A liga *${match[1]}* não foi encontrada`;
    }).finally(() => {
      this.bot.sendMessage(message.chat.id, text)
    })
  }

  playerCommand(message, name) {
    let text = `O jogador ${name} não foi encontrado`;

    if (this.market.isClosed()) {
      this.getDetails()
        .then((data) => {
          let players = [];

          for(p in data.atletas) {
            let player = data.atletas[p];

            if (player.apelido.toLowerCase().indexOf(name.toLowerCase()) != -1) {
              players.push(player);
            }
          }

          if (players.length) {
            player = players[0];
            text = `O *${player.apelido}* fez *${player.pontuacao}pts* na ${data.rodada}° rodada`;
          }
        }, (error) => {
          text = error;
        })
        .finally(() => {
          this.bot.sendMessage(message.chat.id, text);
        });
    } else {
      this.bot.sendMessage(message.chat.id, `A ${this.status.rodada_atual}° rodada ainda não começou. /status`);
    }
  }

  statusCommand(message) {
    let status = 'já está fechada.';

    if (!this.market.isClosed()) {
      let d = this.status.fechamento;

      status = `fecha dia ${d.dia} às ${d.hora}:${d.minuto}`
    }

    this.bot.sendMessage(message.chat.id, `A ${this.status.rodada_atual}° rodada ${status}`);
  }

  aboutCommand(message) {
    this.bot.sendMessage(message.chat.id, 'ABOUT - TODO');
  }

  helpCommand(message) {
    this.bot.sendMessage(message.chat.id, 'HELP - TODO');
  }
}

module.exports = CartolaFC;
