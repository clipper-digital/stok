'use strict';

const Hapi = require('hapi');
const stokVersion = require('../package').version;
const util = require('./util');

// HapiProxy is an attempt to let developers use the standard Hapi API, but
// get Stok's added functionality. In order to accomplish this, we proxy all
// the necessary methods. Since Hapi doesn't expose all the internal classes
// (e.g., `Connection` is not exposed) we have to proxy the methods
// that expose instances (e.g., `server.connection()`) so that we can get a
// reference to the instance and proxy the methods we actually care about.
class HapiProxy {
  constructor(options) {
    if (!options.hasOwnProperty('appVersion')) {
      throw new Error('Missing required field: appVersion');
    }

    this._options = options;

    this._server = new Hapi.Server();
    this._isStarted = false;

    this._proxyServer();
  }

  getServer() {
    return this._server;
  }

  isStarted() {
    return this._isStarted;
  }

  _proxyServer() {
    this._proxyServerStart();

    this._proxyServerConnection();
    this._proxyConnection(this._server);
  }

  _proxyServerStart() {
    util.proxy(this._server, 'start', (original) => {
      return () => {

        // `server.start()` always expects a callack. If it doesn't receive one,
        // it will generate a callback that resolves a promise and then re-invoke
        // the method with the generated callback. This would result in an infinite
        // loop since it would end up invoking our proxied version, which would
        // then invoke the original method again without a callback. To avoid this,
        // we need to do the promise wrapping around the callback ourselves.
        return new Promise((resolve, reject) => {
          this._isStarted = true;

          original((result) => {
            if (result instanceof Error) {
              return reject(result);
            }

            resolve(result);
          });
        })
          .catch((error) => {
            this._isStarted = false;
            throw error;
          });
      };
    });
  }

  _proxyServerConnection() {
    util.proxy(this._server, 'connection', (original) => {
      return (options) => {
        const connection = original(options);
        this._proxyConnection(connection);

        // The health check must be added here instead of in `_proxyConnection()`
        // because `_proxyConnection()` is also called on the `Server` instance
        // since you can register routes directly on the server, but not until
        // a connection has been created.
        this._addHealthCheck(connection);
        return connection;
      };
    });
  }

  _proxyConnection(connection) {
    this._proxyConnectionRoute(connection);
  }

  // Modify all routes to automatically handle rejected promises
  _proxyConnectionRoute(connection) {
    util.proxy(connection, 'route', (original) => {
      return (routes) => {
        if (!Array.isArray(routes)) {
          routes = [routes];
        }

        routes.forEach((route) => {
          const handler = route.handler;
          route.handler = (request, reply) => {
            handler(request, reply).catch(reply);
          };
        });

        original(routes);
      };
    });
  }

  _addHealthCheck(connection) {
    connection.route({
      method: 'GET',
      path: '/_health',
      handler: (request, reply) => {
        reply({
          status: 'ok',
          pid: process.pid,
          uptime: process.uptime(),
          appVersion: this._options.appVersion,
          stokVersion: stokVersion
        });
        return Promise.resolve();
      }
    });
  }
}

module.exports = HapiProxy;
