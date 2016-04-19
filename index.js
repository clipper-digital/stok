'use strict';

const Hoek = require('hoek');
const HapiProxy = require('./lib/hapi-proxy');
const loadConfiguration = require('./lib/load-configuration');

class Stok {
  constructor(options) {
    this._registeredModules = [];
    this._options = Hoek.applyToDefaults({
      shutdownSignals: ['SIGINT', 'SIGTERM']
    }, options || {});

    this._registerShutdownSignals();
  }

  // Create a Hapi server with some custom overrides
  createServer() {
    this.serverProxy = new HapiProxy();
    this.server = this.serverProxy.getServer();

    // TODO: set up logging

    this.registerModule({
      name: 'Hapi Server',
      shutdown: () => {
        if (!this.serverProxy.isStarted()) {
          return Promise.resolve();
        }

        return this.server.stop();
      }
    });

    return Promise.resolve(this.server);
  }

  log() {
    // TODO
  }

  registerModule(module) {
    if (!module.hasOwnProperty('name')) {
      throw new Error('Missing required field: name');
    }

    this.log(['module'], `Module registered: ${module.name}`);
    this._registeredModules.push(module);
  }

  shutdown() {
    return this._shutdownModules(this._registeredModules);
  }

  _registerShutdownSignals() {
    if (!this._options.shutdownSignals) {
      return;
    }

    this._options.shutdownSignals.forEach((signal) => {
      process.on(signal, () => {
        this.log(['shutdown'], `Received signal: ${signal}`);
        this.shutdown();
      });
    });
  }

  _shutdownModules(modules) {
    const module = modules.pop();

    if (!module) {
      this.log(['shutdown'], 'Shutdown complete');
      return Promise.resolve();
    }

    this.log(['shutdown', 'module'], `Module shutdown starting: ${module.name}`);

    return module.shutdown()
      .then(() => {
        this.log(['shutdown', 'module'], `Module shutdown complete: ${module.name}`);
        return this._shutdownModules(modules);
      })
      .catch((error) => {
        this.log(['shutdown', 'module', 'error'], `Module shutdown error: ${module.name}`);
        this.log(['shutdown', 'module', 'error'], error.stack);

        throw error;
      });
  }
}

Stok.loadConfiguration = loadConfiguration;

module.exports = Stok;
