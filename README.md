# Stok [![Build Status](https://travis-ci.org/clipper-digital/stok.svg?branch=master)](https://travis-ci.org/clipper-digital/stok)

Stok provides a base layer for building [twelve-factor apps](http://12factor.net/) using [Hapi](http://hapijs.com/).





## Example

```js
const Stok = require('stok')

// A fake service to demonstrate route error handling
const someService = function () {
  if (Math.random() > 0.2) {
    return Promise.resolve('Stok is great!')
  }

  return Promise.reject(new Error('Stok handles errors!'))
}

const config = Stok.loadConfiguration({
  port: {
    env: 'PORT',
    default: 3000
  }
})

const stok = new Stok({
  appVersion: '0.0.1'
})

stok.createServer({
  port: config.port
})
  .then(() => {
    stok.server.route({
      method: 'GET',
      path: '/',
      handler: (request, reply) => {
        return someService()
          .then((message) => {
            reply({ message: message })
          })
      }
    })

    return stok.server.start()
  })
  .then(() => {
    stok.server.logger.info(`Server running at ${stok.server.info.uri}`)
  })
  .catch((error) => {
    console.error(error.stack)
  })
```





## Overview

### Configuration

[Configuration settings are stored in environment variables](http://12factor.net/config), but Stok provides some conveniences for working with config values. Specifically, [`Stok.loadConfiguration()`][Stok.loadConfiguration()] will convert the env vars into a structured object and fill in default values. During development, you can also place config values in a `.env` file to simplify running the application.



### Routing

[Routes](http://hapijs.com/api#route-configuration) work just like they do in Hapi, with one change: The `handler` can optionally return a promise to allow simplified error handling. If the promise is rejected, a response will be generated from the error as if you had called `reply(error)`. This behavior can be controlled via the [`onResponseError` option][Stok#createServer()] when creating a server.

A health check route (`GET /_health`) is automatically added to the server for getting basic information about the server, and to verify that the server is still working. The response is JSON and includes the following properties:

* `status`: Will always be set to `'ok'`.
* `pid`: The process ID of the node process running the server.
* `uptime`: How long the process has been running.
* `appVersion`: The version of the application that is currently running.
* `stokVersion`: The version of `Stok` that is currently running.



### Logging

The Hapi server and all requests have a `logger` property which is a `Logger` instance created via [`Stock.createLogger()`][Stok.createLogger()]. Any logs created via Hapi's `server.log()` or `request.log()` methods will get piped to the appropriate `Logger` instance. By default these logs will be set to the `info` level, but if an `error` tag exists in the log call, then the `error` level will be used.

Each request has the following data logged with a `message` of "HTTP request":

* `clientIp`: The IP of the client that initiated the request. Respects the [`ipHeader` option][Stok#createServer()].
* `duration`: The total duration for the request, including sending the response, in milliseconds, with nanosecond precision.
* `latency`: The duration between the request being received and the response being sent, in milliseconds, with nanosecond precision.
* `method`: The HTTP method for the request.
* `path`: The path for the request.
* `protocol`: The protocol used for the request.
* `statusCode`: The HTTP status code of the response.
* `userAgent`: The user agent for the client that initiated the request.



### Graceful Shutdown

Stok applications perform a [graceful shutdown](http://12factor.net/disposability) when they receive `SIGTERM` or `SIGINT`. This behavior can be controlled via the [`shutdownSignals` option][new Stok()] when creating a new `Stok` instance. In addition, a graceful shutdown can be initiated by calling [`Stok#shutdown()`][Stok#shutdown()].





## API

### `Stok`

#### `Stok.createLogger(name) Returns: Logger`

Creates a named logger using [bole](https://www.npmjs.com/package/bole). All logs are written to stdout. The level of output can be configured via [`Stok.logLevel()`][Stok.logLevel()].

* `name` (String): The name of the logger.



#### `Stok.loadConfiguration(config) Returns: Object`

Loads configuration from env vars and the `.env` file and stores it in a structured object.

* `config` (Object): A mapping between a structured config object and the associated env vars.

In the following example, `web.port` will have the value of the `PORT` env var. Similarly, `db.host`, `db.user`, and `db.password` will have the values of the `DB_HOST`, `DB_USER`, and `DB_PASSWORD` env vars, respectively. `db.port` will have the value of the `DB_PORT` env var, but if the env var doesn't exist, the default value of `3306` will be used.

```js
const config = Stok.loadConfiguration({
  web: {
    port: 'PORT'
  },
  db: {
    host: 'DB_HOST',
    port: {
      env: 'DB_PORT',
      default: 3306
    },
    user: 'DB_USER',
    password: 'DB_PASSWORD'
  }
})
```



#### `Stok.logLevel(level)`

Sets the log level for all loggers.

* `level` (String): The minimum debug level to print to stdout. Possible values: `"debug"`, `"info"`, `"warn"`, `"error"`.

_NOTE: Logging starts with a default level of `"info"`._



#### `Stok.version`

The version of `Stok` being used.



#### `new Stok(options)`

Creates a new `Stok` instance.

* `options` (Object): Configuration options for the `Stok` instance.
  * `appVersion` (String): The version of the application being instantiated.
  * `shutdownSignals` (Array; optional): Which signals to listen to for graceful shutdown. Default: `['SIGINT', 'SIGTERM']`.



#### `Stok#createServer(options) Returns: Promise`

Creates a Hapi server and a connection.

* `options` (Object): Configuration options for [Hapi's `server.connection()`](http://hapijs.com/api#serverconnectionoptions), plus the following options:
  * `ipHeader` (String; optional): The name of the header that contains the client's IP, for use behind a proxy.
  * `onResponseError` (Function; `function(request, reply, error)`): A function to invoke when a route returns a rejected promise. Defaults to a function which passes the `error` to `reply`.

_NOTE: `Stok` instances can only have one connection per server._
_NOTE: [Routes have customized behavior](#routing)._



#### `Stok#registerModule(module)`

Registers a module with the `Stok` instance.

* `module` (Object): Configuration for the module.
  * `name` (String): The name of the module.
  * `shutdown` (Function; `function() Returns: Promise`): A function to invoke during shutdown. See [`Stok#shutdown()`][Stok#shutdown()] for more information.



#### `Stok#shutdown() Returns: Promise`

Performs a graceful shutdown of the Hapi server and all registered modules. Modules are shut down in the order that they were registered, with the Hapi server being the first module to shut down.

Stok will automatically perform a graceful shutdown when it receives `SIGTERM` or `SIGINT`. This behavior can be controlled via the [`shutdownSignals` option][new Stok()] when creating a new `Stok` instance.





## License

Copyright Stok contributors.
Released under the terms of the ISC license.

[Stok.createLogger()]: #stokcreateloggername-returns-logger
[Stok.loadConfiguration()]: #stokloadconfigurationconfig-returns-object
[Stok.logLevel()]: #stokloglevellevel
[new Stok()]: #new-stokoptions
[Stok#createServer()]: #stokcreateserveroptions-returns-promise
[Stok#shutdown()]: #stokshutdown-returns-promise
