var MongoOplog = require('mongo-oplog');
var _ = require('lodash');

var TICK_INTERVAL = 1000 * 60 * 5;
var OplogListener = function (mongodb, namespaceFilter) {
  var self = this;
  this._mongodb = mongodb;
  var mongodbOplog = mongodb.db('local');
  var options = {};
  if (namespaceFilter) {
    options.ns = namespaceFilter;
  }
  this._oplog = MongoOplog(mongodbOplog, options);
  this._oplog.on('error', self._onError.bind(self));
  setInterval(function () {
    self.tick(namespaceFilter)
  }, TICK_INTERVAL);
  this._isTailing = false;
  this._listeners = []
};

OplogListener.prototype.tick = function (namespaceFilter) {
  console.log('[mongo-oplog] - TICK - ' + this._listeners.length + ' listeners for namespace: ' + namespaceFilter);
};

OplogListener.prototype._onError = function (err) {
  console.log('Error in oplog listener', _.get(err, 'message'));
  var self = this;
  var retryTimeout = 1000 + Math.floor(Math.random() * 250);
  setTimeout(function () {
    var mongodbOplog = self._mongodb.db('local');
    self._oplog = MongoOplog(mongodbOplog);
    self._oplog.on('error', self._onError.bind(self));
    self._isTailing = false;
    self.start().then(function () {
      console.log('[mongo-oplog] - Reconnected. Restoring ' + self._listeners.length + ' listeners');
    })
  }, retryTimeout);
};

OplogListener.prototype.start = function () {
  if (!this._isTailing) {
    console.log('[mongo-oplog] - connecting to oplog stream');
    this._isTailing = true;
    var self = this;
    return this._oplog.tail().then(function (stream) {
      if (stream) {
        console.log('[mongo-oplog] - connected to oplog stream');
        self._oplog.on('op', self.onOperation.bind(self));
      }
    });
  }
  return Promise.resolve();
};

OplogListener.prototype.onOperation = function (doc) {
  var listeners = _.filter(this._listeners, { namespace: doc.ns })
  if (_.isEmpty(listeners)) {
    return;
  }
  if (!_.has(doc, 'o.$set')) { // no need to resolve - doc already there
    _.forEach(listeners, function (listener) {
      listener.onOperation.call(listener.context, doc);
    });
  } else { // need to resolve document before notifying listeners
    var id = doc.o2._id;
    var observer = listeners[0].context;
    observer._collection.find({ _id: id }).toArray(function (err, results) {
      if (err || !results[0]) {
        console.log('ERROR.. TODO - IMPLEMENT RETRY ?', err);
      } else {
        var res = results[0];
        _.forEach(listeners, function (listener) {
          listener.onOperation.call(listener.context, { op: doc.op, o: res });
        });
      }
    });
  }
};

OplogListener.prototype.listen = function (namespace, onOperation, context) {
  var self = this;
  var listenerId = '_' + Math.random().toString(36).substr(2, 9);
  this.start().then(function () {
    self._listeners.push({ listenerId: listenerId, namespace: namespace, onOperation: onOperation, context: context })
  });
  return {
    dispose: function () {
      _.remove(self._listeners, { listenerId: listenerId })
    }
  }
};

module.exports = OplogListener;
