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
      name: 'Hapi Server',
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
    if (!module.hasOwnProperty('name')) {
      throw new Error('Missing required field: name');
    }

    this.server.log(['module'], `Module registered: ${module.name}`);
    this.registeredModules.push(module);
  }

  shutdown() {
    return this._shutdownModules(this.registeredModules);
  }

  _shutdownModules(modules) {
    const module = modules.pop();

    if (!module) {
      this.server.log(['shutdown'], 'Shutdown complete');
      return Promise.resolve();
    }

    this.server.log(['shutdown', 'module'], `Module shutdown starting: ${module.name}`);

    return module.shutdown()
      .then(() => {
        this.server.log(['shutdown', 'module'], `Module shutdown complete: ${module.name}`);
        return this._shutdownModules(modules);
      })
      .catch((error) => {
        this.server.log(['shutdown', 'module', 'error'], `Module shutdown error: ${module.name}`);
        this.server.log(['shutdown', 'module', 'error'], error.stack);

        throw error;
      });
  }
}

Stok.loadConfiguration = loadConfiguration;

module.exports = Stok;
