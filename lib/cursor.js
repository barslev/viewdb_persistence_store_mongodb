var Observer = require('viewdb').Observer;

var Cursor = function (collection, query, options, cursor) {
  this._query = { query };
  this._queryOptions = options;
  this._cursor = cursor;
  this._collection = collection;
}

Cursor.prototype.each = function () {
  return this._cursor.each.apply(this._cursor, arguments);
};

Cursor.prototype.toArray = function (callback) {
  return this._cursor.toArray.apply(this._cursor, arguments);
};

Cursor.prototype.observe = function (options) {
  return new Observer(this._query, this._options, this._collection, options);
};

Cursor.prototype.skip = function (skip) {
  this._cursor.skip.apply(this._cursor, arguments);
  this._query.skip = skip;
  this._refresh();
  return this;
};

Cursor.prototype.limit = function (limit) {
  this._cursor.limit.apply(this._cursor, arguments);
  this._query.limit = limit;
  this._refresh();
  return this;
};

Cursor.prototype._refresh = function () {
  this._collection.emit('change', {});
};

Cursor.prototype.rewind = function () {
  return this._cursor.rewind.apply(this._cursor, arguments);
};

module.exports = Cursor;
