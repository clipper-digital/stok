'use strict'

const Hoek = require('hoek')
const HapiProxy = require('./lib/hapi-proxy')
const loadConfiguration = require('./lib/load-configuration')
const logger = require('./lib/logger')
const version = require('./package').version

class Stok {
  constructor (options) {
    if (!options.hasOwnProperty('appVersion')) {
      throw new Error('Missing required field: appVersion')
    }

    this._options = Hoek.applyToDefaults({
      shutdownSignals: ['SIGINT', 'SIGTERM']
    }, options)

    this._logger = Stok.createLogger('stok')
    this._registeredModules = []

    this._registerShutdownSignals()
  }

  // Create a Hapi server with some custom overrides
  createServer (connectionOptions) {
    connectionOptions = Hoek.applyToDefaults({
      onResponseError: (request, reply, error) => {
        reply(error)
      }
    }, connectionOptions)

    const onResponseError = connectionOptions.onResponseError
    delete connectionOptions.onResponseError

    this.serverProxy = new HapiProxy({
      appVersion: this._options.appVersion,
      onResponseError: onResponseError
    })
    this.server = this.serverProxy.getServer()

    // Pipe relevant logs to the logger
    this.server.decorate('server', 'logger', Stok.createLogger('server'))
    this.server.on('log', (event, tags) => {
      if (tags.error) {
        this.server.logger.error(event)
      } else {
        this.server.logger.info(event)
      }
    })
    this.server.on('request', (request, event) => {
      request.logger.info(event)
    })
    this.server.on('request-error', (request, error) => {
      request.logger.error({ stack: error.stack }, error.message)
    })

    this.registerModule({
      name: 'Hapi Server',
      shutdown: () => {
        if (!this.serverProxy.isStarted()) {
          return Promise.resolve()
        }

        return this.server.stop()
      }
    })

    return this.serverProxy.createConnection(connectionOptions)
      .then(() => this.server)
  }

  registerModule (module) {
    if (!module.hasOwnProperty('name')) {
      throw new Error('Missing required field: name')
    }

    this._logger.info({
      tags: ['module']
    }, `Module registered: ${module.name}`)
    this._registeredModules.push(module)
  }

  shutdown () {
    if (!this._shutdownPromise) {
      this._shutdownPromise = this._shutdownModules(this._registeredModules.slice().reverse())
    }

    return this._shutdownPromise
  }

  _registerShutdownSignals () {
    if (!this._options.shutdownSignals) {
      return
    }

    this._options.shutdownSignals.forEach((signal) => {
      process.on(signal, () => {
        this._logger.info({
          tags: ['shutdown']
        }, `Received signal: ${signal}`)
        this.shutdown()
      })
    })
  }

  _shutdownModules (modules) {
    const module = modules.pop()

    if (!module) {
      this._logger.info({
        tags: ['shutdown']
      }, 'Shutdown complete')
      return Promise.resolve()
    }

    this._logger.info({
      tags: ['shutdown', 'module']
    }, `Module shutdown starting: ${module.name}`)

    return module.shutdown()
      .then(() => {
        this._logger.info({
          tags: ['shutdown', 'module']
        }, `Module shutdown complete: ${module.name}`)
        return this._shutdownModules(modules)
      })
      .catch((error) => {
        this._logger.error(error, `Module shutdown error: ${module.name}`)

        throw error
      })
  }
}

Stok.createLogger = logger.createLogger
Stok.loadConfiguration = loadConfiguration
Stok.logLevel = logger.logLevel
Stok.version = version

module.exports = Stok
