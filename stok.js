'use strict';

const Hapi = require('hapi');
const dotenv = require('dotenv');

class Stok {
  static loadConfiguration(options) {
    let configuration = {};

    dotenv.config({ silent: true });

    Object.keys(options).forEach(function (option) {
      let value = options[option];
      let defaultValue = null;

      if (typeof value === 'object') {
        if (!value.hasOwnProperty('env') || !value.hasOwnProperty('default')) {
          value = loadConfiguration(value);
        } else {
          defaultValue = value.default;
          value = process.env[value.env];
        }
      } else {
        if (typeof value === 'string') {
          value = process.env[value];
        }
      }

      configuration[option] = value || defaultValue;
    });

    return configuration;
  }

  static createServer() {
    const server = new Hapi.Server();
    server.connection = (function (original) {
      return function (options) {
        const connection = original.call(server, options);
        proxyConnection(connection);
      };
    })(server.connection);

    proxyConnection(server);
    return server.register(logToConsoleSettings)
      .then(() => server);
  }
}

// Override the route method and add error handling to
// all of our routes
function proxyConnection(connection) {
  connection.route = (function (original) {
    return function (routes) {
      if (!Array.isArray(routes)) {
        routes = [routes];
      }

      routes.forEach(function (route) {
        console.log(route);
        let handler = route.handler;
        route.handler = (function (request, reply) {
          handler(request, reply)
            .catch(error => {
              reply(error);
            });
        });
      });

      original.call(connection, routes);
    };
  })(connection.route);
}

const logToConsoleSettings = {
  register: require('good'),
  config: {
    reporters: [{
      reporter: require('good-console'),
      events: {
        response: '*',
        log: '*'
      }
    }]
  }
};

module.exports = Stok;
