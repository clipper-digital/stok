const dotenv = require('dotenv');
const sinon = require('sinon');
const loadConfiguration = require('../../lib/load-configuration');

exports.loadConfiguration = {
  setUp: function (done) {
    this._env = process.env;
    process.env = {};
    done();
  },

  tearDown: function (done) {
    process.env = this._env;
    this.configStub.restore();
    done();
  },

  simple(test) {
    this.configStub = sinon.stub(dotenv, 'config', () => {
      process.env.FOO = 'my foo';
    });
    const config = loadConfiguration({
      foo: 'FOO',
      bar: 'BAR'
    });
    test.deepEqual(config, {
      foo: 'my foo',
      bar: null
    });
    test.done();
  },

  complex(test) {
    this.configStub = sinon.stub(dotenv, 'config', () => {
      process.env.WEB_PORT = 1234;
      process.env.DB_HOST = 'db-host';
    });
    const config = loadConfiguration({
      web: {
        port: {
          env: 'WEB_PORT',
          default: 3000
        }
      },
      db: {
        host: 'DB_HOST',
        port: {
          env: 'DB_PORT',
          default: 8000
        }
      }
    });
    test.deepEqual(config, {
      web: {
        port: 1234
      },
      db: {
        host: 'db-host',
        port: 8000
      }
    });
    test.done();
  }
};
