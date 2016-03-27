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
		mongoose.connect(uri, callback);
		self.connection = mongoose.connection;
		// Replace the default Mongoose model set with Monoxide's
		// FIXME
		// self.connection.base.models = self.models;
		return self;
	};
	// }}}

	// .get(q, [id], callback) {{{
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
	* @fires query
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {string} [q.$id] If specified return only one record by its master ID (implies $one=true). If present all other conditionals will be ignored and only the object is returned (see $one)
	* @param {(string|string[]|object[])} [q.$select] Field selection criteria to apply (implies options.applySchema=false as we will be dealing with a partial schema)
	* @param {(string|string[]|object[])} [q.$sort] Sorting criteria to apply
	* @param {(string|string[]|object[])} [q.$populate] Population criteria to apply
	* @param {boolean} [q.$one=false] Whether a single object should be returned (implies $limit=1). If enabled an object is returned not an array
	* @param {number} [q.$limit] Limit the return to this many rows
	* @param {number} [q.$skip] Offset return by this number of rows
	* @param {boolean=false} [q.$count=false] Only count the results - do not return them. If enabled a number of returned with the result
	* @param {...*} [q.filter] Any other field (not beginning with '$') is treated as filtering criteria
	*
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	* @param {boolean} [options.cacheFKs=true] Cache the foreign keys (objectIDs) within an object so future retrievals dont have to recalculate the model structure
	* @param {boolean} [options.applySchema=true] Apply the schema for each document retrieval - this slows retrieval but means any alterations to the schema are applied to each retrieved record
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
			cacheFKs: true, // Cache model Foreign Keys (used for populates) or compute them every time
			applySchema: true, // Apply the schema on retrieval - this slows ths record retrieval but means any alterations to the schema are applied to each retrieved record
			errNotFound: true, // During $id / $one operations raise an error if the record is not found
		});

		if (!_.isEmpty(q.$select)) settings.applySchema = false; // Trun off schema application when using $select as we wont be grabbing the full object

		async()
			.set('metaFields', [
				'$collection', // Collection to query
				'$id', // If specified return only one record by its master ID (implies $one=true). If present all other conditionals will be ignored and only the object is returned (see $one)
				'$select', // Field selection criteria to apply
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
				if (!_.has(this.connection, 'base.models.' + q.$collection.toLowerCase())) return next('Invalid collection');
				next(null, this.connection.base.models[q.$collection.toLowerCase()].schema);
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
					next(null, this.connection.base.models[q.$collection.toLowerCase()].count(fields));
				} else if (q.$one) {
					next(null, this.connection.base.models[q.$collection.toLowerCase()].findOne(fields));
				} else {
					next(null, this.connection.base.models[q.$collection.toLowerCase()].find(fields));
				}
			})
			// }}}
			// Apply various simple criteria {{{
			.then(function(next) {
				if (q.$count) return next(); // No point doing anything else if just counting
				if (q.$populate) this.query.populate(q.$populate);
				if (q.$limit) this.query.limit(q.$limit);
				if (q.$skip) this.query.skip(q.$skip);

				// q.$select {{{
				if (q.$select) {
					if (_.isArray(q.$select)) {
						var query = this.query;
						q.$select.forEach(function(s) {
							query.select(s);
						});
					} else if (_.isString(q.$select) || _.isObject(q.$select)) {
						this.query.select(q.$select);
					} else {
						throw new Error('Invalid select type: ' + (typeof q.$select));
					}
				}
				// }}}
				// q.$sort {{{
				if (q.$sort) {
					if (_.isArray(q.$sort)) {
						var query = this.query;
						q.$sort.forEach(function(s) {
							query.sort(s);
						});
					} else if (_.isString(q.$sort) || _.isObject(q.$sort)) {
						this.query.sort(q.$sort);
					} else {
						throw new Error('Invalid sort type: ' + (typeof q.$sort));
					}
				}
				// }}}
				next();
			})
			// }}}
			// Fire hooks {{{
			.then(function(next) {
				self.models[q.$collection].fire('query', next, q);
			})
			// }}}
			// Execute and capture return {{{
			.then('result', function(next) {
				this.query.exec(function(err, res) {
					if (err) return next(err);

					if (q.$one) {
						if (_.isEmpty(res)) {
							if (settings.errNotFound) {
								next('Not found');
							} else {
								next(null, null);
							}
						} else {
							next(null, new self.monoxideDocument({$collection: q.$collection, $applySchema: settings.applySchema}, res));
						}
					} else if (q.$count) {
						next(null, res);
					} else {
						next(null, res.map(function(doc) {
							return new self.monoxideDocument({$collection: q.$collection, $applySchema: settings.applySchema}, doc.toObject());
						}));
					}
				});
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

	// .save(item, [options], [callback]) {{{
	/**
	* Save an existing Mongo document by its ID
	* If you wish to create a new document see the monoxide.create() function.
	* If the existing document ID is not found this function will execute the callback with an error
	*
	* @name monoxide.save
	* @fires save
	* @fires postSave
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {string} q.$id The ID of the document to save
	* @param {...*} [q.field] Any other field (not beginning with '$') is treated as data to save
	*
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	* @param {boolean} [options.refetch=true] Whether to refetch the record after update, false returns `null` in the callback
	* @param {boolean} [options.errNoUpdate=false] Raise an error if no documents were actually updated
	* @param {boolean} [options.returnUpdated=true] If true returns the updated document, if false it returns the document that was replaced
	*
	* @param {function} [callback(err,result)] Optional callback to call on completion or error
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
			errNoUpdate: false,
			returnUpdated: true,
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
			// .collection {{{
			.then('collection', function(next) {
				if (!self.connection) return next('No connection open');
				if (!q.$collection) return next('Collection not specified');
				if (!q.$id) return next('ID not specified');

				var col = self.connection.db.collection(q.$collection);
				if (!col) return next('Invalid collection');
				next(null, col);
			})
			// }}}
			// Fire the 'save' hook on the model {{{
			.then(function(next) {
				self.models[q.$collection].fire('save', next, q);
			})
			// }}}
			// Peform the update {{{
			.then('oldRec', function(next) { // Retrieve the original record
				self.query({$collection: q.$collection, $id: q.$id}, next);
			})
			.then('newRec', function(next) {
				var patch = self.utilities.diff(this.oldRec.toObject(), _.omit(q, this.metaFields));

				// Nothing to patch {{{
				if (_.isEmpty(patch)) {
					if (settings.errNoUpdate) {
						return next('Nothing to update');
					} else {
						return next(null, this.oldRec);
					}
				}
				// }}}

				this.collection.findOneAndUpdate(
					{ _id: self.utilities.objectID(q.$id) }, // What we are writing to
					{ $set: patch }, // What we are saving
					{ returnOriginal: !settings.returnUpdated }, // Options passed to Mongo
					function(err, res) {
						if (err) return next(err);
						// This would only really happen if the record has gone away since we started updating
						if (settings.errNoUpdate && !res.nModified) return next('No documents updated');
						if (!settings.refetch) return next(null, null);
						next(null, new self.monoxideDocument({$collection: q.$collection}, res.value));
					}
				);
			})
			// }}}
			// Fire the 'postSave' hook {{{
			.then(function(next) {
				self.models[q.$collection].fire('postSave', next, q);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (!_.isFunction(callback)) return; // Do nothing
				if (err) return callback(err);
				return callback(null, this.newRec);
			});
			// }}}

			return self;
	};
	// }}}

	// .update(q, [options], [callback]) {{{
	/**
	* Update multiple documents
	*
	* @name monoxide.update
	* @fires update
	*
	* @param {Object} q The object to query by
	* @param {string} q.$collection The collection / model to query
	* @param {...*} [q.field] Any other field (not beginning with '$') is treated as filter data
	*
	* @param {Object} qUpdate The object to update into the found documents
	* @param {...*} [qUpdate.field] Data to save into every record found by `q`
	*
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	* @param {boolean} [options.refetch=true] Return the newly updated record
	*
	* @param {function} [callback(err,result)] Optional callback to call on completion or error
	*
	* @return {Object} This chainable object
	*
	* @example
	* // Set all widgets to active
	* monoxide.update({
	* 	$collection: 'widgets',
	* 	status: 'active',
	* });
	*/
	self.update = function MonoxideUpdate(q, qUpdate, options, callback) {
		var self = this;
		// Deal with arguments {{{
		if (_.isObject(q) && _.isObject(qUpdate) && _.isObject(options) && _.isFunction(callback)) {
			// All ok
		} else if (_.isString(q) && _.isObject(qUpdate) && _.isObject(options) && _.isFunction(options)) {
			q = {$collection: q};
			callback = options;
			options = {};
		} else if (_.isObject(q) && _.isObject(qUpdate) && _.isFunction(options)) {
			callback = options;
			options = {};
		} else if (_.isString(q) && _.isObject(qUpdate) && _.isFunction(options)) {
			q = {$collection: q};
			callback = options;
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
				if (!_.has(this.connection, 'base.models.' + q.$collection.toLowerCase())) return next('Invalid collection');
				next(null, this.connection.base.models[q.$collection.toLowerCase()].schema);
			})
			// }}}
			// Fire the 'update' hook {{{
			.then(function(next) {
				self.models[q.$collection].fire('update', next, q);
			})
			// }}}
			// Peform the update {{{
			.then('rawResponse', function(next) {
				this.connection.base.models[q.$collection.toLowerCase()].update(_.omit(q, this.metaFields), _.omit(qUpdate, this.metaFields), {multi: true}, next);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (!_.isFunction(callback)) return; // Do nothing
				if (err) return callback(err);
				return callback(null, this.newRec);
			});
			// }}}

			return self;
	};
	// }}}

	// .create(item, [options], [callback]) {{{
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
	* @param {boolean} [options.refetch=true] Return the newly create record
	*
	* @param {function} [callback(err,result)] Optional callback to call on completion or error
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
			refetch: true, // Fetch and return the record when created (false returns null)
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
			// .collection {{{
			.then('collection', function(next) {
				if (!self.connection) return next('No connection open');
				if (!q.$collection) return next('Collection not specified');

				var col = self.connection.db.collection(q.$collection.toLowerCase());
				if (!col) return next('Invalid collection');
				next(null, col);
			})
			// }}}
			// Create record {{{
			.then('rawResponse', function(next) {
				var collection = this.collection;
				if (!self.models[q.$collection].hasHook(['create', 'postCreate']) && !self.models[q.$collection].hasVirtuals()) { // Can just splat the JSON object to create it
					collection.insertOne(_.omit(q, this.metaFields), next);
				} else { // Have to make a temporary object - fire all hooks and virtuals to create
					var newDocument = new self.monoxideDocument({$collection: q.$collection}, {});
					_.merge(newDocument, _.omit(q, this.metaFields)); // Set new fields (these should fire all virtual handlers)
					async()
						.then(function(next) {
							self.models[q.$collection].fire('create', next, newDocument);
						})
						.then('newRec2', function(next) {
							// Actually make the document
							collection.insertOne(newDocument.toObject(), next);
						})
						.then(function(next) {
							self.models[q.$collection].fire('postCreate', next, newDocument);
						})
						.end(function(err) {
							if (err) return next(err);
							next(null, this.newRec2);
						})
				}
			})
			// }}}
			// Refetch record {{{
			.then('newRec', function(next) {
				if (!settings.refetch) return next(null, null);
				self.query({
					$collection: q.$collection,
					$id: this.rawResponse.insertedId,
				}, next);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (!_.isFunction(callback)) return; // Do nothing
				if (err) return callback(err);
				return callback(null, this.newRec);
			});
			// }}}

			return self;
	};
	// }}}

	// .delete(item, [options], [callback]) {{{
	/**
	* Delete a Mongo document by its ID
	* This function has two behaviours - it will, by default, only delete a single record by its ID. If `q.$multiple` is true it will delete by query.
	* If `q.$multiple` is false and the document is not found (by `q.$id`) this function will execute the callback with an error
	*
	* @name monoxide.delete
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {string} [q.$id] The ID of the document to delete (if you wish to do a remove based on query set q.$query=true)
	* @param {boolean} [q.$multiple] Allow deletion of multiple records by query
	*
	* @param {Object} [options] Optional options object which can alter behaviour of the function
	*
	* @param {function} [callback(err,result)] Optional callback to call on completion or error
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
				'$multiple', // Whether to allow deletion by query
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for delete operation');
				if (!q.$collection) return next('$collection must be specified for delete operation');
				if (!q.$id && !q.$multiple) return next('$id or $multiple must be speciied during delete operation');
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
				if (!_.has(this.connection, 'base.models.' + q.$collection.toLowerCase())) return next('Invalid collection');
				next(null, this.connection.base.models[q.$collection.toLowerCase()].schema);
			})
			// }}}
			// Delete logic {{{
			.then(function(next) {
				if (q.$multiple) { // Multiple delete operation
					self.query(_.merge(_.omit(q, this.metaFields), {$collection: q.$collection, $select: 'id'}), function(err, rows) {
						async()
							.forEach(rows, function(next, row) {
								self.delete({$collection: q.$collection, $id: row._id}, next);
							})
							.end(next);
					});
				} else { // Single item delete
					// Check that the hook returns ok
					self.models[q.$collection].fire('delete', function(err) {
						// Now actually delete the item
						self.connection.base.models[q.$collection.toLowerCase()].remove({_id: q.$id}, function(err) {
							if (err) return next(err);
							// Delete was sucessful - call event then move next
							self.models[q.$collection].fire('postDelete', next, {_id: q.$id});
						});
					}, {_id: q.$id});
				}
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (!_.isFunction(callback)) return; // Do nothing
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
		* @param {Object|function} [q] Optional filtering object or callback (in which case we act as exec())
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.find = function(q, callback) {
			if (_.isObject(q)) _.merge(qb.query, q);
			if (_.isFunction(q)) return qb.exec(q);
			if (_.isFunction(callback)) return qb.exec(callback);
			return qb;
		};
		// }}}

		// qb.select(q, cb) {{{
		/**
		* Add select criteria to an existing query
		* @name monoxide.queryBuilder.select
		* @memberof monoxide.queryBuilder
		* @param {Object|Array|string} [q] Select criteria, for strings or arrays of strings use the field name optionally prefixed with '-' for omission. For Objects use `{field: 1|-1}`
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.select = function(q, callback) {
			if (_.isString(q)) {
				if (qb.query.$select) {
					qb.query.$select.push(q);
				} else {
					qb.query.$select = [q];
				}
			} else if (_.isArray(q)) {
				if (qb.query.$select) {
					qb.query.$select.push.apply(this, q);
				} else {
					qb.query.$select = q;
				}
			} else {
				throw new Error('Sort parameter type is unsupported');
			}
			if (_.isFunction(callback)) return qb.exec(callback);
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
			if (_.isFunction(callback)) return qb.exec(callback);
			return qb;
		};
		// }}}

		// qb.limit(q, cb) {{{
		/**
		* Add limit criteria to an existing query
		* @name monoxide.queryBuilder.limit
		* @memberof monoxide.queryBuilder
		* @param {number} q Limit records to this number
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.limit = function(q, callback) {
			qb.query.$limit = q;
			if (_.isFunction(callback)) return qb.exec(callback);
			return qb;
		};
		// }}}

		// qb.skip(q, cb) {{{
		/**
		* Add skip criteria to an existing query
		* @name monoxide.queryBuilder.skip
		* @memberof monoxide.queryBuilder
		* @param {number} q Skip this number of records
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.skip = function(q, callback) {
			qb.query.$skip = q;
			if (_.isFunction(callback)) return qb.exec(callback);
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
			if (_.isFunction(callback)) return qb.exec(callback);
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
		mm.$virtuals = {};
		mm.$hooks = {};

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
			} else if (_.isObject(q) && q.toString().length) { // Input is an object but we can convert it to something useful
				q = q.toString();
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
		* Alias of findOneByID
		* @see monoxide.queryBuilder.find
		*/
		mm.findOneById = mm.findOneByID;


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
			if (_.isObject(q) && _.isObject(options)) {
				// All ok
			} else if (_.isObject(q) && _.isFunction(options)) {
				callback = options;
				options = {};
			} else if (_.isObject(q)) {
				// Also ok
			} else if (_.isFunction(q)) {
				callback = q;
				q = {};
				options = {};
			} else {
				throw new Error('Unknown function call pattern');
			}

			q.$collection = mm.$collection;
			// }}}

			self.create(q, options, callback);
			return mm;
		};


		/**
		* Shortcut to invoke update on a given model
		* @name monoxide.monoxideMode.update
		* @see monoxide.update
		* @param {Object} q The filter to query by
		* @param {Object} qUpdate The object to update into the found documents
		* @param {Object} [options] Optional options object which can alter behaviour of the function
		* @param {function} [callback(err,result)] Optional callback to call on completion or error
		* @return {Object} This chainable object
		*/
		mm.update = function(q, qUpdate, options, callback) {
			// Deal with arguments {{{
			if (_.isObject(q) && _.isObject(qUpdate) && _.isObject(options)) {
				// All ok
			} else if (_.isObject(q) && _.isObject(qUpdate) && _.isFunction(options)) {
				callback = options;
				options = {};
			} else if (_.isObject(q) && _.isObject(qUpdate)) {
				callback = null;
				options = {};
			} else {
				throw new Error('Unknown function call pattern');
			}

			q.$collection = mm.$collection;
			// }}}

			self.update(q, qUpdate, options, callback);
			return mm;
		};


		/**
		* Shortcut function to remove a number of rows based on a query
		* @name monoxide.monoxideModel.remove
		* @see monoxide.delete
		*
		* @param {Object} [q] Optional filtering object
		* @param {function} [callback] Optional callback
		* @return {monoxide}
		*/
		mm.remove = function(q, callback) {
			return self.delete(_.merge(q, {$collection: mm.$collection, $multiple: true}), callback);
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


		/**
		* Define a virtual (a handler when a property gets set or read)
		* @param {string|Object} name The virtual name to apply or the full virtual object (must pretain to the Object.defineProperty descriptor)
		* @param {function} getCallback The get fnution to call when the virtual value is read
		* @param {function} setCallback The set function to call when the virtual value changes
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.virtual = function(name, getCallback, setCallback) {
			// Deal with arguments {{{
			var q = {};
			if (_.isObject(name)) {
				q = name;
			} else if (_.isString(name) && _.isFunction(getCallback) && _.isFunction(setCallback)) {
				q = {
					get: getCallback,
					set: setCallback,
				};
			} else if (_.isString(name) && _.isFunction(getCallback)) {
				q = {
					get: getCallback,
				};
			} else if (_.isString(name) && _.isEmpty(getCallback) && _.isFunction(setCallback)) {
				q = {
					set: setCallback,
				};
			} else {
				throw new Error('Unknown function call pattern');
			}
			// }}}

			mm.$virtuals[name] = q;
			return mm;
		};


		/**
		* Return whether a model has virtuals
		* @return {boolean} Whether any virtuals are present
		*/
		mm.hasVirtuals = function() {
			return (Object.keys(mm.$virtuals).length > 0);
		};


		/**
		* Attach a hook to a model
		* A hook is exactly the same as a eventEmitter.on() event but must return a callback
		* Multiple hooks can be attached and all will be called in parallel on certain events such as 'save'
		* All hooks must return non-errors to proceed with the operation
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.hook = function(eventName, callback) {
			if (!mm.$hooks[eventName]) mm.$hooks[eventName] = [];
			mm.$hooks[eventName].push(callback);
			return mm;
		};


		/**
		* Return whether a model has a specific hook
		* If an array is passed the result is whether the model has none or all of the specified hooks
		* @param {string|array|undefined|null} hooks The hook(s) to query, if undefined or null this returns if any hooks are present
		* @return {boolean} Whether the hook(s) is present
		*/
		mm.hasHook = function(hooks) {
			if (_.isEmpty(hooks)) {
				return !_.isEmpty(mm.$hooks);
			} else if (_.isString(hooks)) {
				return (mm.$hooks[hooks] && mm.$hooks[hooks].length);
			} else if (_.isArray(hooks)) {
				return hooks.every(function(hook) {
					return (mm.$hooks[hook] && mm.$hooks[hook].length);
				});
			} else {
				throw new Error('Unknown function call pattern');
			}
		};


		/**
		* Execute all hooks for an event
		* This function fires all hooks in parallel and expects all to resolve correctly via callback
		* NOTE: Hooks are always fired with the callback as the first argument
		* @param {string} name The name of the hook to invoke
		* @param {function} callback The callback to invoke on success
		* @param {...*} parameters Any other parameters to be passed to each hook
		*/
		mm.fire = function(name, callback) {
			if (!mm.$hooks[name] || !mm.$hooks[name].length) return callback(); // No hooks attached anyway

			// Calculate the args array we will pass to each hook
			var args = _.values(arguments);
			args.shift(); // We will set args[0] to the callback in each case anyway so we only need to shift 1

			async()
				.forEach(mm.$hooks[name], function(next, hook) {
					args[0] = next;
					hook.apply(mm, args);
				})
				.end(callback);
		};

		return mm;
	};
	// }}}

	// .monoxideDocument([setup]) - monoxide document instance {{{
	/**
	* Returns a single instance of a Monoxide document
	* @class
	* @name monoxide.monoxideDocument
	* @param {Object} setup The prototype fields. Everything in this object is extended into the prototype
	* @param {string} setup.$collection The collection this document belongs to
	* @param {Object} data The initial data
	* @return {monoxide.monoxideDocument}
	*/
	self.monoxideDocument = function monoxideDocument(setup, data) {
		var model = self.models[setup.$collection];

		var proto = {
			$MONOXIDE: true,
			save: function(callback) {
				var doc = this;
				var fields = {
					$collection: doc.$collection,
					$id: doc._id,
				};
				_.extend(fields, _.pickBy(doc, function(v, k) {
					// FIXME: Selectively pick only changed fields
					if (!doc.hasOwnProperty(k)) return false;
					return true;
				}));

				self.save(fields, callback);
				return doc;
			},
			remove: function(callback) {
				var doc = this;
				self.delete({
					$collection: doc.$collection,
					$id: doc._id,
				}, callback);
				return doc;
			},
			toObject: function() {
				var doc = this;
				return _.cloneWith(doc, function(v, k) {
					return (doc.hasOwnProperty(k) && !_.startsWith(k, '$')) ? v : undefined;
				});
			},
			$applySchema: true,
		};

		_.extend(
			proto, // INPUT: Basic prototype
			setup, // Merge with the incomming prototype (should contain at least $collection)
			model.$methods // Merge with model methods
		);

		// Create the base document
		var doc = Object.create(proto);

		// Setup Virtuals
		Object.defineProperties(doc, model.$virtuals);

		// Convert data to a simple array if its weird Mongoose fluff
		if (data instanceof mongoose.Document) data = data.toObject();

		// Sanitize data to remove all ObjectID crap
		var FKs = self.models[setup.$collection]._knownFKs || self.utilities.extractFKs(self.connection.base.models[setup.$collection.toLowerCase()].schema);
		_.forEach(FKs, function(pathSpec, path) {
			if (pathSpec.type == 'objectId') {
				var pathData = _.get(data, path);
				if (pathData instanceof mongoose.Types.ObjectId) { // It is a pointer thats NOT been populated
					_.set(data, path, pathData.toString());
				}
			}
		});

		_.extend(doc, data);

		// Apply schema
		if (setup.$applySchema) {
			_.forEach(self.connection.base.models[setup.$collection.toLowerCase()].schema.paths, function(pathSpec, path) {
				var docValue = _.get(doc, path);
				if (_.isUndefined(docValue)) {
					if (pathSpec.options.default) { // Item is blank but SHOULD have a default
						_.set(doc, path, pathSpec.options.default);
					} else {
						_.set(doc, path, undefined);
					}
				}
			});
		}

		return doc;
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
	* 	role: {type: 'string', enum: ['user', 'admin'], default: 'user'},
	* 	favourite: {type: 'pointer', ref: 'widgets'},
	* 	items: [{type: 'pointer', ref: 'widgets'}],
	* 	settings: {type: 'any'},
	* 	mostPurchased: [
	* 		{
	* 			number: {type: 'number', default: 0},
	* 			item: {type: 'pointer', ref: 'widgets'},
	* 		}
	* 	],
	* });
	*/
	self.schema = function(model, spec) {
		if (!_.isString(model) || !_.isObject(spec)) throw new Error('Schema construction requires a model ID + schema object');

		var schema = new mongoose.Schema(_.deepMapValues(spec, function(value, path) {
			if (!_.endsWith(path, '.type')) return value; // Ignore not type rewrites
			if (!_.isString(value)) return value; // Only rewrite string values

			switch (value.toLowerCase()) {
				case 'oid':
				case 'pointer':
				case 'objectid':
					return mongoose.Schema.ObjectId;
				case 'string':
					return mongoose.Schema.Types.String;
				case 'number':
					return mongoose.Schema.Types.Number;
				case 'boolean':
				case 'bool':
					return mongoose.Schema.Types.Boolean;
				case 'array':
					return mongoose.Schema.Types.Array;
				case 'date':
					return mongoose.Schema.Types.Date;
				case 'object':
				case 'mixed':
				case 'any':
					return mongoose.Schema.Types.Mixed;
				case 'buffer':
					return mongoose.Schema.Types.Buffer;
				default:
					throw new Error('Unknown Monoxide data type: ' + value.toLowerCase());
			}
		}));

		// Add to model storage
		self.models[model] = new self.monoxideModel({
			$collection: model,
			$mongoose: mongoose.model(model.toLowerCase(), schema), // FIXME: When we implement our own schema def system we can remove the toLowerCase() component that Mongoose insists on using. We can also remove all of the other toLowerCase() calls when we're trying to find the Mongoose schema
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
				if (!_.has(this.connection, 'base.models.' + q.$collection.toLowerCase())) return next('Invalid collection');
				next(null, this.connection.collection(q.$collection.toLowerCase()));
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
				self.utilities.runMiddleware(req, res, settings.count, function() {
					self.express.count(settings)(req, res, next);
				}, settings);
			} else if (settings.count && req.method == 'GET' && req.params.id && req.params.id == 'count') {
				self.express.count(settings)(req, res, next);
			// }}}
			// Get {{{
			} else if (settings.get && req.method == 'GET' && req.params.id && !_.isBoolean(settings.get)) {
				req.monoxide.id = req.params.id;
				self.utilities.runMiddleware(req, res, settings.get, function() {
					self.express.get(settings)(req, res, next);
				}, settings);
			} else if (settings.get && req.method == 'GET' && req.params.id) {
				self.express.get(settings)(req, res, next);
			// }}}
			// Query {{{
			} else if (settings.query && req.method == 'GET' && !_.isBoolean(settings.query)) {
				self.utilities.runMiddleware(req, res, settings.query, function() {
					self.express.query(settings)(req, res, next);
				}, settings);
			} else if (settings.query && req.method == 'GET') {
				self.express.query(settings)(req, res, next);
			// }}}
			// Save {{{
			} else if (settings.save && req.method == 'POST' && req.params.id && !_.isBoolean(settings.save)) {
				req.monoxide.id = req.params.id;
				self.utilities.runMiddleware(req, res, settings.save, function() {
					self.express.save(settings)(req, res, next);
				}, settings);
			} else if (settings.save && req.method == 'POST' && req.params.id) {
				self.express.save(settings)(req, res, next);
			// }}}
			// Create {{{
			} else if (settings.create && req.method == 'POST' && !_.isBoolean(settings.create)) {
				req.monoxide.id = req.params.id;
				self.utilities.runMiddleware(req, res, settings.create, function() {
					if (err) return next(err);
					self.express.create(settings)(req, res, next);
				}, settings);
			} else if (settings.create && req.method == 'POST') {
				self.express.create(settings)(req, res, next);
			// }}}
			// Delete {{{
			} else if (settings.delete && req.method == 'DELETE' && !_.isBoolean(settings.delete)) {
				req.monoxide.id = req.params.id;
				self.utilities.runMiddleware(req, res, settings.delete, function() {
					self.express.delete(settings)(req, res, next);
				}, settings);
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
				select: '$select',
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
				select: '$select',
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
			if (id == 'id' || id == '_id') { // Main document ID
				FKs[prefix + id] = {type: 'objectId'};
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

	// .utilities.objectID(string) {{{
	/**
	* Construct and return a MongoDB-Core compatible ObjectID object
	* This is mainly used within functions that need to convert a string ID into an object
	* @name monoxide.utilities.objectID
	* @param {string} str The string to convert into an ObjectID
	* @return {Object} A MongoDB-Core compatible ObjectID object instance
	*/
	self.utilities.objectID = function(str) {
		return new mongoose.Types.ObjectId(str);
	};
	// }}}

	// .utilities.runMiddleware(middleware) {{{
	/**
	* Run optional middleware
	*
	* Middleware can be:
	* 	- A function(req, res, next)
	*	- An array of functions(req, res, next) - Functions will be called in sequence, all functions must call the next method
	*	- A string - If specified (and `obj` is also specified) the middleware to use will be looked up as a key of the object. This is useful if you need to invoke similar methods on different entry points (e.g. monoxide.express.middleware('widgets', {save: function(req, res, next) { // Check something // }, create: 'save'}) - where the `create` method invokes the same middleware as `save)
	*
	* @param {null|function|array} middleware The optional middleware to run this can be a function, an array of functions or a string
	* @param {function} callback The callback to invoke when completed. This may not be called
	* @param {object} obj The parent object to look up inherited functions from (if middleware is a string)
	*
	* @example
	* // Set up a Monoxide express middleware to check user logins on each save or create operaion
	* app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
	* 	create: function(req, res, next) {
	*		if (req.user && req.user._id) {
	* 			next();
	* 		} else {
	* 			res.status(403).send('You are not logged in').end();
	*		}
	*	},
	* 	save: 'create', // Point to the same checks as the `create` middleware
	* }));

	*/
	self.utilities.runMiddleware = function(req, res, middleware, callback, obj) {
		var thisContext = this;
		var runnable; // The middleware ARRAY to run

		if (_.isBoolean(middleware) && !middleware) { // Boolean=false - deny!
			res.status(403).end();
		} else if (_.isUndefined(middleware) || _.isNull(middleware)) { // Nothing to do anyway
			return callback();
		} else if (_.isFunction(middleware)) {
			runnable = [middleware];
		} else if (_.isArray(middleware)) {
			runnable = middleware;
		} else if (_.isString(middleware) && _.has(obj, middleware)) {
			return self.utilities.runMiddleware(req, res, _.get(obj, middleware), callback, obj); // Defer to the pointer
		}

		async()
			.limit(1)
			.forEach(runnable, function(nextMiddleware, middlewareFunc, index) {
				middlewareFunc.apply(thisContext, [req, res, nextMiddleware]);
			})
			.end(function(err) {
				if (err) {
					res.status(403).send(err.toString()).end();
				} else {
					callback();
				}
			});
	};
	// }}}

	// .utilities.diff(originalDoc, newDoc) {{{
	/**
	* Diff two monoxide.monoxideDocument objects and return the changes as an object
	* This change object is suitable for passing directly into monoxide.save()
	* While originally intended only for comparing monoxide.monoxideDocument objects this function can be used to compare any type of object
	* NOTE: If you are comparing MonoxideDocuments call `.toObject()` before passing the object in to strip it of its noise
	*
	* @name monoxide.utilities.diff
	* @see monoxide.save
	* @see monoxide.update
	*
	* @param {Object} originalDoc The original source document to compare to
	* @param {Object} newDoc The new document with possible changes
	* @return {Object} The patch object
	*
	* @example
	* // Get the patch of two documents
	* monoxide.query({$collection: 'widgets', $id: '123'}, function(err, res) {
	* 	var docA = res.toObject();
	* 	var docB = res.toObject();
	*
	*	// Change some fields
	* 	docB.title = 'Hello world';
	*
	* 	var patch = monoxide.utilities.diff(docA, docB);
	* 	// => should only return {title: 'Hello World'}
	* });
	*/
	self.utilities.diff = function(originalDoc, newDoc) {
		var deepDiff = require('deep-diff');
		var patch = {};

		deepDiff.observableDiff(originalDoc, newDoc, function(diff) {
			if (diff.kind == 'N' || diff.kind == 'E') {
				_.set(patch, diff.path, diff.rhs);
			} else if (diff.kind == 'A') { // Array alterations
				// deepDiff will only apply changes onto newDoc - we can't just apply them to the empty patch object
				// so we let deepDiff do its thing then copy the new structure across into patch
				deepDiff.applyChange(originalDoc, newDoc, diff);
				_.set(patch, diff.path, _.get(newDoc, diff.path));
			}
		});

		return patch;
	};
	// }}}

	return self;
}

util.inherits(Monoxide, events.EventEmitter);

module.exports = new Monoxide();
