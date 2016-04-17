'use strict';

const good = require('good');
const goodConsole = require('good-console');
const HapiProxy = require('./lib/hapi-proxy');
const loadConfiguration = require('./lib/load-configuration');

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

class Stok {
  constructor() {
    this.registeredModules = [];
  }

  // Create a Hapi server with some custom overrides
  createServer() {
    this.serverProxy = new HapiProxy();
    this.server = this.serverProxy.getServer();

    this.registerModule({
      shutdown: () => {
        if (!this.serverProxy.isStarted()) {
          return Promise.resolve();
        }

        return this.server.stop();
      }
    });

    return this.server.register(logToConsoleSettings)
      .then(() => this.server);
  }

  registerModule(module) {
    this.registeredModules.push(module);
  }

  shutdown() {
    return shutdownModules(this.registeredModules);
  }
}

Stok.loadConfiguration = loadConfiguration;

function shutdownModules(modules) {
  let module = modules.pop();

  if (!module) {
    return Promise.resolve();
  }

  return module.shutdown().then(() => shutdownModules(modules));
}

module.exports = Stok;
