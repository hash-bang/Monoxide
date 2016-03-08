var _ = require('lodash')
	.mixin(require('lodash-deep'));
var async = require('async-chainable');
var events = require('events');
var mongoose = require('mongoose');
var util = require('util');

// Utility functions {{{
/**
* Extract all FKs in dotted path notation from a Mongoose model
* @param object schema The schema object to examine (usually connection.base.models[model].schema
* @param string prefix existing Path prefix to use (internal use only)
* @param object base Base object to append flat paths to (internal use only)
* @return object A dictionary of foreign keys for the schema (each key will be the info of the object)
*/
function extractFKs(schema, prefix, base) {
	var FKs = {};
	if (!prefix) prefix = '';
	if (!base) base = FKs;

	_.forEach(schema.paths, function(path, id) {
		if (id == 'id' || id == '_id') {
			// Pass
		} else if (path.instance && path.instance == 'ObjectID') {
			FKs[prefix + id] = {type: 'objectId'};
		} else if (path.caster && path.caster.instance == 'ObjectID') { // Array of ObjectIDs
			FKs[prefix + id] = {type: 'objectIdArray'};
		} else if (path.schema) {
			FKs[prefix + id] = {type: 'subDocument'};
			_.forEach(extractFKs(path.schema, prefix + id + '.', base), function(val, key) {
				base[key] = val;
			});
		}
	});

	return FKs;
}
// }}}

