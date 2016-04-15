'use strict';

const Hapi = require('hapi');
const dotenv = require('dotenv');
const good = require('good');
const goodConsole = require('good-console');

class Stok {
  constructor() {
    this.registeredModules = [];
  }

  // Create a Hapi server with some custom overrides
  createServer() {
    this.server = new Hapi.Server();

    // We need lexical 'this' here to pass around the class
    // level 'server' variable, so we use arrow functions
    this.server.connection = ((original) => {
      return (options) => {
        let connection = original.call(this.server, options);
        proxyConnection(connection);
      };
    })(this.server.connection);

    proxyConnection(this.server);
    return this.server.register(logToConsoleSettings)
      .then(() => this.server);
  }

  registerModule(module) {
    this.registeredModules.push(module);
  }

  shutdown() {
    return shutdownModules(this.registeredModules)
      .then(() => this.server.stop());
  }

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
}

function shutdownModules(modules) {
  let module = modules.pop();

  if (!module) {
    return Promise.resolve();
  }

  return module.shutdown().then(() => shutdownModules(modules));
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
        let handler = route.handler;
        route.handler = function (request, reply) {
          handler(request, reply)
            .catch(error => {
              reply(error);
            });
        };
      });

      original.call(connection, routes);
    };
  })(connection.route);
}

const logToConsoleSettings = {
  register: good,
  config: {
    reporters: [{
      reporter: goodConsole,
      events: {
        response: '*',
        log: '*'
      }
    }]
  }
};

module.exports = Stok;
