'use strict';

const Hapi = require('hapi');

class Stok {
  constructor(options) {
    this.options = options;
  }

  createServer(routes) {
    return new Promise((resolve, reject) => {
      const server = new Hapi.Server();
      server.connection({ port: this.options.web.port });

      // Monkey patch the route method and add error handling to
      // all of our routes
      server.route = ((original) => {
        routes => {
          routes.forEach(route => {
            let handler = route.handler;
            route.handler = ((request, reply) => {
              handler(request, reply)
                .catch(error => {
                  reply(error);
                });
            });
          });
          original.call(server, routes);
        };
      })(server.route(routes));

      server.register(getLoggingSettings(this.options.web.logging.filePath), error => {
        if (error) {
          reject(error);
        }
      });

      resolve(server);
    });
  }
}

// If a logging filepath is provided via the options object, log to that file
// If no filepath is provided, logs go to stdout
function getLoggingSettings(path) {
  if (!path) {
    return logToConsoleSettings;
  }

  return {
    register: require('good'),
    options: {
      reporters: [{
        reporter: require('good-file'),
        events: {
          response: '*',
          log: '*'
        },
        config: path
      }]
    }
  };
}

const logToConsoleSettings = {
  register: require('good'),
  options: {
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
