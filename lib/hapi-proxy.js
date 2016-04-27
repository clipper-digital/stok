'use strict'

const Hapi = require('hapi')
const Hoek = require('hoek')
const requestLogger = require('./request-logger')
const stokVersion = require('../package').version
const util = require('./util')

class MultipleConnectionsError extends Error {
  constructor () {
    super('Stok only supports one connection per server')
    this.code = 'E_MULTIPLE_CONNECTIONS'
  }
}

// HapiProxy is an attempt to let developers use the standard Hapi API, but
// get Stok's added functionality. In order to accomplish this, we proxy all
// the necessary methods. Since Hapi doesn't expose all the internal classes
// (e.g., `Connection` is not exposed) we have to proxy the methods
// that expose instances (e.g., `server.connection()`) so that we can get a
// reference to the instance and proxy the methods we actually care about.
class HapiProxy {
  constructor (options) {
    if (!options.hasOwnProperty('appVersion')) {
      throw new Error('Missing required field: appVersion')
    }

    this._options = options

    this._server = new Hapi.Server()
    this._isStarted = false
    this._hasConnection = false

    this._proxyServer()
  }

  createConnection (options) {
    if (this._hasConnection) {
      return Promise.reject(new MultipleConnectionsError())
    }

    this._hasConnection = true

    // Pull out the IP header from the connection options.
    // This is only for use in the request logger.
    options = Hoek.clone(options)
    const ipHeader = options.ipHeader
    delete options.ipHeader

    // Create the connection, then prevent any additional connections from
    // being created
    const connection = this._server.connection(options)
    util.proxy(this._server, 'connection', (original) => {
      return () => {
        throw new MultipleConnectionsError()
      }
    })

    // Register common extensions and routes
    return this._server.register({
      register: requestLogger,
      options: { ipHeader }
    })
      .then(() => {
        this._registerHealthRoute()
      })
      .then(() => connection)
  }

  getServer () {
    return this._server
  }

  isStarted () {
    return this._isStarted
  }

  _proxyServer () {
    this._proxyServerStart()
    this._proxyServerRoute()
  }

  _proxyServerStart () {
    util.proxy(this._server, 'start', (original) => {
      return () => {
        // `server.start()` always expects a callack. If it doesn't receive one,
        // it will generate a callback that resolves a promise and then re-invoke
        // the method with the generated callback. This would result in an infinite
        // loop since it would end up invoking our proxied version, which would
        // then invoke the original method again without a callback. To avoid this,
        // we need to do the promise wrapping around the callback ourselves.
        return new Promise((resolve, reject) => {
          this._isStarted = true

          original((result) => {
            if (result instanceof Error) {
              return reject(result)
            }

            resolve(result)
          })
        })
          .catch((error) => {
            this._isStarted = false
            throw error
          })
      }
    })
  }

  // Modify all routes to automatically handle rejected promises
  _proxyServerRoute () {
    util.proxy(this._server, 'route', (original) => {
      return (routes) => {
        if (!Array.isArray(routes)) {
          routes = [routes]
        }

        routes.forEach((route) => {
          const handler = route.handler
          route.handler = (request, reply) => {
            const maybePromise = handler(request, reply)
            if (maybePromise) {
              maybePromise.catch(reply)
            }
          }
        })

        original(routes)
      }
    })
  }

  _registerHealthRoute () {
    this._server.route({
      method: 'GET',
      path: '/_health',
      handler: (request, reply) => {
        reply({
          status: 'ok',
          pid: process.pid,
          uptime: process.uptime(),
          appVersion: this._options.appVersion,
          stokVersion: stokVersion
        })
      }
    })
  }
}

module.exports = HapiProxy