function Monoxide() {
	var self = this;
	self.models = {};

	// .query([q], [options], callback) {{{
	/**
	* Query Mongo directly with the Monoxide query syntax
	*
	* @name monoxide.query
	*
	* @param {object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {string} [q.$id] If specified return only one record by its master ID (implies $one=true). If present all other conditionals will be ignored and only the object is returned (see $one)
	* @param {(string|string[]|object[])} [q.$sort] Sorting criteria to apply
	* @param {(string|string[]|object[])} [q.$populate] Population criteria to apply
	* @param {boolean} [q.$one=false] Whether a single object should be returned (implies $limit=1). If enabled an object is returned not an array
	* @param {number} [q.$limit] Limit the return to this many rows
	* @param {number} [q.$skip] Offset return by this number of rows
	* @param {boolean=false} [q.$count=false] Only count the results - do not return them. If enabled an object containing a single key ('count') is returned
	* @param {...*} [q.filter] Any other field (not beginning with '$') is treated as filtering criteria
	*
	* @param {object} [options] Optional options object which can alter behaviour of the function
	* @param {boolean} [options.cacheFKs=true] Whether to cache the foreign keys (objectIDs) within an object so future retrievals dont have to recalculate the model structure
	*
	* @param {function} callback(err, result) the callback to call on completion or error
	*
	* @example <caption>Return all Widgets, sorted by name</caption>
	* monoxide.query({$collection: 'widgets', $sort: 'name'}, function(err, res) {
	* 	console.log('Widgets:', res);
	* });
	* @example <caption>Filter Users to only return admins while also populating their country</capation>
	* monoxide.query({$collection: 'users', $populate: 'country', role: 'admin'}, function(err, res) {
	* 	console.log('Admin users:', res);
	* });
	*/
	self.query = function MonoxideQuery(q, options, callback) {
		// Deal with arguments {{{
		if (_.isObject(q) && _.isObject(options) && _.isFunction(callback)) {
			// All ok
		} else if (_.isObject(q) && _.isFunction(options)) {
			callback = options;
			options = {};
		} else if (_.isString(q) && _.isObject(options) && _.isFunction(callback)) {
			q = {$collection: q};
		} else if (_.isString(q) && _.isFunction(options)) {
			q = {$collection: q};
			callback = options;
		} else if (_.isFunction(q)) {
			callback = q;
			q = {};
			options = {};
		} else if (!_.isFunction(callback)) {
			throw new Error('Callback parameter must be function');
		} else {
			throw new Error('Unknown function call pattern');
		}
		// }}}

		var settings = _.defaults(options || {}, {
			cacheFKs: true, // Whether to cache model Foreign Keys (used for populates) or compute them every time
		});

		async()
			.set('metaFields', [
				'$collection', // Collection to query
				'$id', // If specified return only one record by its master ID (implies $one=true). If present all other conditionals will be ignored and only the object is returned (see $one)
				'$sort', // Sorting criteria to apply
				'$populate', // Population criteria to apply
				'$one', // Whether a single object should be returned (implies $limit=1). If enabled an object is returned not an array
				'$limit', // Limit the return to this many rows
				'$skip', // Offset return by this number of rows
				'$count', // Only count the results - do not return them. If enabled an object containing a single key ('count') is returned
			])
			// .connection {{{
			.then('connection', function(next) {
				if (!mongoose.connection) return next('No Mongoose connection open');
				next(null, mongoose.connection);
			})
			// }}}
			// .model {{{
			.then('model', function(next) {
				if (!q.$collection) return next('Collection not specified');
				if (!_.has(this.connection, 'base.models.' + q.$collection)) return next('Invalid collection');
				next(null, this.connection.base.models[q.$collection].schema);
			})
			// }}}
			// .modelFKs - Determine foreign keys {{{
			.then('modelFKs', function(next) {
				if (settings.cacheFKs && this.model._knownFKs) return next(null, this.model._knownFKs); // Already computed
				var FKs = extractFKs(this.model);
				if (settings.cacheFKs) this.model._knownFKs = FKs; // Cache for next time
				next(null, FKs);
			})
			// }}}
			// .query - start the find query {{{
			.set('filterPostPopulate', {}) // Filter by these fields post populate
			.then('query', function(next) {
				var self = this;
				var fields;
				
				if (q.$id) { // Search by one ID only - ignore other fields
					fields = {_id: q.$id};
					q.$one = true;
				} else { // Search by query
					fields = _(q)
						.omit(this.metaFields) // Remove all meta fields
						// FIXME: Ensure all fields are flat
						.omitBy(function(val, key) { // Remove all fields that will need populating later
							if (_.some(self.modelFKs, function(FK) {
								return _.startsWith(key, FK);
							})) {
								self.filterPostPopulate[key] = val;
								return true;
							} else {
								return false;
							}
						})
						.value();
				}

				//console.log('FIELDS', fields);
				//console.log('POSTPOPFIELDS', self.filterPostPopulate);
				if (q.$count) {
					next(null, this.connection.base.models[q.$collection].count(fields));
				} else if (q.$one) {
					next(null, this.connection.base.models[q.$collection].findOne(fields));
				} else {
					next(null, this.connection.base.models[q.$collection].find(fields));
				}
			})
			// }}}
			// Apply various simple criteria {{{
			.then(function(next) {
				if (q.$count) return next(); // No point doing anything else if just counting
				if (q.$populate) this.query.populate(q.$populate);
				if (q.$limit) this.query.limit(q.$limit);
				if (q.$skip) this.query.skip(q.$skip);

				// q.sort {{{
				if (q.$sort) {
					if (_.isArray(q.$sort)) {
						var query = this.query;
						q.$sort.forEach(function(s) {
							query.sort(s);
						});
					} else if (_.isString(q.$sort) || _.isObject(q.$sort)) {
						this.query.sort(q.$sort);
					} else {
						throw new Error('Invalid sort type: ' + typeof q.$sort);
					}
				}
				// }}}
				next();
			})
			// }}}
			// Execute and capture return {{{
			.then('result', function(next) {
				this.query.exec(next);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					return callback(err);
				} else if (q.$count) {
					callback(null, {count: this.result});
				} else {
					callback(null, this.result);
				}
			});
			// }}}
	};
	// }}}

	// .count([q], [options], callback) {{{
	/**
	* Similar to query() but only return the count of possible results rather than the results themselves
	*
	* @name monoxide.count
	* @see monoxide.query
	*
	* @param {object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {...*} [q.filter] Any other field (not beginning with '$') is treated as filtering criteria
	*
	* @param {object} [options] Optional options object which can alter behaviour of the function
	*
	* @param {function} callback(err, result) the callback to call on completion or error
	*
	* @example <caption>Count all Widgets</caption>
	* monoxide.count({$collection: 'widgets'}, function(err, res) {
	* 	console.log('Number of Widgets:', res.count);
	* });
	*
	* @example <caption>Count all admin Users</capation>
	* monoxide.query({$collection: 'users', role: 'admin'}, function(err, res) {
	* 	console.log('Number of Admin Users:', res.count);
	* });
	*/
	self.count = function MonoxideCount(q, options, callback) {
		// Deal with arguments {{{
		if (_.isObject(q) && _.isObject(options) && _.isFunction(callback)) {
			// All ok
		} else if (_.isObject(q) && _.isFunction(options)) {
			callback = options;
			options = {};
		} else if (_.isString(q) && _.isObject(options) && _.isFunction(callback)) {
			q = {$collection: q};
		} else if (_.isString(q) && _.isFunction(options)) {
			q = {$collection: q};
			callback = options;
		} else if (!_.isFunction(q)) {
			callback = q;
			q = {};
			options = {};
		} else if (_.isFunction(callback)) {
			throw new Error('Callback parameter is mandatory');
		} else {
			throw new Error('Unknown function call pattern');
		}
		// }}}

		// Glue count functionality to query
		q.$count = true;

		return self.query(q, options, callback);
	};
	// }}}

	// .save([item], options, callback) {{{
	/**
	* Save a Mongo document by its ID
	* This function will first attempt to retrieve the ID and if successful will save, if the document is not found this function will execute the callback with an error
	*
	* @name monoxide.save
	*
	* @param {object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {string} q.$id The ID of the document to save
	* @param {...*} [q.field] Any other field (not beginning with '$') is treated as data to save
	*
	* @param {object} [options] Optional options object which can alter behaviour of the function
	*
	* @param {function} callback(err, result) the callback to call on completion or error
	*
	* @example <caption>Save a Widgets</caption>
	* monoxide.query({$collection: 'widgets', name: 'New name'}, function(err, res) {
	* });
	*/
	self.save = function MonoxideQuery(q, options, callback) {
		var self = this;
		// Deal with arguments {{{
		if (_.isObject(q) && _.isObject(options) && _.isFunction(callback)) {
			// All ok
		} else if (_.isObject(q) && _.isFunction(options)) {
			callback = options;
			options = {};
		} else if (!_.isFunction(q)) {
			callback = q;
			q = {};
			options = {};
		} else if (_.isFunction(callback)) {
			throw new Error('Callback parameter is mandatory');
		} else {
			throw new Error('Unknown function call pattern');
		}
		// }}}

		var settings = _.defaults(options || {}, {
		});

		async()
			.set('metaFields', [
				'$id', // Mandatory field to specify while record to update
				'$collection', // Collection to query to find the original record
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for save operation');
				if (!q.$collection) return next('$collection must be specified for save operation');
				next();
			})
			// }}}
			// .connection {{{
			.then('connection', function(next) {
				if (!mongoose.connection) return next('No Mongoose connection open');
				next(null, mongoose.connection);
			})
			// }}}
			// .model {{{
			.then('model', function(next) {
				if (!q.$collection) return next('Collection not specified');
				if (!_.has(this.connection, 'base.models.' + q.$collection)) return next('Invalid collection');
				next(null, this.connection.base.models[q.$collection].schema);
			})
			// }}}
			// Find the row by its ID - call to self.query() {{{
			.then('row', function(next) {
				if (!q.$id) return next(); // Creating a new record - dont bother to find the old one
				self.query({
					$id: q.$id,
					$collection: q.$collection,
				}, next);
			})
			// }}}
			// Save new / over {{{
			.then('newRec', function(next) {
				var row = this.row;
				if (!q.$id) { // Create new record
					this.connection.base.models[q.$collection].create(_.omit(q, this.metaFields), next);
				} else { // Update existing record
					var saveFields = _(q)
						.omit(this.metaFields) // Remove all meta fields
						.forEach(function(val, key) { // NOTE: Implicit end to lodash
							_.set(row, key, val);
						});

					this.row.save(next);
				}
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) return callback(err);
				return callback(null, this.newRec);
			});
			// }}}
	};
	// }}}

	// .delete([item], options, callback) {{{
	/**
	* Delete a Mongo document by its ID
	* This function will first attempt to retrieve the ID and if successful will delete it, if the document is not found this function will execute the callback with an error
	*
	* @name monoxide.delete
	*
	* @param {object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {string} q.$id The ID of the document to delete
	*
	* @param {object} [options] Optional options object which can alter behaviour of the function
	*
	* @param {function} callback(err, result) the callback to call on completion or error
	*
	* @example <caption>Save a Widgets</caption>
	* monoxide.query({$collection: 'widgets', name: 'New name'}, function(err, res) {
	* });
	*/
	self.delete = function MonoxideQuery(q, options, callback) {
		var self = this;
		// Deal with arguments {{{
		if (_.isObject(q) && _.isObject(options) && _.isFunction(callback)) {
			// All ok
		} else if (_.isObject(q) && _.isFunction(options)) {
			callback = options;
			options = {};
		} else if (!_.isFunction(q)) {
			callback = q;
			q = {};
			options = {};
		} else if (_.isFunction(callback)) {
			throw new Error('Callback parameter is mandatory');
		} else {
			throw new Error('Unknown function call pattern');
		}
		// }}}

		var settings = _.defaults(options || {}, {
		});

		async()
			.set('metaFields', [
				'$id', // Mandatory field to specify while record to update
				'$collection', // Collection to query to find the original record
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for delete operation');
				if (!q.$collection) return next('$collection must be specified for delete operation');
				if (!q.$id) return next('ID must be speciied during delete operation');
				next();
			})
			// }}}
			// .connection {{{
			.then('connection', function(next) {
				if (!mongoose.connection) return next('No Mongoose connection open');
				next(null, mongoose.connection);
			})
			// }}}
			// .model {{{
			.then('model', function(next) {
				if (!q.$collection) return next('Collection not specified');
				if (!_.has(this.connection, 'base.models.' + q.$collection)) return next('Invalid collection');
				next(null, this.connection.base.models[q.$collection].schema);
			})
			// }}}
			// Find the row by its ID - call to self.query() {{{
			.then('row', function(next) {
				self.query({
					$id: q.$id,
					$collection: q.$collection,
				}, next);
			})
			// }}}
			// Delete record {{{
			.then('newRec', function(next) {
				this.row.remove(next);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) return callback(err);
				return callback(null, this.newRec);
			});
			// }}}
	};
	// }}}

	// .queryBuilder([options]) - query builder {{{
	self.queryBuilder = function(options) {
		var settings = _.defaults(options || {}, {
		});

		var qb = this;
		qb.query = {};
		qb.settings = settings;

		// qb.find(q, cb) {{{
		qb.find = function(q, callback) {
			if (_.isObject(q)) _.merge(qb.query, q);
			if (_.isFunction(q)) return qb.exec(callback);
			return qb;
		};
		// }}}

		// qb.sort(q, cb) {{{
		qb.sort = function(q, callback) {
			if (_.isString(q)) {
				if (qb.query.$sort) {
					qb.query.$sort.push(q);
				} else {
					qb.query.$sort = [q];
				}
			} else if (_.isArray(q)) {
				if (qb.query.$sort) {
					qb.query.$sort.push.apply(this, q);
				} else {
					qb.query.$sort = q;
				}
			} else {
				throw new Error('Sort parameter type is unsupported');
			}
			if (_.isFunction(q)) return qb.exec(callback);
			return qb;
		};
		// }}}

		// qb.populate(q, cb) {{{
		qb.populate = function(q, callback) {
			if (_.isString(q)) {
				if (qb.query.$populate) {
					qb.query.$populate.push(q);
				} else {
					qb.query.$populate = [q];
				}
			} else if (_.isArray(q)) {
				if (qb.query.$populate) {
					qb.query.$populate.push.apply(this, q);
				} else {
					qb.query.$populate = q;
				}
			} else {
				throw new Error('Populate parameter type is unsupported');
			}
			if (_.isFunction(q)) return qb.exec(callback);
			return qb;
		};
		// }}}

		// qb.exec(cb) {{{
		qb.exec = function(callback) {
			if (!_.isFunction(callback)) throw new Error('Callback to exec() is not a function');

			return self.query(qb.query, qb.settings, callback);
		};
		// }}}

		return qb;
	};
	// }}}

	// .model(model) - model returner {{{
	self.model = function(model) {
		// Deal with arguments {{{
		if (!_.isString(model)) throw new Error('Model reference must be a string');
		// }}}

		var qb = new self.queryBuilder();
		return qb.find({$collection: model});
	};
	// }}}

	// .schema - Schema builder {{{
	self.schema = function(model, spec) {
		if (!_.isString(model) || !_.isObject(spec)) throw new Error('Schema construction requires a model ID + schema object');

		var schema = new mongoose.Schema(_.deepMapValues(spec, function(value, path) {
			if ( // Rewrite types to support 'oid' / 'objectId' / 'objectID' types
				_.endsWith(path, '.type') &&
				_.includes(['oid', 'pointer', 'objectId', 'objectID', 'ObjectID'], value)
			) {
				return mongoose.Schema.ObjectId;
			}
			return value;
		}));
		self.models[model] = mongoose.model(model, schema);
		return self.models[model];
	};
	// }}}

	// .express structure {{{
	self.express = {};

	// .express.middleware(settings) {{{
	self.express.middleware = function(settings) {
		// Deal with incomming settings object {{{
		if (_.isString(settings)) settings = {collection: settings};

		_.defaults(settings, {
			count: true,
			get: true,
			save: false,
			delete: false,
		});

		if (!settings.collection) throw new Error('No collection specified for monoxide.restGet(). Specify as a string or {collection: String}');
		// }}}

		return function(req, res, next) {
			if (settings.count && req.method == 'GET' && req.params.id && req.params.id == 'count') {
				self.express.count(settings)(req, res, next);
			} else if (settings.get && req.method == 'GET') {
				self.express.get(settings)(req, res, next);
			} else if (settings.save && req.method == 'POST') {
				self.express.save(settings)(req, res, next);
			} else if (settings.delete && req.method == 'DELETE') {
				self.express.delete(settings)(req, res, next);
			} else {
				res.status(404).end();
			}
		};
	};
	// }}}

	// .express.get(settings) {{{
	self.express.get = function MonoxideExpressGet(settings) {
		// Deal with incomming settings object {{{
		if (_.isString(settings)) settings = {collection: settings};

		_.defaults(settings, {
			collection: null, // The collection to operate on
			queryRemaps: { // Remap incomming values on left to keys on right
				sort: '$sort',
				populate: '$populate',
			},
			passThrough: false, // If true this module will behave as middleware gluing req.document as the return, if false it will handle the resturn values via `res` itself
		});

		if (!settings.collection) throw new Error('No collection specified for monoxide.restGet(). Specify as a string or {collection: String}');
		// }}}

		return function(req, res, next) {
			var q = _(req.query)
				.mapKeys(function(val, key) {
					if (settings.queryRemaps[key]) return settings.queryRemaps[key];
					return key;
				})
				.value();

			q.$collection = settings.collection;

			if (req.params.id) q.$id = req.params.id;

			self.query(q, function(err, rows) {
				if (settings.passThrough) { // Act as middleware
					req.document = rows;
					next(err, rows);
				} else if (err) { // Act as endpoint and there was an error
					res.status(400).end();
				} else { // Act as endpoint and result is ok
					res.send(rows).end();
				}
			});
		};
	};
	// }}}

	// .express.count(settings) {{{
	self.express.count = function MonoxideExpressCount(settings) {
		// Deal with incomming settings object {{{
		if (_.isString(settings)) settings = {collection: settings};

		_.defaults(settings, {
			collection: null, // The collection to operate on
			passThrough: false, // If true this module will behave as middleware gluing req.document as the return, if false it will handle the resturn values via `res` itself
		});

		if (!settings.collection) throw new Error('No collection specified for monoxide.restGet(). Specify as a string or {collection: String}');
		// }}}

		return function(req, res, next) {
			var q = req.query;

			q.$collection = settings.collection;
			q.$count = true;

			self.query(q, function(err, count) {
				if (settings.passThrough) { // Act as middleware
					req.document = count;
					next(err, count);
				} else if (err) { // Act as endpoint and there was an error
					res.status(400).end();
				} else { // Act as endpoint and result is ok
					res.send(count).end();
				}
			});
		};
	};
	// }}}

	// .express.save(settings) {{{
	self.express.save = function MonoxideExpressSave(settings) {
		// Deal with incomming settings object {{{
		if (_.isString(settings)) settings = {collection: settings};

		_.defaults(settings, {
			collection: null, // The collection to operate on
			passThrough: false, // If true this module will behave as middleware, if false it will handle the resturn values via `res` itself
		});

		if (!settings.collection) throw new Error('No collection specified for monoxide.restGet(). Specify as a string or {collection: String}');
		// }}}

		return function(req, res, next) {
			var q = _.clone(req.body);

			q.$collection = settings.collection;

			if (req.params.id) q.$id = req.params.id;

			self.save(q, function(err, rows) {
				if (settings.passThrough) { // Act as middleware
					next(err, rows);
				} else if (err) { // Act as endpoint and there was an error
					res.status(400).end();
				} else { // Act as endpoint and result is ok
					res.send(rows).end();
				}
			});
		};
	};
	// }}}

	// .express.delete(settings) {{{
	self.express.delete = function MonoxideExpressSave(settings) {
		// Deal with incomming settings object {{{
		if (_.isString(settings)) settings = {collection: settings};

		_.defaults(settings, {
			collection: null, // The collection to operate on
			passThrough: false, // If true this module will behave as middleware, if false it will handle the resturn values via `res` itself
		});

		if (!settings.collection) throw new Error('No collection specified for monoxide.restGet(). Specify as a string or {collection: String}');
		// }}}

		return function(req, res, next) {
			var q = _.clone(req.body);

			q.$collection = settings.collection;

			if (req.params.id) q.$id = req.params.id;

			self.delete(q, function(err, rows) {
				if (settings.passThrough) { // Act as middleware
					next(err, rows);
				} else if (err) { // Act as endpoint and there was an error
					res.status(400).end();
				} else { // Act as endpoint and result is ok
					res.send(rows).end();
				}
			});
		};
	};
	// }}}

	// }}}

	return self;
}

util.inherits(Monoxide, events.EventEmitter);

module.exports = Monoxide();
