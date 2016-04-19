const Stok = require('../index');

exports.registerModule = {
  setUp(done) {
    this.stok = new Stok();
    done();
  },

  missingName(test) {
    test.throws(
      () => {
        this.stok.registerModule({});
      },

      /Missing required field: name/
    );
    test.done();
  },

  valid(test) {
    const module = {
      name: 'Test Module'
    };

    this.stok.registerModule(module);
    test.strictEqual(
      this.stok._registeredModules[this.stok._registeredModules.length - 1],
      module
    );
    test.done();
  }
};

exports.shutdown = {
  setUp(done) {
    this.stok = new Stok();
    done();
  },

  error(test) {
    const invoked = [];
    const providedError = new Error('Shutdown Error in Second');

    this.stok.registerModule({
      name: 'First',
      shutdown() {
        invoked.push('First');
        return Promise.resolve();
      }
    });
    this.stok.registerModule({
      name: 'Second',
      shutdown() {
        invoked.push('Second');
        return Promise.reject(providedError);
      }
    });
    this.stok.registerModule({
      name: 'Third',
      shutdown() {
        invoked.push('Third');
        return Promise.resolve();
      }
    });

    this.stok.shutdown()
      .catch((error) => {
        test.deepEqual(invoked, ['Third', 'Second'], 'Shutdown order');
        test.strictEqual(error, providedError, 'Error propagates');
        test.done();
      });
  },

  success(test) {
    const invoked = [];

    this.stok.registerModule({
      name: 'First',
      shutdown() {
        invoked.push('First');
        return Promise.resolve();
      }
    });
    this.stok.registerModule({
      name: 'Second',
      shutdown() {
        invoked.push('Second');
        return Promise.resolve();
      }
    });
    this.stok.registerModule({
      name: 'Third',
      shutdown() {
        invoked.push('Third');
        return Promise.resolve();
      }
    });

    this.stok.shutdown()
      .then(() => {
        test.deepEqual(invoked, ['Third', 'Second', 'First'], 'Shutdown order');
        test.done();
      });
  }
};
