var _ = require('lodash')
	.mixin(require('lodash-deep'));
var async = require('async-chainable');
var events = require('events');
var mongoose = require('mongoose');
var util = require('util');

/**
* @static monoxide
*/
function Monoxide() {
	var self = this;
	self.models = {};
	self.connection;

	// .connect {{{
	/**
	* Connect to a Mongo database
	* @param {string} uri The URL of the database to connect to
	* @param {function} callback Optional callback when connected, if omitted this function is syncronous
	* @return {monoxide} The Monoxide chainable object
	*/
	self.connect = function(uri, callback) {
		mongoose.connect('mongodb://localhost/monoxide-test', callback);
		self.connection = mongoose.connection;
		return self;
	};
	// }}}

	// .get([q], [id], callback) {{{
	/**
	* Retrieve a single record from a model via its ID
	* This function will ONLY retrieve via the ID field, all other fields are ignored
	* NOTE: Really this function just wraps the monoxide.query() function to provide functionality like populate
	*
	* @name monoxide.get
	* @memberof monoxide
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {string} [q.$id] The ID to return
	* @param {(string|string[]|object[])} [q.$populate] Population criteria to apply
	*
	* @param {string} [id] The ID to return (alternative syntax)
	*
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	*
	* @param {function} callback(err, result) the callback to call on completion or error
	*
	* @return {Object} This chainable object
	*
	* @example
	* // Return a single widget by its ID (string syntax)
	* monoxide.get('widgets', '56e2421f475c1ef4135a1d58', function(err, res) {
	* 	console.log('Widget:', res);
	* });
	*
	* @example
	* // Return a single widget by its ID (object syntax)
	* monoxide.get({$collection: 'widgets', $id: '56e2421f475c1ef4135a1d58'}, function(err, res) {
	* 	console.log('Widget:', res);
	* });
	*/
	self.get = function(q, id, options, callback) {
		// Deal with arguments {{{
		if (_.isObject(q) && _.isObject(options) && _.isFunction(callback)) {
			// All ok
		} else if (_.isObject(q) && _.isFunction(id)) {
			callback = id;
			options = {};
		} else if (_.isString(q) && _.isString(id) && _.isObject(options) && _.isFunction(callback)) {
			q = {
				$collection: q,
				$id: id,
			};
		} else if (_.isString(q) && _.isObject(id) && _.isObject(options) && _.isFunction(callback)) { // Probably being passed a Mongoose objectId as the ID
			q = {
				$collection: q,
				$id: id.toString(),
			};
		} else if (_.isString(q) && _.isObject(id) && _.isFunction(options)) { // Probably being passed a Mongoose objectId as the ID
			q = {
				$collection: q,
				$id: id.toString(),
			};
			callback = options;
		} else if (_.isString(q) && _.isString(id) && _.isFunction(options)) {
			q = {
				$collection: q,
				$id: id,
			};
			callback = options;
		} else if (!_.isFunction(callback)) {
			throw new Error('Callback parameter must be function');
		} else {
			throw new Error('Unknown function call pattern');
		}
		// }}}

		if (!q.$id) return callback('No $id specified');
		return self.query(q, options, callback);
	};
	// }}}

	// .query([q], [options], callback) {{{
	/**
	* Query Mongo directly with the Monoxide query syntax
	*
	* @name monoxide.query
	* @memberof monoxide
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {string} [q.$id] If specified return only one record by its master ID (implies $one=true). If present all other conditionals will be ignored and only the object is returned (see $one)
	* @param {(string|string[]|object[])} [q.$sort] Sorting criteria to apply
	* @param {(string|string[]|object[])} [q.$populate] Population criteria to apply
	* @param {boolean} [q.$one=false] Whether a single object should be returned (implies $limit=1). If enabled an object is returned not an array
	* @param {number} [q.$limit] Limit the return to this many rows
	* @param {number} [q.$skip] Offset return by this number of rows
	* @param {boolean=false} [q.$count=false] Only count the results - do not return them. If enabled a number of returned with the result
	* @param {...*} [q.filter] Any other field (not beginning with '$') is treated as filtering criteria
	*
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	* @param {boolean} [options.cacheFKs=true] Whether to cache the foreign keys (objectIDs) within an object so future retrievals dont have to recalculate the model structure
	*
	* @param {function} callback(err, result) the callback to call on completion or error. If $one is truthy this returns a single monoxide.monoxideDocument, if not it returns an array of them
	*
	* @return {Object} This chainable object
	*
	* @example
	* // Return all Widgets, sorted by name
	* monoxide.query({$collection: 'widgets', $sort: 'name'}, function(err, res) {
	* 	console.log('Widgets:', res);
	* });
	* @example
	* // Filter Users to only return admins while also populating their country
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
				'$count', // Only count the results - do not return them
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
				var FKs = self.utilities.extractFKs(this.model);
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
					callback(null, this.result);
				} else {
					callback(null, this.result);
				}
			});
			// }}}
		return self;
	};
	// }}}

	// .count([q], [options], callback) {{{
	/**
	* Similar to query() but only return the count of possible results rather than the results themselves
	*
	* @name monoxide.count
	* @see monoxide.query
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {...*} [q.filter] Any other field (not beginning with '$') is treated as filtering criteria
	*
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	*
	* @param {function} callback(err,count) the callback to call on completion or error
	*
	* @return {Object} This chainable object
	*
	* @example
	* // Count all Widgets
	* monoxide.count({$collection: 'widgets'}, function(err, count) {
	* 	console.log('Number of Widgets:', count);
	* });
	*
	* @example
	* // Count all admin Users
	* monoxide.query({$collection: 'users', role: 'admin'}, function(err, count) {
	* 	console.log('Number of Admin Users:', count);
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
	* Save an existing Mongo document by its ID
	* If you wish to create a new document see the monoxide.create() function.
	* This function will first attempt to retrieve the ID and if successful will save, if the document is not found this function will execute the callback with an error
	*
	* @name monoxide.save
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {string} q.$id The ID of the document to save
	* @param {...*} [q.field] Any other field (not beginning with '$') is treated as data to save
	*
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	* @param {boolean} [options.refetch=true] Whether to refetch the record after update, false returns `null` in the callback
	*
	* @param {function} callback(err, result) the callback to call on completion or error
	*
	* @return {Object} This chainable object
	*
	* @example
	* // Save a Widget
	* monoxide.save({
	* 	$collection: 'widgets',
	* 	$id: 1234,
	* 	name: 'New name',
	* }, function(err, widget) {
	* 	console.log('Saved widget is now', widget);
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
			refetch: true, // Fetch and return the record when updated (false returns null)
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
				if (!q.$id) return next('ID not specified');
				if (!_.has(this.connection, 'base.models.' + q.$collection)) return next('Invalid collection');
				next(null, this.connection.base.models[q.$collection].schema);
			})
			// }}}
			// Peform the update {{{
			.then('rawResponse', function(next) {
				this.connection.base.models[q.$collection].update({_id: q.$id}, _.omit(q, this.metaFields), {multi: false}, next);
			})
			// }}}
			// Refetch the record {{{
			.then('newRec', function(next) {
				if (!settings.refetch) return next(null, null);
				self.query({
					$collection: q.$collection,
					$id: q.$id,
					$one: true,
				}, next);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) return callback(err);
				return callback(null, this.newRec);
			});
			// }}}

			return self;
	};
	// }}}

	// .create([item], options, callback) {{{
	/**
	* Create a new Mongo document and return it
	* If you wish to save an existing document see the monoxide.save() function.
	*
	* @name monoxide.create
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {...*} [q.field] Any other field (not beginning with '$') is treated as data to save
	*
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	*
	* @param {function} callback(err, result) the callback to call on completion or error
	*
	* @return {Object} This chainable object
	*
	* @example
	* // Create a Widget
	* monoxide.save({
	* 	$collection: 'widgets',
	* 	name: 'New widget name',
	* }, function(err, widget) {
	* 	console.log('Created widget is', widget);
	* });
	*/
	self.create = function MonoxideQuery(q, options, callback) {
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
			// Create record {{{
			.then('newRec', function(next) {
				this.connection.base.models[q.$collection].create(_.omit(q, this.metaFields), next);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) return callback(err);
				return callback(null, this.newRec);
			});
			// }}}

			return self;
	};
	// }}}

	// .delete([item], options, callback) {{{
	/**
	* Delete a Mongo document by its ID
	* This function will first attempt to retrieve the ID and if successful will delete it, if the document is not found this function will execute the callback with an error
	*
	* @name monoxide.delete
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {string} q.$id The ID of the document to delete
	*
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	*
	* @param {function} callback(err, result) the callback to call on completion or error
	*
	* @return {Object} This chainable object
	*
	* @example
	* // Save a Widgets
	* monoxide.query({$collection: 'widgets', name: 'New name'}, function(err, res) {
	* 	console.log('Saved widget:', res);
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
				if (!this.row) return next('Not found');
				this.row.remove(next);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) return callback(err);
				return callback(null, this.newRec);
			});
			// }}}

			return self;
	};
	// }}}

	// .queryBuilder([options]) - query builder {{{
	/**
	* Returns data from a Monoxide model
	* @class
	* @name monoxide.queryBuilder
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	* @return {monoxide.queryBuilder}
	*/
	self.queryBuilder = function monoxideQueryBuilder(options) {
		var settings = _.defaults(options || {}, {
		});

		var qb = this;
		qb.query = {};
		qb.settings = settings;

		// qb.find(q, cb) {{{
		/**
		* Add a filtering function to an existing query
		* @name monoxide.queryBuilder.find
		* @memberof monoxide.queryBuilder
		* @param {Object} [q] Optional filtering object
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.find = function(q, callback) {
			if (_.isObject(q)) _.merge(qb.query, q);
			if (_.isFunction(q)) return qb.exec(callback);
			return qb;
		};
		// }}}

		// qb.sort(q, cb) {{{
		/**
		* Add sort criteria to an existing query
		* @name monoxide.queryBuilder.sort
		* @memberof monoxide.queryBuilder
		* @param {Object|Array|string} [q] Sorting criteria, for strings or arrays of strings use the field name optionally prefixed with '-' for decending search order. For Objects use `{ field: 1|-1|'asc'|'desc'}`
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
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
		/**
		* Add population criteria to an existing query
		* @name monoxide.queryBuilder.populate
		* @memberof monoxide.queryBuilder
		* @param {Array|string} [q] Population criteria, for strings or arrays of strings use the field name
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
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
		/**
		* Execute the query and return the error and any results
		* @name monoxide.queryBuilder.exec
		* @memberof monoxide.queryBuilder
		* @param {function} callback(err,result)
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.exec = function(callback) {
			if (!_.isFunction(callback)) throw new Error('Callback to exec() is not a function');

			return self.query(qb.query, qb.settings, callback);
		};
		// }}}

		return qb;
	};
	// }}}

	// .monoxideModel([options]) - monoxide model instance {{{
	/**
	* @class
	*/
	self.monoxideModel = function monoxideModel(options) {
		// Deal with arguments {{{
		if (_.isString(options)) {
			options = {$collection: options};
		} else if (_.isObject(options)) {
			// All ok
		} else {
			throw new Error('Unknown function call pattern');
		}
		// }}}

		var settings = _.defaults(options || {}, {
		});

		var mm = this;

		mm.$collection = settings.$collection;
		mm.$methods = {};

		/**
		* Shortcut function to create a monoxide.queryBuilder object and immediately start filtering
		* This also sets $count=true in the queryBuilder
		* @name monoxide.monoxideModel.find
		* @see monoxide.queryBuilder.find
		*
		* @param {Object} [q] Optional filtering object
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder}
		*/
		mm.count = function(q, callback) {
			return (new self.queryBuilder())
				.find({
					$collection: mm.$collection, // Set the collection from the model
					$count: true,
				})
				.find(q, callback); // Then re-parse the find query into the new queryBuilder
		};

		/**
		* Shortcut function to create a monoxide.queryBuilder object and immediately start filtering
		* @name monoxide.monoxideModel.find
		* @see monoxide.queryBuilder.find
		*
		* @param {Object} [q] Optional filtering object
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder}
		*/
		mm.find = function(q, callback) {
			return (new self.queryBuilder())
				.find({$collection: mm.$collection}) // Set the collection from the model
				.find(q, callback); // Then re-parse the find query into the new queryBuilder
		};


		/**
		* Shortcut function to create a monoxide.queryBuilder object and immediately start filtering
		* This also sets $one=true in the queryBuilder
		* @name monoxide.monoxideModel.findOne
		* @see monoxide.queryBuilder.find
		*
		* @param {Object} [q] Optional filtering object
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder}
		*/
		mm.findOne = function(q, callback) {
			return (new self.queryBuilder())
				.find({
					$collection: mm.$collection, // Set the collection from the model
					$one: true, // Return a single object
				})
				.find(q, callback); // Then re-parse the find query into the new queryBuilder
		};


		/**
		* Shortcut function to create a monoxide.queryBuilder object and immediately start filtering
		* This also sets $id=q in the queryBuilder
		* @name monoxide.monoxideModel.findOneByID
		* @see monoxide.queryBuilder.find
		*
		* @param {Object} [q] Optional filtering object
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder}
		*/
		mm.findOneByID = function(q, callback) {
			// Deal with arguments {{{
			if (_.isString(q)) {
				// All ok
			} else {
				throw new Error('Unknown function call pattern');
			}
			// }}}

			return (new self.queryBuilder())
				.find({
					$collection: mm.$collection, // Set the collection from the model
					$id: q,
				})
				.find(q, callback); // Then re-parse the find query into the new queryBuilder
		};


		/**
		* Shortcut function to create a new record within a collection
		* @name monoxide.monoxideModel.create
		* @see monoxide.create
		*
		* @param {Object} [q] Optional document contents
		* @param {Object} [options] Optional options object which can alter behaviour of the function
		* @param {function} [callback] Optional callback
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.create = function(q, options, callback) {
			// Deal with arguments {{{
			if (_.isObject(q) && _.isObject(options) && _.isFunction(callback)) {
				// All ok
			} else if (_.isObject(q) && _.isFunction(options)) {
				callback = options;
				options = {};
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

			q.$collection = mm.$collection;

			self.create(q, options, callback);
			return mm;
		};


		/**
		* Add a method to a all documents returned from this model
		* A method is a user defined function which extends the `monoxide.monoxideDocument` prototype
		* @param {string} name The function name to add as a static method
		* @param {function} func The function to add as a static method
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.method = function(name, func) {
			mm.$methods[name] = func;
			return mm;
		};


		/**
		* Add a static method to a model
		* A static is a user defined function which extends the `monoxide.monoxideModel` prototype
		* @param {string} name The function name to add as a static method
		* @param {function} func The function to add as a static method
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.static = function(name, func) {
			mm[name] = func;
			return mm;
		};

		return mm;
	};
	// }}}

	// .model(name) - helper function to return a declared model {{{
	/**
	* Return a defined Monoxide model
	* The model must have been previously defined by monoxide.schema()
	* This function is identical to accessing the model directly via `monoxide.models[modelName]`
	*
	* @name monoxide.model
	* @see monoxide.schema
	*
	* @param {string} model The model name (generally lowercase plurals e.g. 'users', 'widgets', 'favouriteItems' etc.)
	* @returns {Object} The monoxide model of the generated schema
	*/
	self.model = function(model) {
		return self.models[model];
	};
	// }}}

	// .schema - Schema builder {{{
	/**
	* Construct and return a Mongo model
	* This function creates a valid schema specificaion then returns it as if model() were called
	*
	* @name monoxide.schema
	* @see monoxide.model
	*
	* @param {string} model The model name (generally lowercase plurals e.g. 'users', 'widgets', 'favouriteItems' etc.)
	* @param {Object} spec The schema specification composed of a hierarhical object of keys with each value being the specification of that field
	* @returns {Object} The monoxide model of the generated schema
	*
	* @example
	* // Example schema for a widget
	* var Widgets = monoxide.schema('widgets', {
	* 	name: String,
	* 	content: String,
	* 	status: {type: String, enum: ['active', 'deleted'], default: 'active'},
	* 	color: {type: String, enum: ['red', 'green', 'blue'], default: 'blue', index: true},
	* });
	*
	* @example
	* // Example schema for a user
	* var Users = monoxide.schema('users', {
	* 	name: String,
	* 	role: {type: String, enum: ['user', 'admin'], default: 'user'},
	* 	favourite: {type: 'pointer', ref: 'widgets'},
	* 	items: [{type: 'pointer', ref: 'widgets'}],
	* 	mostPurchased: [
	* 		{
	* 			number: {type: Number, default: 0},
	* 			item: {type: 'pointer', ref: 'widgets'},
	* 		}
	* 	],
	* });
	*/
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

		// Add to model storage
		self.models[model] = new self.monoxideModel({
			$collection: model,
			$mongoose: mongoose.model(model, schema),
		});

		return self.models[model];
	};
	// }}}

	// .aggregate([q], [options], callback) {{{
	/**
	* Perform a direct aggregation and return the result
	*
	* @name monoxide.aggregate
	* @memberof monoxide
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {array} q.$stages The aggregation stages array
	* @param {Object} [q.$stages.$project] Fields to be supplied in the aggregation (in the form `{field: true}`)
	* @param {boolean} [q.$stages.$project._id=false] If true surpress the output of the `_id` field
	* @param {Object} [q.$stages.$match] Specify a filter on fields (in the form `{field: CRITERIA}`)
	* @param {Object} [q.$stages.$redract]
	* @param {Object} [q.$stages.$limit]
	* @param {Object} [q.$stages.$skip]
	* @param {Object} [q.$stages.$unwind]
	* @param {Object} [q.$stages.$group]
	* @param {Object} [q.$stages.$sample]
	* @param {Object} [q.$stages.$sort] Specify an object of fields to sort by (in the form `{field: 1|-1}` where 1 is ascending and -1 is decending sort order)
	* @param {Object} [q.$stages.$geoNear]
	* @param {Object} [q.$stages.$lookup]
	* @param {Object} [q.$stages.$out]
	* @param {Object} [q.$stages.$indexStats]
	*
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	*
	* @param {function} callback(err, result) the callback to call on completion or error
	*
	* @return {Object} This chainable object
	*/
	self.aggregate = function MonoxideAggregate(q, options, callback) {
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
		});

		async()
			// Sanity checks {{{
			.then(function(next) {
				if (!q.$stages || !_.isArray(q.$stages)) return next('$stages must be specified as an array');
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
				next(null, this.connection.collection(q.$collection));
			})
			// }}}
			// Execute and capture return {{{
			.then('result', function(next) {
				this.model.aggregate(q.$stages, next);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					return callback(err);
				} else {
					callback(null, this.result);
				}
			});
			// }}}
		return self;
	};
	// }}}

	// .express structure {{{
	/**
	* @static monoxide.express
	*/
	self.express = {};
	self.express._defaults = {
		count: true,
		get: true,
		query: true,
		create: false,
		save: false,
		delete: false,
	};

	/**
	* Set the default settings used when calling other monoxide.express.middleware functions
	* The provided settings will be merged with the existing defaults, so its possible to call this function multiple times to override previous invocations
	* NOTE: This will only effect functions called AFTER it was invoked.
	*
	* @name monoxide.express.defaults
	*
	* @param {string} [model] The model name to bind to (this can also be specified as settings.collection)
	* @param {Object} [settings] Middleware settings
	* @returns {monoxide} This chainable monoxide instance
	*
	* @example
	* // Enable saving globally
	* monoxide.express.defaults({save: true});
	*
	* @example
	* // Add a middleware function to all delete operations (assuming the invidiual controllers dont override it)
	* monoxide.express.defaults({
	* 	delete: function(req, res, next) {
	* 		// Check the user is logged in - deny otherwise
	* 		if (!req.user) return res.status(403).send('You are not logged in').end();
	* 		next();
	* 	},
	* });
	*/
	self.express.defaults = function(settings) {
		_.merge(self.express._defaults, settings);
		return self;
	};

	// .express.middleware(settings) {{{
	/**
	* Return an Express middleware binding
	*
	* See monoxide.express.defaults() to chanthe the default settings for this function globally
	*
	* @name monoxide.express.middleware
	*
	* @param {string} [model] The model name to bind to (this can also be specified as settings.collection)
	* @param {Object} [settings] Middleware settings
	* @param {string} [settings.collection] The model name to bind to
	* @param {boolean|monoxide.express.middlewareCallback} [settings.count=true] Allow GET + Count functionality
	* @param {boolean|monoxide.express.middlewareCallback} [settings.get=true] Allow single record retrieval by its ID via the GET method. If this is disabled an ID MUST be specified for any GET to be successful within req.params
	* @param {boolean|monoxide.express.middlewareCallback} [settings.query=true] Allow record querying via the GET method
	* @param {boolean|monoxide.express.middlewareCallback} [settings.create=false] Allow the creation of records via the POST method
	* @param {boolean|monoxide.express.middlewareCallback} [settings.save=false] Allow saving of records via the POST method
	* @param {boolean|monoxide.express.middlewareCallback} [settings.delete=false] Allow deleting of records via the DELETE method
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to serve widgets
	* app.use('/api/widgets/:id?', monoxide.express.middleware('widgets'));
	*
	* @example
	* // Bind an express method to serve users but disallow counting and querying (i.e. direct ID access only)
	* app.use('/api/users/:id?', monoxide.express.middleware('users', {query: false, count: false}));
	*/
	self.express.middleware = function(model, settings) {
		// Deal with incomming settings object {{{
		if (_.isString(model) && _.isObject(settings)) {
			settings.collection = model;
		} else if (_.isString(model)) {
			settings = {collection: model};
		} else if (_.isObject(model)) {
			settings = model;
		} else if (!settings) {
			settings = {};
		}

		_.defaults(settings, self.express._defaults);

		if (!settings.collection) throw new Error('No collection specified for monoxide.express.middleware(). Specify as a string or {collection: String}');
		// }}}

		return function(req, res, next) {
			req.monoxide = { // Setup object to pass params to callback functions
				collection: settings.collection,
			};

			// Count {{{
			if (settings.count && req.method == 'GET' && req.params.id && req.params.id == 'count' && _.isFunction(settings.count)) {
				settings.count(req, res, function(err) {
					if (err) return next(err);
					self.express.count(settings)(req, res, next);
				});
			} else if (settings.count && req.method == 'GET' && req.params.id && req.params.id == 'count') {
				self.express.count(settings)(req, res, next);
			// }}}
			// Get {{{
			} else if (settings.get && req.method == 'GET' && req.params.id && _.isFunction(settings.get)) {
				req.monoxide.id = req.params.id;
				settings.get(req, res, function(err) {
					if (err) return next(err);
					self.express.get(settings)(req, res, next);
				});
			} else if (settings.get && req.method == 'GET' && req.params.id) {
				self.express.get(settings)(req, res, next);
			// }}}
			// Query {{{
			} else if (settings.query && req.method == 'GET' && _.isFunction(settings.query)) {
				settings.query(req, res, function(err) {
					if (err) return next(err);
					self.express.query(settings)(req, res, next);
				});
			} else if (settings.query && req.method == 'GET') {
				self.express.query(settings)(req, res, next);
			// }}}
			// Save {{{
			} else if (settings.save && req.method == 'POST' && req.params.id && _.isFunction(settings.save)) {
				req.monoxide.id = req.params.id;
				settings.save(req, res, function(err) {
					if (err) return next(err);
					self.express.save(settings)(req, res, next);
				});
			} else if (settings.save && req.method == 'POST' && req.params.id) {
				self.express.save(settings)(req, res, next);
			// }}}
			// Create {{{
			} else if (settings.create && req.method == 'POST' && _.isFunction(settings.create)) {
				req.monoxide.id = req.params.id;
				settings.create(req, res, function(err) {
					if (err) return next(err);
					self.express.create(settings)(req, res, next);
				});
			} else if (settings.create && req.method == 'POST') {
				self.express.create(settings)(req, res, next);
			// }}}
			// Delete {{{
			} else if (settings.delete && req.method == 'DELETE' && _.isFunction(settings.delete)) {
				req.monoxide.id = req.params.id;
				settings.delete(req, res, function(err) {
					if (err) return next(err);
					self.express.delete(settings)(req, res, next);
				});
			} else if (settings.delete && req.method == 'DELETE') {
				self.express.delete(settings)(req, res, next);
			// }}}
			// Unknown {{{
			} else {
				res.status(404).end();
			}
			// }}}
		};
	};
	// }}}

	// .express.get(settings) {{{
	/**
	* Return an Express middleware binding for single record retrieval operations
	* Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router
	*
	* @name monoxide.express.get
	*
	* @param {string} [model] The model name to bind to (this can also be specified as settings.collection)
	* @param {Object} [settings] Middleware settings
	* @param {string} [settings.collection] The model name to bind to
	* @param {string} [settings.queryRemaps] Object of keys that should be translated from the incomming req.query into their Monoxide equivelents (e.g. `{populate: '$populate'`})
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to serve widgets
	* app.get('/api/widgets/:id?', monoxide.express.get('widgets'));
	*/
	self.express.get = function MonoxideExpressGet(model, settings) {
		// Deal with incomming settings object {{{
		if (_.isString(model) && _.isObject(settings)) {
			settings.collection = model;
		} else if (_.isString(model)) {
			settings = {collection: model};
		} else if (_.isObject(model)) {
			settings = model;
		} else if (!settings) {
			settings = {};
		}

		_.defaults(settings, {
			collection: null, // The collection to operate on
			queryRemaps: { // Remap incomming values on left to keys on right
				populate: '$populate',
			},
			passThrough: false, // If true this module will behave as middleware gluing req.document as the return, if false it will handle the resturn values via `res` itself
		});

		if (!settings.collection) throw new Error('No collection specified for monoxide.express.get(). Specify as a string or {collection: String}');
		// }}}

		return function(req, res, next) {
			if (!req.params.id) return res.send('No ID specified').status(404).end();

			var q = _(req.query)
				.mapKeys(function(val, key) {
					if (settings.queryRemaps[key]) return settings.queryRemaps[key];
					return key;
				})
				.value();

			q.$collection = settings.collection;
			q.$id = req.params.id;

			self.get(q, function(err, doc) {
				if (settings.passThrough) { // Act as middleware
					req.document = doc;
					next(err, rows);
				} else if (err) { // Act as endpoint and there was an error
					res.status(400).end();
				} else { // Act as endpoint and result is ok
					res.send(doc).end();
				}
			});
		};
	};
	// }}}

	// .express.query(settings) {{{
	/**
	* Return an Express middleware binding for multiple record retrieval operations
	* Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router
	*
	* @name monoxide.express.query
	*
	* @param {string} [model] The model name to bind to (this can also be specified as settings.collection)
	* @param {Object} [settings] Middleware settings
	* @param {string} [settings.collection] The model name to bind to
	* @param {string} [settings.queryRemaps] Object of keys that should be translated from the incomming req.query into their Monoxide equivelents (e.g. `{populate: '$populate'`})
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to serve widgets
	* app.get('/api/widgets', monoxide.express.query('widgets'));
	*/
	self.express.query = function MonoxideExpressQuery(model, settings) {
		// Deal with incomming settings object {{{
		if (_.isString(model) && _.isObject(settings)) {
			settings.collection = model;
		} else if (_.isString(model)) {
			settings = {collection: model};
		} else if (_.isObject(model)) {
			settings = model;
		} else if (!settings) {
			settings = {};
		}

		_.defaults(settings, {
			collection: null, // The collection to operate on
			queryRemaps: { // Remap incomming values on left to keys on right
				limit: '$limit',
				skip: '$skip',
				sort: '$sort',
				populate: '$populate',
			},
			passThrough: false, // If true this module will behave as middleware gluing req.document as the return, if false it will handle the resturn values via `res` itself
		});

		if (!settings.collection) throw new Error('No collection specified for monoxide.express.query(). Specify as a string or {collection: String}');
		// }}}

		return function(req, res, next) {
			var q = _(req.query)
				.mapKeys(function(val, key) {
					if (settings.queryRemaps[key]) return settings.queryRemaps[key];
					return key;
				})
				.value();

			q.$collection = settings.collection;

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
	/**
	* Return an Express middleware binding for GET operations - specifically for returning COUNTs of objects
	* Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router
	*
	* @name monoxide.express.count
	*
	* @param {string} [model] The model name to bind to (this can also be specified as settings.collection)
	* @param {Object} [settings] Middleware settings
	* @param {string} [settings.collection] The model name to bind to
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to count widgets
	* app.get('/api/widgets/count', monoxide.express.get('widgets'));
	*/
	self.express.count = function MonoxideExpressCount(model, settings) {
		// Deal with incomming settings object {{{
		if (_.isString(model) && _.isObject(settings)) {
			settings.collection = model;
		} else if (_.isString(model)) {
			settings = {collection: model};
		} else if (_.isObject(model)) {
			settings = model;
		} else if (!settings) {
			settings = {};
		}

		_.defaults(settings, {
			collection: null, // The collection to operate on
			passThrough: false, // If true this module will behave as middleware gluing req.document as the return, if false it will handle the resturn values via `res` itself
		});

		if (!settings.collection) throw new Error('No collection specified for monoxide.express.count(). Specify as a string or {collection: String}');
		// }}}

		return function(req, res, next) {
			var q = req.query;

			q.$collection = settings.collection;
			q.$count = true;

			self.query(q, function(err, count) {
				if (settings.passThrough) { // Act as middleware
					req.document = count;
					next(err, {count: count});
				} else if (err) { // Act as endpoint and there was an error
					res.status(400).end();
				} else { // Act as endpoint and result is ok
					res.send({count: count}).end();
				}
			});
		};
	};
	// }}}

	// .express.save(settings) {{{
	/**
	* Return an Express middleware binding for POST/PATCH operations which update an existing record with new fields
	* Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router
	*
	* @name monoxide.express.save
	*
	* @param {string} [model] The model name to bind to (this can also be specified as settings.collection)
	* @param {Object} [settings] Middleware settings
	* @param {string} [settings.collection] The model name to bind to
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to save widgets
	* app.post('/api/widgets/:id', monoxide.express.save('widgets'));
	*/
	self.express.save = function MonoxideExpressSave(model, settings) {
		// Deal with incomming settings object {{{
		if (_.isString(model) && _.isObject(settings)) {
			settings.collection = model;
		} else if (_.isString(model)) {
			settings = {collection: model};
		} else if (_.isObject(model)) {
			settings = model;
		} else if (!settings) {
			settings = {};
		}

		_.defaults(settings || {}, {
			collection: null, // The collection to operate on
			passThrough: false, // If true this module will behave as middleware, if false it will handle the resturn values via `res` itself
		});

		if (!settings.collection) throw new Error('No collection specified for monoxide.express.save(). Specify as a string or {collection: String}');
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

	// .express.create(settings) {{{
	/**
	* Return an Express middleware binding for POST/PUT operations which create a new record
	* Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router
	*
	* @name monoxide.express.create
	*
	* @param {string} [model] The model name to bind to (this can also be specified as settings.collection)
	* @param {Object} [settings] Middleware settings
	* @param {string} [settings.collection] The model name to bind to
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to create widgets
	* app.post('/api/widgets', monoxide.express.create('widgets'));
	*/
	self.express.create = function MonoxideExpressCreate(model, settings) {
		// Deal with incomming settings object {{{
		if (_.isString(model) && _.isObject(settings)) {
			settings.collection = model;
		} else if (_.isString(model)) {
			settings = {collection: model};
		} else if (_.isObject(model)) {
			settings = model;
		} else if (!settings) {
			settings = {};
		}

		_.defaults(settings || {}, {
			collection: null, // The collection to operate on
			passThrough: false, // If true this module will behave as middleware, if false it will handle the resturn values via `res` itself
		});

		if (!settings.collection) throw new Error('No collection specified for monoxide.express.create(). Specify as a string or {collection: String}');
		// }}}

		return function(req, res, next) {
			var q = _.clone(req.body);

			q.$collection = settings.collection;

			if (req.params.id) q.$id = req.params.id;

			self.create(q, function(err, rows) {
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
	/**
	* Return an Express middleware binding for DELETE operations
	* Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router
	*
	* @name monoxide.express.delete
	*
	* @param {string} [model] The model name to bind to (this can also be specified as settings.collection)
	* @param {Object} [settings] Middleware settings
	* @param {string} [settings.collection] The model name to bind to
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to delete widgets
	* app.delete('/api/widgets/:id', monoxide.express.delete('widgets'));
	*/
	self.express.delete = function MonoxideExpressDelete(model, settings) {
		// Deal with incomming settings object {{{
		if (_.isString(model) && _.isObject(settings)) {
			settings.collection = model;
		} else if (_.isString(model)) {
			settings = {collection: model};
		} else if (_.isObject(model)) {
			settings = model;
		} else if (!settings) {
			settings = {};
		}

		_.defaults(settings, {
			collection: null, // The collection to operate on
			passThrough: false, // If true this module will behave as middleware, if false it will handle the resturn values via `res` itself
		});

		if (!settings.collection) throw new Error('No collection specified for monoxide.express.delete(). Specify as a string or {collection: String}');
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

	// .express - MISC functionality {{{
	// Express middleware callback {{{
	/**
	* Callback function for Express middleware
	* This callback applies to the monoxide.express.middleware() function for get, query, save, delete etc.
	*
	* @name monoxide.express.middlewareCallback
	* @callback monoxide.express.middlewareCallback
	*
	* @param {Object} req The request object
	* @param {Object} res The response object
	* @param {function} next The next callback chain (optional to call this or deal with `res` yourself)
	* @example
	* // Allow deleting of widgets only if 'force'===true
	* app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
	* 	delete: function(req, res, next) {
	* 		// Only allow delete if the query contains 'force' as a string
	* 		if (req.query.force && req.query.force === 'confirm') return next();
	* 		return res.status(403).send('Nope!').end();
	* 	},
	* }));
	*/
	// }}}
	// }}}
	// }}}

	// .utilities structure {{{
	self.utilities = {};

	// .utilities.extractFKs(schema, prefix, base) {{{
	/**
	* Extract all FKs in dotted path notation from a Mongoose model
	*
	* @name monoxide.utilities.extractFKs
	*
	* @param {Object} schema The schema object to examine (usually connection.base.models[model].schema
	* @param {string} prefix existing Path prefix to use (internal use only)
	* @param {Object} base Base object to append flat paths to (internal use only)
	* @return {Object} A dictionary of foreign keys for the schema (each key will be the info of the object)
	*/
	self.utilities.extractFKs = function(schema, prefix, base) {
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
				_.forEach(self.utilities.extractFKs(path.schema, prefix + id + '.', base), function(val, key) {
					base[key] = val;
				});
			}
		});

		return FKs;
	}
	// }}}
	// }}}

	return self;
}

util.inherits(Monoxide, events.EventEmitter);

module.exports = Monoxide();
