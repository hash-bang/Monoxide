var _ = require('lodash')
	.mixin(require('lodash-deep'));
var argy = require('argy');
var async = require('async-chainable');
var debug = require('debug')('monoxide');
var deepDiff = require('deep-diff');
var events = require('events');
var mongoose = require('mongoose');
var traverse = require('traverse');
var util = require('util');

/**
* @static monoxide
*/
function Monoxide() {
	var self = this;
	self.models = {};
	self.connection;
	self.settings = {
		removeAll: true, // Allow db.model.delete() calls with no arguments
	};

	// .connect {{{
	/**
	* Connect to a Mongo database
	* @param {string} uri The URL of the database to connect to
	* @param {function} callback Optional callback when connected, if omitted this function is syncronous
	* @return {monoxide} The Monoxide chainable object
	*/
	self.connect = function(uri, callback) {
		// Use native promises
		mongoose.Promise = global.Promise;

		mongoose.connect(uri, callback);
		self.connection = mongoose.connection;
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
	self.get = argy('[object|string|number] [string|number|object] function', function(q, id, callback) {
		argy(arguments)
			.ifForm('object function', function(aQ, aCallback) {
				q = aQ;
				callback = aCallback;
			})
			.ifForm('string string|number function', function(aCollection, aId, aCallback) {
				q = {
					$collection: aCollection,
					$id: aId,
				};
			})
			.ifForm('string object function', function(aCollection, aId, aCallback) { // Probably being passed a Mongoose objectId as the ID
				q = {
					$collection: aCollection,
					$id: aId.toString(),
				};
			});

		if (!q.$id) return callback('No $id specified');
		return self.query(q, callback);
	});
	// }}}

	// .query([q], callback) {{{
	/**
	* Query Mongo directly with the Monoxide query syntax
	*
	* @name monoxide.query
	* @fires query
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {string} [q.$id] If specified return only one record by its master ID (implies $one=true). If present all other conditionals will be ignored and only the object is returned (see $one)
	* @param {(string|string[]|object[])} [q.$select] Field selection criteria to apply (implies q.$applySchema=false as we will be dealing with a partial schema). Any fields prefixed with '-' are removed
	* @param {(string|string[]|object[])} [q.$sort] Sorting criteria to apply
	* @param {(string|string[]|object[])} [q.$populate] Population criteria to apply
	* @param {boolean} [q.$one=false] Whether a single object should be returned (implies $limit=1). If enabled an object is returned not an array
	* @param {number} [q.$limit] Limit the return to this many rows
	* @param {number} [q.$skip] Offset return by this number of rows
	* @param {boolean=false} [q.$count=false] Only count the results - do not return them. If enabled a number of returned with the result
	* @param {object|function} [q.$data] Set the user-defined data object, if this is a function the callback result is used
	* @param {boolean} [q.$decorate=true] Add all Monoxide methods, functions and meta properties
	* @param {boolean} [q.$plain=false] Return a plain object or object array. This is the equivelent of calling .toObject() on any resultant object. Implies $decorate=true
	* @param {boolean} [q.$cacheFKs=true] Cache the foreign keys (objectIDs) within an object so future retrievals dont have to recalculate the model structure
	* @param {boolean} [q.$applySchema=true] Apply the schema for each document retrieval - this slows retrieval but means any alterations to the schema are applied to each retrieved record
	* @param {boolean} [q.$dirty=false] Whether the entire document contents should be marked as dirty (modified). If true this also skips the computation of modified fields
	* @param {boolean} [q.$errNotFound] Raise an error if a specifically requested document is not found (requires $id)
	* @param {...*} [q.filter] Any other field (not beginning with '$') is treated as filtering criteria
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
	self.query = argy('[string|object] function', function MonoxideQuery(q, callback) {
		if (argy.isType(q, 'string')) q = {$collection: q};

		_.defaults(q || {}, {
			$cacheFKs: true, // Cache model Foreign Keys (used for populates) or compute them every time
			$applySchema: true, // Apply the schema on retrieval - this slows ths record retrieval but means any alterations to the schema are applied to each retrieved record
			$errNotFound: true, // During $id / $one operations raise an error if the record is not found
		});
		if (!_.isEmpty(q.$select)) q.$applySchema = false; // Turn off schema application when using $select as we wont be grabbing the full object

		async()
			.set('metaFields', [
				'$collection', // Collection to query
				'$data', // Meta user-defined data object
				'$dirty', // Whether the document is unclean
				'$id', // If specified return only one record by its master ID (implies $one=true). If present all other conditionals will be ignored and only the object is returned (see $one)
				'$select', // Field selection criteria to apply
				'$sort', // Sorting criteria to apply
				'$populate', // Population criteria to apply
				'$one', // Whether a single object should be returned (implies $limit=1). If enabled an object is returned not an array
				'$limit', // Limit the return to this many rows
				'$skip', // Offset return by this number of rows
				'$count', // Only count the results - do not return them
				'$cacheFKs', // Cache model Foreign Keys (used for populates) or compute them every time
				'$applySchema', // Apply the schema on retrieval - this slows ths record retrieval but means any alterations to the schema are applied to each retrieved record
				'$decorate',
				'$plain',
				'$errNotFound', // During $id / $one operations raise an error if the record is not found
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for get operation');
				if (!q.$collection) return next('$collection must be specified for get operation');
				if (!self.models[q.$collection]) return next('Model not initalized');
				next();
			})
			// }}}
			// .query - start the find query {{{
			.set('filterPostPopulate', {}) // Filter by these fields post populate
			.then('query', function(next) {
				var me = this;
				var fields;

				if (q.$id) { // Search by one ID only - ignore other fields
					fields = {_id: q.$id};
					q.$one = true;
				} else { // Search by query
					fields = _(q)
						.omit(this.metaFields) // Remove all meta fields
						// FIXME: Ensure all fields are flat
						.omitBy(function(val, key) { // Remove all fields that will need populating later
							if (_.some(q.$collection.$oids, function(FK) {
								return _.startsWith(key, FK);
							})) {
								me.filterPostPopulate[key] = val;
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
					next(null, self.models[q.$collection].$mongooseModel.count(fields));
				} else if (q.$one) {
					next(null, self.models[q.$collection].$mongooseModel.findOne(fields));
				} else {
					next(null, self.models[q.$collection].$mongooseModel.find(fields));
				}
			})
			// }}}
			// Apply various simple criteria {{{
			.then(function(next) {
				if (q.$count) return next(); // No point doing anything else if just counting
				if (q.$limit) this.query.limit(q.$limit);
				if (q.$skip) this.query.skip(q.$skip);

				// q.$populate {{{
				if (q.$populate) {
					if (_.isArray(q.$populate)) {
						this.query.populate(q.$populate);
					} else if (_.isString(q.$populate) || _.isObject(q.$populate)) {
						this.query.populate(q.$populate);
						q.$populate = [q.$populate]; // Also rewrite into an array so we can destructure later
					} else {
						throw new Error('Invalid sort type: ' + (typeof q.$sort));
					}
				}
				// }}}
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
			// Calculate $data if it is a function {{{
			.then('data', function(next) {
				if (!q.$data) return next();
				if (_.isFunction(q.$data)) {
					q.$data(function(err, data) {
						if (err) return next(err);
						q.$data = data;
					});
				}
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
							if (q.$errNotFound) {
								next('Not found');
							} else {
								next(null, undefined);
							}
						} else {
							next(null, res);
						}
					} else if (q.$count) {
						next(null, res);
					} else {
						next(null, res);
					}
				});
			})
			// }}}
			// Convert Mongoose Documents into Monoxide Documents {{{
			.then('result', function(next) {
				if (this.result === undefined) {
					next(null, undefined);
				} else if (q.$one) {
					if (q.$decorate) return next(null, this.result.toObject());
					next(null, new self.monoxideDocument({
						$collection: q.$collection,
						$applySchema: q.$applySchema,
						$decorate: q.$decorate,
						$dirty: q.$dirty,
					}, this.result));
				} else if (q.$count) {
					next(null, this.result);
				} else {
					next(null, this.result.map(function(doc) {
						if (q.$decorate) return doc.toObject();
						return new self.monoxideDocument({
							$collection: q.$collection,
							$applySchema: q.$applySchema,
							$decorate: q.$decorate,
							$dirty: q.$dirty,
						}, doc.toObject());
					}));
				}
			})
			// }}}
			// Apply populates {{{
			.then(function(next) {
				if (!q.$populate || !q.$populate.length || q.$count || q.$decorate === false || q.$plain === false || this.result === undefined) return next(); // Skip
				if (q.$one) {
					this.result.populate(q.$populate, next);
				} else {
					async()
						.forEach(this.result, function(next, doc) {
							doc.populate(q.$populate, next);
						})
						.end(next);
				}
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					debug('get() error - ' + err.toString());
					return callback(err);
				} else if (q.$count) {
					callback(null, this.result);
				} else {
					callback(null, this.result);
				}
			});
			// }}}
		return self;
	});
	// }}}

	// .count([q], callback) {{{
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
	self.count = argy('[string|object] function', function MonoxideCount(q, callback) {
		if (argy.isType(q, 'string')) q = {$collection: q};

		// Glue count functionality to query
		q.$count = true;

		return self.query(q, callback);
	});
	// }}}

	// .save(item, [callback]) {{{
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
	* @param {boolean} [q.$refetch=true] Whether to refetch the record after update, false returns `null` in the callback
	* @param {boolean} [q.$errNoUpdate=false] Raise an error if no documents were actually updated
	* @param {boolean} [q.$errBlankUpdate=false] Raise an error if no fields are updated
	* @param {boolean} [q.$returnUpdated=true] If true returns the updated document, if false it returns the document that was replaced
	* @param {...*} [q.field] Any other field (not beginning with '$') is treated as data to save
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
	self.save = argy('object [function]', function(q, callback) {
		var self = this;

		_.defaults(q || {}, {
			$refetch: true, // Fetch and return the record when updated (false returns null)
			$errNoUpdate: false,
			$errBlankUpdate: false,
			$returnUpdated: true,
		});

		async()
			.set('metaFields', [
				'$id', // Mandatory field to specify while record to update
				'_id', // We also need to clip this from the output (as we cant write to it), but we need to pass it to hooks
				'$collection', // Collection to query to find the original record
				'$data', // Meta user-defined data
				'$refetch',
				'$errNoUpdate',
				'$errBlankUpdate',
				'$returnUpdated',
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for save operation');
				if (!q.$collection) return next('$collection must be specified for save operation');
				if (!q.$id) return next('ID not specified');
				if (!self.models[q.$collection]) return next('Model not initalized');
				q._id = q.$id;
				next();
			})
			// }}}
			// Calculate $data if it is a function {{{
			.then(function(next) {
				if (!q.$data) return next();
				if (_.isFunction(q.$data)) {
					q.$data(function(err, data) {
						if (err) return next(err);
						q.$data = data;
					});
				}
				next();
			})
			// }}}
			// Fire the 'save' hook on the model {{{
			.then(function(next) {
				self.models[q.$collection].fire('save', next, q);
			})
			// }}}
			// Peform the update {{{
			.then('newRec', function(next) {
				var patch = _.omit(q, this.metaFields);
				if (_.isEmpty(patch)) {
					if (q.$errBlankUpdate) return next('Nothing to update');
					if (q.$refetch) {
						return self.get({$collection: q.$collection, $id: q.$id}, next);
					} else {
						return next(null, {});
					}
				}

				_.forEach(self.models[q.$collection].$oids, function(fkType, schemaPath) {
					if (!_.has(patch, schemaPath)) return; // Not patching this field anyway

					switch(fkType.type) {
						case 'objectId': // Convert the field to an OID if it isn't already
							if (_.has(q, schemaPath)) {
								var newVal = _.get(q, schemaPath);
								if (!self.utilities.isObjectID(newVal))
									_.set(patch, schemaPath, self.utilities.objectID(newVal));
							}
							break;
						case 'objectIdArray': // Convert each item to an OID if it isn't already
							if (_.has(q, schemaPath)) {
								var gotOIDs = _.get(q, schemaPath);
								if (_.isArray(gotOIDs)) {
									_.set(patch, schemaPath, gotOIDs.map(function(i, idx) {
										return (!self.utilities.isObjectID(newVal))
											? self.utilities.objectID(i)
											: i;
									}));
								} else {
									throw new Error('Expected ' + schemaPath + ' to contain an array of OIDs but got ' + (typeof gotOIDs));
								}
							}
							break;
					}
				});

				self.models[q.$collection].$mongoModel.findOneAndUpdate(
					{ _id: self.utilities.objectID(q.$id) }, // What we are writing to
					{ $set: patch }, // What we are saving
					{ returnOriginal: !q.$returnUpdated }, // Options passed to Mongo
					function(err, res) {
						if (err) return next(err);
						// This would only really happen if the record has gone away since we started updating
						if (q.$errNoUpdate && !res.ok) return next('No documents updated');
						if (!q.$refetch) return next(null, null);
						next(null, new self.monoxideDocument({$collection: q.$collection}, res.value));
					}
				);
			})
			// }}}
			// Fire the 'postSave' hook {{{
			.then(function(next) {
				self.models[q.$collection].fire('postSave', next, q, this.newRec);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					debug('save() error - ' + err.toString());
					if (_.isFunction(callback)) callback(err);
				} else {
					if (_.isFunction(callback)) callback(null, this.newRec);
				}
			});
			// }}}

			return self;
	});
	// }}}

	// .update(q, [with], [callback]) {{{
	/**
	* Update multiple documents
	*
	* @name monoxide.update
	* @fires update
	*
	* @param {Object} q The object to query by
	* @param {string} q.$collection The collection / model to query
	* @param {boolean} [q.$refetch=true] Return the newly updated record
	* @param {...*} [q.field] Any other field (not beginning with '$') is treated as filter data
	*
	* @param {Object} qUpdate The object to update into the found documents
	* @param {...*} [qUpdate.field] Data to save into every record found by `q`
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
	self.update = argy('object|string [object] [function]', function MonoxideUpdate(q, qUpdate, callback) {
		var self = this;
		if (argy.isType(q, 'string')) q = {$collection: q};

		_.defaults(q || {}, {
			$refetch: true, // Fetch and return the record when updated (false returns null)
		});

		async()
			.set('metaFields', [
				'$collection', // Collection to query to find the original record
				'$data', // Meta user-defined data
				'$refetch',
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for get operation');
				if (!q.$collection) return next('$collection must be specified for get operation');
				if (!self.models[q.$collection]) return next('Model not initalized');
				next();
			})
			// }}}
			// Calculate $data if it is a function {{{
			.then(function(next) {
				if (!q.$data) return next();
				if (_.isFunction(q.$data)) {
					q.$data(function(err, data) {
						if (err) return next(err);
						q.$data = data;
					});
				}
				next();
			})
			// }}}
			// Fire the 'update' hook {{{
			.then(function(next) {
				self.models[q.$collection].fire('update', next, q);
			})
			// }}}
			// Peform the update {{{
			.then('rawResponse', function(next) {
				self.models[q.$collection].$mongooseModel.update(_.omit(q, this.metaFields), _.omit(qUpdate, this.metaFields), {multi: true}, next);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					debug('update() error - ' + err.toString());
					if (callback) callback(err);
				} else {
					if (callback) callback(null, this.newRec);
				}
			});
			// }}}

			return self;
	});
	// }}}

	// .create(item, [callback]) {{{
	/**
	* Create a new Mongo document and return it
	* If you wish to save an existing document see the monoxide.save() function.
	*
	* @name monoxide.create
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to query
	* @param {boolean} [q.$refetch=true] Return the newly create record
	* @param {...*} [q.field] Any other field (not beginning with '$') is treated as data to save
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
	self.create = argy('object [function]', function MonoxideQuery(q, callback) {
		var self = this;
		_.defaults(q || {}, {
			$refetch: true, // Fetch and return the record when created (false returns null)
		});

		async()
			.set('metaFields', [
				'$collection', // Collection to query to find the original record
				'$data', // Meta user-defined data
				'$refetch',
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for save operation');
				if (!q.$collection) return next('$collection must be specified for save operation');
				if (!self.models[q.$collection]) return next('Model not initalized');
				next();
			})
			// }}}
			// Calculate $data if it is a function {{{
			.then(function(next) {
				if (!q.$data) return next();
				if (_.isFunction(q.$data)) {
					q.$data(function(err, data) {
						if (err) return next(err);
						q.$data = data;
						next();
					});
				} else {
					next();
				}
			})
			// }}}
			// Coherse all OIDs (or arrays of OIDs) into their correct internal type {{{
			.then(function(next) {
				_.forEach(self.models[q.$collection].$oids, function(fkType, schemaPath) {
					switch(fkType.type) {
						case 'objectId': // Convert the field to an OID if it isn't already
							if (_.has(q, schemaPath)) {
								var newVal = _.get(q, schemaPath);
								if (!self.utilities.isObjectID(newVal))
									_.set(q, schemaPath, self.utilities.objectID(newVal));
							}
							break;
						case 'objectIdArray': // Convert each item to an OID if it isn't already
							if (_.has(q, schemaPath)) {
								var gotOIDs = _.get(q, schemaPath);
								if (_.isArray(gotOIDs)) {
									_.set(q, schemaPath, gotOIDs.map(function(i, idx) {
										return (!self.utilities.isObjectID(newVal))
											? self.utilities.objectID(i)
											: i;
									}));
								} else {
									throw new Error('Expected ' + schemaPath + ' to contain an array of OIDs but got ' + (typeof gotOIDs));
								}
							}
							break;
					}
				});
				next();
			})
			// }}}
			// Create record {{{
			.then('createDoc', function(next) { // Compute the document we will create
				next(null, new self.monoxideDocument({
					$collection: q.$collection,
					$dirty: true, // Mark all fields as modified (and not bother to compute the clean markers)
				}, _.omit(q, this.metaFields)));
			})
			.then(function(next) {
				self.models[q.$collection].fire('create', next, this.createDoc);
			})
			.then('rawResponse', function(next) {
				self.models[q.$collection].$mongoModel.insertOne(this.createDoc.toMongoObject(), next);
			})
			.then(function(next) {
				self.models[q.$collection].fire('postCreate', next, q, this.createDoc);
			})
			// }}}
			// Refetch record {{{
			.then('newRec', function(next) {
				if (!q.$refetch) return next(null, null);
				self.query({
					$collection: q.$collection,
					$id: this.rawResponse.insertedId.toString(),
				}, function(err, res) {
					if (err == 'Not found') return next('Document creation failed');
					next(err, res);
				});
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					debug('create() error - ' + err.toString());
					if (_.isFunction(callback)) callback(err);
				} else {
					if (_.isFunction(callback)) callback(null, this.newRec);
				}
			});
			// }}}

			return self;
	});
	// }}}

	// .delete(item, [callback]) {{{
	/**
	* Delete a Mongo document by its ID
	* This function has two behaviours - it will, by default, only delete a single record by its ID. If `q.$multiple` is true it will delete by query.
	* If `q.$multiple` is false and the document is not found (by `q.$id`) this function will execute the callback with an error
	* Delete will only work with no parameters if monoxide.settings.removeAll is truthy as an extra safety check
	*
	* @name monoxide.delete
	*
	* @param {Object} [q] The object to process
	* @param {string} [q.$collection] The collection / model to query
	* @param {string} [q.$id] The ID of the document to delete (if you wish to do a remove based on query set q.$query=true)
	* @param {boolean} [q.$multiple] Allow deletion of multiple records by query
	* @param {boolean} [q.$errNotFound] Raise an error if a specifically requested document is not found (requires $id)
	*
	* @param {function} [callback(err,result)] Optional callback to call on completion or error
	*
	* @return {Object} This chainable object
	*/
	self.delete = self.remove = argy('object [function]', function MonoxideQuery(q, callback) {
		var self = this;
		_.defaults(q || {}, {
			$errNotFound: true, // During raise an error if $id is specified but not found to delete
		});

		async()
			.set('metaFields', [
				'$id', // Mandatory field to specify while record to update
				'$collection', // Collection to query to find the original record
				'$data', // Meta user-defined data
				'$multiple', // Whether to allow deletion by query
				'$errNotFound',
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for delete operation');
				if (!q.$collection) return next('$collection must be specified for delete operation');
				if (!q.$id && !q.$multiple) return next('$id or $multiple must be speciied during delete operation');

				if (!self.settings.removeAll && !q.$id && _.isEmpty(_.omit(q, this.metaFields))) { // Apply extra checks to make sure we are not nuking everything if we're not allowed
					return next('delete operation not allowed with empty query');
				}
				next();
			})
			// }}}
			// Calculate $data if it is a function {{{
			.then(function(next) {
				if (!q.$data) return next();
				if (_.isFunction(q.$data)) {
					q.$data(function(err, data) {
						if (err) return next(err);
						q.$data = data;
					});
				}
				next();
			})
			// }}}
			// Delete record {{{
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
						self.models[q.$collection].$mongoModel.deleteOne({_id: self.utilities.objectID(q.$id)}, function(err, res) {
							if (err) return next(err);
							if (q.$errNotFound && !res.result.ok) return next('Not found');
							// Delete was sucessful - call event then move next
							self.models[q.$collection].fire('postDelete', next, {_id: q.$id});
						});
					}, {_id: q.$id});
				}
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					debug('delete() error - ' + err.toString());
					if (callback) callback(err);
				} else {
					if (callback) callback(null, this.newRec);
				}
			});
			// }}}

			return self;
	});
	// }}}

	// .meta(item, [callback]) {{{
	/**
	* Return information about a Mongo collection schema
	*
	* @name monoxide.meta
	*
	* @param {Object} q The object to process
	* @param {string} q.$collection The collection / model to examine
	* @param {boolean} [q.$collectionEnums=false] Provide all enums as a collection object instead of an array
	* @param {boolean} [q.$filterPrivate=true] Ignore all private fields
	* @param {boolean} [q.$prototype=false] Provide the $prototype meta object
	*
	* @param {function} [callback(err,result)] Optional callback to call on completion or error
	*
	* @return {Object} This chainable object
	*
	* @example
	* // Describe a collection
	* monoxide.meta({$collection: 'widgets'}, function(err, res) {
	* 	console.log('About the widget collection:', res);
	* });
	*/
	self.meta = argy('object [function]', function MonoxideMeta(q, callback) {
		var self = this;
		_.defaults(q || {}, {
			$filterPrivate: true,
			$prototype: false,
		});

		async()
			.set('metaFields', [
				'$collection', // Collection to query to find the original record
				'$data', // Meta user-defined data
				'$filterPrivate', // Filter out /^_/ fields
				'$collectionEnums', // Convert enums into a collection (with `id` + `title` fields per object)
				'$prototype',
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for meta operation');
				if (!q.$collection) return next('$collection must be specified for meta operation');
				if (!self.models[q.$collection]) return next('Cannot find collection to extract its meta information: ' + q.$collection);
				next();
			})
			// }}}
			// Retrieve the meta information {{{
			.then('meta', function(next) {
				var sortedPaths = _(self.models[q.$collection].$mongooseModel.schema.paths)
					.map((v,k) => v)
					.sortBy('path')
					.value();

				var meta = {
					_id: {type: 'objectid'}, // FIXME: Is it always the case that a doc has an ID?
				};

				_.forEach(sortedPaths, function(path) {
					var id = path.path;

					if (q.$filterPrivate && _.last(path.path.split('.')).startsWith('_')) return; // Skip private fields

					var info = {};
					switch (path.instance.toLowerCase()) {
						case 'string':
							info.type = 'string';
							if (path.enumValues && path.enumValues.length) {
								if (q.$collectionEnums) {
									info.enum = path.enumValues.map(e => { return ({
										id: e,
										title: e.substr(0, 1).toUpperCase() + e.substr(1)
									})});
								} else {
									info.enum = path.enumValues;
								}
							}
							break;
						case 'number':
							info.type = 'number';
							break;
						case 'date':
							info.type = 'date';
							break;
						case 'boolean':
							info.type = 'boolean';
							break;
						case 'array':
							info.type = 'array';
							break;
						case 'object':
							info.type = 'object';
							break;
						case 'objectid':
							info.type = 'objectid';
							if (_.has(path, 'options.ref')) info.ref = path.options.ref;
							break;
						default:
							debug('Unknown Mongo data type during meta extract on ' + q.$collection + ':', path.instance.toLowerCase());
					}

					// Extract default value if its not a function (otherwise return [DYNAMIC])
					if (path.defaultValue) info.default = argy.isType(path.defaultValue, 'scalar') ? path.defaultValue : '[DYNAMIC]';

					meta[id] = info;
				});

				next(null, meta);
			})
			// }}}
			// Construct the prototype if $prototype=true {{{
			.then(function(next) {
				if (!q.$prototype) return next();

				var prototype = this.meta.$prototype = {};

				_.forEach(this.meta, function(v, k) {
					if (!_.has(v, 'default')) return;
					if (v.default == '[DYNAMIC]') return; // Ignore dynamic values
					_.set(prototype, k, v.default);
				});

				next();
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					debug('meta() error - ' + err.toString());
					if (callback) callback(err);
				} else {
					if (callback) callback(null, this.meta);
				}
			});
			// }}}

			return self;
	});
	// }}}

	// .queryBuilder() - query builder {{{
	/**
	* Returns data from a Monoxide model
	* @class
	* @name monoxide.queryBuilder
	* @return {monoxide.queryBuilder}
	*/
	self.queryBuilder = function monoxideQueryBuilder() {
		var qb = this;
		qb.$MONOXIDE = true;
		qb.query = {};

		// qb.find(q, cb) {{{
		/**
		* Add a filtering function to an existing query
		* @name monoxide.queryBuilder.find
		* @memberof monoxide.queryBuilder
		* @param {Object|function} [q] Optional filtering object or callback (in which case we act as exec())
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.find = argy('[object|string] [function]', function(q, callback) {
			if (argy.isType(q, 'object')) {
				_.merge(qb.query, q);
			} else {
				q = {$id: q};
			}

			if (callback) qb.exec(callback);

			return qb;
		});
		// }}}

		// qb.select(q, cb) {{{
		/**
		* Add select criteria to an existing query
		* If this function is passed a falsy value it is ignored
		* @name monoxide.queryBuilder.select
		* @memberof monoxide.queryBuilder
		* @param {Object|Array|string} [q] Select criteria, for strings or arrays of strings use the field name optionally prefixed with '-' for omission. For Objects use `{field: 1|-1}`
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.select = argy('string|array [function]', function(q, callback) {
			argy(arguments)
				.ifForm(['string', 'string function'], function(id, callback) {
					if (qb.query.$select) {
						qb.query.$select.push(id);
					} else {
						qb.query.$select = [id];
					}
					if (callback) q.exec(callback);
				})
				.ifForm(['array', 'array function'], function(ids, callback) {
					if (qb.query.$select) {
						qb.query.$select.push.apply(this, ids);
					} else {
						qb.query.$select = ids;
					}
					if (callback) q.exec(callback);
				})

			return qb;
		});
		// }}}

		// qb.sort(q, cb) {{{
		/**
		* Add sort criteria to an existing query
		* If this function is passed a falsy value it is ignored
		* @name monoxide.queryBuilder.sort
		* @memberof monoxide.queryBuilder
		* @param {Object|Array|string} [q] Sorting criteria, for strings or arrays of strings use the field name optionally prefixed with '-' for decending search order. For Objects use `{ field: 1|-1|'asc'|'desc'}`
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.sort = argy('string|array [function]', function(q, callback) {
			argy(arguments)
				.ifForm('', function() {})
				.ifForm(['string', 'string function'], function(field, callback) {
					if (qb.query.$sort) {
						qb.query.$sort.push(field);
					} else {
						qb.query.$sort = [field];
					}

					if (callback) qb.exec(callback);
				})
				.ifForm(['array', 'array function'], function(fields, callback) {
					if (qb.query.$sort) {
						qb.query.$sort.push.apply(this, fields);
					} else {
						qb.query.$sort = fields;
					}

					if (callback) qb.exec(callback);
				})

			return qb;
		});
		// }}}

		// qb.limit(q, cb) {{{
		/**
		* Add limit criteria to an existing query
		* If this function is passed a falsy value the limit is removed
		* @name monoxide.queryBuilder.limit
		* @memberof monoxide.queryBuilder
		* @param {number} q Limit records to this number
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.limit = argy('[falsy|number] [function]', function(q, callback) {
			if (!q) {
				delete qb.query.$limit;
			} else {
				qb.query.$limit = q;
			}

			if (callback) return qb.exec(callback);

			return qb;
		});
		// }}}

		// qb.skip(q, cb) {{{
		/**
		* Add skip criteria to an existing query
		* If this function is passed a falsy value the skip offset is removed
		* @name monoxide.queryBuilder.skip
		* @memberof monoxide.queryBuilder
		* @param {number} q Skip this number of records
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.skip = argy('[falsy|number] [function]', function(q, callback) {
			if (!q) {
				delete qb.query.$skip;
			} else {
				qb.query.$skip = q;
			}

			if (callback) return qb.exec(callback);

			return qb;
		});
		// }}}

		// qb.populate(q, cb) {{{
		/**
		* Add population criteria to an existing query
		* If this function is passed a falsy value it is ignored
		* @name monoxide.queryBuilder.populate
		* @memberof monoxide.queryBuilder
		* @param {Array|string} [q] Population criteria, for strings or arrays of strings use the field name
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.populate = argy('string|array [function]', function(q, callback) {
			argy(arguments)
				.ifForm('', function() {})
				.ifForm(['string', 'string function'], function(field, callback) {
					if (qb.query.$populate) {
						qb.query.$populate.push(field);
					} else {
						qb.query.$populate = [field];
					}

					if (callback) qb.exec(callback);
				})
				.ifForm(['array', 'array function'], function(fields, callback) {
					if (qb.query.$populate) {
						qb.query.$populate.push.apply(this, fields);
					} else {
						qb.query.$populate = fields;
					}

					if (callback) qb.exec(callback);
				})

			return qb;
		});
		// }}}

		// qb.exec(cb) {{{
		/**
		* Execute the query and return the error and any results
		* @name monoxide.queryBuilder.exec
		* @memberof monoxide.queryBuilder
		* @param {function} callback(err,result)
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.exec = argy('function', function(callback) {
			return self.query(qb.query, callback);
		});
		// }}}

		// qb.optional() {{{
		/**
		* Convenience function to set $errNotFound
		* @name monoxide.queryBuilder.optional
		* @memberof monoxide.queryBuilder
		* @param {Object|function} [isOptional=true] Whether the return from this query should NOT throw an error if nothing was found
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.optional = argy('[boolean|null|undefined] [function]', function(isOptional, callback) {
			if (argy.isType(isOptional, ['null', 'undefined'])) {
				qb.query.$errNotFound = false;
			} else {
				qb.query.$errNotFound = !! isOptional;
			}

			if (callback) qb.exec(callback);

			return qb;
		});
		// }}}

		return qb;
	};
	// }}}

	// .monoxideModel([options]) - monoxide model instance {{{
	/**
	* @class
	*/
	self.monoxideModel = argy('string|object', function monoxideModel(settings) {
		var mm = this;

		if (argy.isType(settings, 'string')) settings = {$collection: settings};

		// Sanity checks {{{
		if (!settings.$collection) throw new Error('new MonoxideModel({$collection: <name>}) requires at least \'$collection\' to be specified');
		if (!self.connection) throw new Error('Trying to create a MonoxideModel before a connection has been established');
		if (!self.connection.db) throw new Error('Connection does not look like a MongoDB-Core object');
		// }}}

		/**
		* The raw MongoDB-Core model
		* @var {Object}
		*/
		mm.$mongoModel = self.connection.db.collection(settings.$collection.toLowerCase());
		if (!mm.$mongoModel) throw new Error('Model not found in MongoDB-Core - did you forget to call monoxide.schema(\'name\', <schema>) first?');

		/**
		* The raw Mongoose model
		* @depreciated This will eventually go away and be replaced with raw `mm.$mongoModel` calls
		* @var {Object}
		*/
		mm.$mongooseModel = self.connection.base.models[settings.$collection.toLowerCase()];

		/**
		* Holder for all OID information
		* This can either be the `._id` of the object, sub-documents, array pointers or object pointers
		* @see monoxide.utilities.extractFKs
		* @var {Object}
		*/
		mm.$oids = _.has(mm, '$mongooseModel.schema') ? self.utilities.extractFKs(mm.$mongooseModel.schema) : {};

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
			if (argy.isType(q, 'string')) throw new Error('Refusing to allow findOne(String). Use findOneByID if you wish to specify only the ID');

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
			if (argy.isType(q, 'string')) {
				// All ok
			} else if (argy.isType(q, 'object') && q.toString().length) { // Input is an object but we can convert it to something useful
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
		* @param {function} [callback] Optional callback
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.create = argy('object [function]', function(q, callback) {
			q.$collection = mm.$collection;
			self.create(q, callback);
			return mm;
		});


		/**
		* Shortcut to invoke update on a given model
		* @name monoxide.monoxideMode.update
		* @see monoxide.update
		* @param {Object} q The filter to query by
		* @param {Object} qUpdate The object to update into the found documents
		* @param {function} [callback(err,result)] Optional callback to call on completion or error
		* @return {Object} This chainable object
		*/
		mm.update = argy('object object [function]', function(q, qUpdate, callback) {
			q.$collection = mm.$collection;
			self.update(q, qUpdate, callback);
			return mm;
		});


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
			return self.delete(_.merge({}, q, {$collection: mm.$collection, $multiple: true}), callback);
		};


		/**
		* Alias of remove()
		* @see monoxide.remove()
		*/
		mm.delete = mm.remove;


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
		* @param {function} getCallback The get function to call when the virtual value is read
		* @param {function} setCallback The set function to call when the virtual value changes
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.virtual = argy('string [function|falsy] [function|falsy]', function(name, getCallback, setCallback) {
			var q = {};
			if (argy.isType(getCallback, 'function')) q.get = getCallback;
			if (argy.isType(setCallback, 'function')) q.set = setCallback;

			mm.$virtuals[name] = q;
			return mm;
		});


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
		mm.hasHook = argy('[string|array]', function(hooks) {
			var out;

			argy(arguments)
				.ifForm('', function() {
					out = !_.isEmpty(mm.$hooks);
				})
				.ifForm('string', function(hook) {
					out = mm.$hooks[hook] && mm.$hooks[hook].length;
				})
				.ifForm('array', function(hooks) {
					out = hooks.every(function(hook) {
						return (mm.$hooks[hook] && mm.$hooks[hook].length);
					});
				});

			return out;
		});


		/**
		* Execute all hooks for an event
		* This function fires all hooks in parallel and expects all to resolve correctly via callback
		* NOTE: Hooks are always fired with the callback as the first argument
		* @param {string} name The name of the hook to invoke
		* @param {function} callback The callback to invoke on success
		* @param {...*} parameters Any other parameters to be passed to each hook
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.fire = function(name, callback) {
			if (mm.listenerCount(name)) { // There is at least one event handler attached
				var eventArgs = _.values(arguments);
				eventArgs.splice(1, 1); // Remove the 'callback' arg as events cant respond to it anyway
				mm.emit.apply(mm, eventArgs);
			}

			if (!mm.$hooks[name] || !mm.$hooks[name].length) return callback();

			// Calculate the args array we will pass to each hook
			var hookArgs = _.values(arguments);
			hookArgs.shift(); // We will set args[0] to the callback in each case anyway so we only need to shift 1

			var eventArgs = _.values(arguments);
			eventArgs.splice(1, 1); // Remove the 'callback' arg as events cant respond to it anyway

			async()
				.forEach(mm.$hooks[name], function(next, hook) {
					// Fire hooks by this name
					hookArgs[0] = next;
					hook.apply(mm, hookArgs);
				})
				.end(callback);

			return mm;
		};

		/**
		* Run a third party plugin against a model
		* This function is really just a shorthand way to pass a Monoxide model into a function
		* @param {function} plugin The plugin to run. This gets the arguments (model, callback)
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.use = function(plugin, callback) {
			plugin.call(mm, mm, callback);
			return mm;
		};

		return mm;
	});
	util.inherits(self.monoxideModel, events.EventEmitter);

	// }}}

	// .monoxideDocument([setup]) - monoxide document instance {{{
	/**
	* Returns a single instance of a Monoxide document
	* @class
	* @name monoxide.monoxideDocument
	* @param {Object} setup The prototype fields. Everything in this object is extended into the prototype
	* @param {boolean} [setup.$applySchema=true] Whether to enforce the model schema on the object. This includes applying default values
	* @param {boolean} [setup.$dirty=false] Whether the entire document contents should be marked as dirty (modified). If true this also skips the computation of modified fields
	* @param {boolean [setup.decorate=true] Whether to apply any decoration. If false this function returns data undecorated (i.e. no custom Monoxide functionality)
	* @param {string} setup.$collection The collection this document belongs to
	* @param {Object} data The initial data
	* @return {monoxide.monoxideDocument}
	*/
	self.monoxideDocument = function monoxideDocument(setup, data) {
		if (setup.$decorate === false) return data;
		setup.$dirty = !!setup.$dirty;

		var model = self.models[setup.$collection];

		var proto = {
			$MONOXIDE: true,
			$collection: setup.$collection,
			$populated: {},

			/**
			* Save a document
			* By default this function will only save back modfified data
			* If `data` is specified this is used as well as the modified fields (unless `data.$ignoreModified` is falsy, in which case modified fields are ignored)
			* @param {Object} [data] An optional data patch to save
			* @param {boolean} [data.$ignoreModified=false] Ignore all modified fields and only process save data being passed in the `data` object (use this to directly address what should be saved, ignoring everything else). Setting this drastically speeds up the save operation but at the cost of having to be specific as to what to save
			* @param {function} [callback] The callback to invoke on saving
			*/
			save: argy('[object] [function]', function(data, callback) {
				var doc = this;
				var mongoDoc = doc.toMongoObject();
				var patch = {
					$collection: doc.$collection,
					$id: doc._id,
					$errNoUpdate: true, // Throw an error if we fail to update (i.e. record removed before save)
					$returnUpdated: true,
				};

				if (data && data.$ignoreModified) { // Only save incomming data
					delete data.$ignoreModified;
					_.assign(patch, data);
				} else if (data) { // Data is specified as an object but $ignoreModified is not set - use both inputs
					doc.isModified().forEach(function(path) {
						patch[path] = _.get(mongoDoc, path);
					});
					_.assign(patch, data);
				} else {
					doc.isModified().forEach(function(path) {
						patch[path] = _.get(mongoDoc, path);
					});
				}

				self.save(patch, function(err, newRec) {
					doc = newRec;
					if (_.isFunction(callback)) callback(err, newRec);
				});

				return doc;
			}),

			/**
			* Remove the document from the collection
			* This method is really just a thin wrapper around monoxide.delete()
			* @param {function} [callback] Optional callback to invoke on completion
			* @see monoxide.delete
			*/
			remove: function(callback) {
				var doc = this;
				self.delete({
					$collection: doc.$collection,
					$id: doc._id,
				}, callback);
				return doc;
			},

			/**
			* Remove certain fields from the document object
			* This method is really just a thin wrapper around monoxide.delete()
			* @param {string|regexp|array} fields Either a single field name, regular expression or array of strings/regexps to filter by. Any key matching will be removed from the object
			* @return {monoxide.monoxideDocument} This object after the fields have been removed
			*/
			omit: function(fields) {
				var removeFields = _.castArray(fields);
				traverse(this).forEach(function(v) {
					if (!this.key) return; // Skip array entries
					var key = this.key;
					if (removeFields.some(function(filter) {
						return (
							(_.isString(filter) && key == filter) ||
							(_.isRegExp(filter) && filter.test(key))
						);
					})) {
						this.remove();
					}
				});
				return this;
			},

			/**
			* Transform a MonoxideDocument into a plain JavaScript object
			* @return {Object} Plain JavaScript object with all special properties and other gunk removed
			*/
			toObject: function() {
				var doc = this;
				var newDoc = {};
				_.forEach(this, function(v, k) {
					if (doc.hasOwnProperty(k) && !_.startsWith(k, '$')) newDoc[k] = _.clone(v);
				});

				return newDoc;
			},

			/**
			* Transform a MonoxideDocument into a Mongo object
			* This function transforms all OID strings back into their Mongo equivalent
			* @return {Object} Plain JavaScript object with all special properties and other gunk removed
			*/
			toMongoObject: function() {
				var doc = this;
				var outDoc = doc.toObject(); // Rely on the toObject() syntax to strip out rubbish

				doc.getOIDs().forEach(function(node) {
					switch (node.fkType) {
						case 'objectId':
							var oidLeaf = _.get(doc, node.docPath);
							if (_.isUndefined(oidLeaf)) return; // Ignore undefined

							if (!self.utilities.isObjectID(oidLeaf)) {
								if (_.has(oidLeaf, '_id')) { // Already populated?
									_.set(outDoc, node.docPath, self.utilities.objectID(oidLeaf._id));
								} else { // Convert to an OID
									_.set(outDoc, node.docPath, self.utilities.objectID(oidLeaf));
								}
							}
							break;
						case 'objectIdArray':
							var oidLeaf = _.get(doc, node.schemaPath);
							_.set(outDoc, node.schemaPath, oidLeaf.map(function(leaf) {
								return self.utilities.isObjectID(leaf) ? leaf : self.utilities.objectID(leaf);
							}));
							break;
						default:
							return; // Ignore unsupported OID types
					}
				});

				return outDoc;
			},

			isModified: function(path) {
				var doc = this;
				if (path) {
					var v = _.get(doc, path);
					var pathJoined = _.isArray(path) ? path.join('.') : path;
					if (self.utilities.isObjectID(v)) {
						if (doc.$populated[pathJoined]) { // Has been populated
							// FIXME; What happens if a populated document changes
							throw new Error('Changing populated document objects is not yet supported');
							return false;
						} else { // Has not been populated
							if (doc.$originalValues[pathJoined]) { // Compare against the string value
								return doc.$originalValues[pathJoined] != v.toString();
							} else if (doc.$originalValues[pathJoined + '.id'] && doc.$originalValues[pathJoined + '._bsontype']) { // Known but its stored as a Mongo OID - look into its values to determine its real comparitor string
								// When the lookup is a raw OID we need to pass the binary junk into the objectID THEN get its string value before we can compare it to the one we last saw when we fetched the object
								return self.utilities.objectID(doc.$originalValues[pathJoined + '.id']).toString() != v.toString(); // Compare against the string value
							} else {
								return true; // Otherwise declare it modified
							}
						}
					} else if (_.isObject(v)) { // If its an object (or an array) examine the $clean propertly
						return !v.$clean;
					} else {
						return doc.$originalValues[pathJoined] != v;
					}
				} else {
					var modified = [];
					traverse(doc).map(function(v) { // NOTE - We're using traverse().map() here as traverse().forEach() actually mutates the array if we tell it not to recurse with this.remove(true) (needed to stop recursion into complex objects if the parent has been changed)
						if (!this.path.length) return; // Root node
						if (_.startsWith(this.key, '$') || this.key == '_id') { // Don't scan down hidden elements
							return this.remove(true);
						} else if (self.utilities.isObjectID(v)) { // Leaf is an object ID
							if (doc.isModified(this.path)) modified.push(this.path.join('.'));
							this.remove(true); // Don't scan any deeper
						} else if (doc.isModified(this.path)) {
							if (_.isObject(v)) this.remove(true);
							modified.push(this.path.join('.'));
						}
					});
					return modified;
				}
			},

			/**
			* Expand given paths into objects
			* @param {Object|array|string} populations A single or multiple populations to perform
			* @param {function} callback The callback to run on completion
			* @param {boolean} [strict=false] Whether to raise errors and agressively retry if a population fails
			* @return {Object} This document
			*/
			populate: function(populations, callback, strict) {
				var doc = this;
				var populations = _(populations)
					.castArray()
					.map(function(population) { // Mangle all populations into objects (each object should contain a path and an optional ref)
						if (_.isString(population)) {
							return {path: population};
						} else {
							return population;
						}
					})
					.value();

				var tryPopulate = function(finish, populations, strict) {
					var willPopulate = 0; // Count of items that seem valid that we will try to populate
					var failedPopulations = []; // Populations that we couldn't get the end-points of (probably because they are nested)
					var populator = async(); // Defered async worker that will actually populate things
					async()
						.forEach(populations, function(nextPopulation, population) {
							try {
								doc.getNodesBySchemaPath(population.path, true).forEach(function(node) {
									if (!population.ref) {
										population.ref = _.get(model, ['$mongooseModel', 'schema', 'paths', node.schemaPath, 'options', 'ref']);
										if (!population.ref) throw new Error('Cannot determine collection to use for schemaPath ' + node.schemaPath + '! Specify this is in model with {ref: <collection>}');
									}

									if (_.isObject(node.node) && node.node._id) { // Object is already populated
										willPopulate++; // Say we're going to resolve this anyway even though we have nothing to do - prevents an issue where the error catcher reports it as a null operation (willPopulate==0)
									} else if (!node.node) {
										// Node is falsy - nothing to populate here
									} else {
										populator.defer(function(next) {
											self.query({
												$errNotFound: false,
												$collection: population.ref,
												$id: self.utilities.isObjectID(node.node) ? node.node.toString() : node.node,
											}, function(err, res) {
												if (err) return next(err);
												_.set(doc, node.docPath, res);
												doc.$populated[node.docPath] = true;
												next();
											});
										});
										willPopulate++;
									}
								});
								nextPopulation();
							} catch (e) {
								if (strict) failedPopulations.push(population);
								nextPopulation();
							}
						})
						.then(function(next) {
							if (willPopulate > 0) {
								populator.await().end(next); // Run all population defers
							} else if (strict) {
								next('Unable to resolve remaining populations: ' + JSON.stringify(populations) + '. In ' + doc.$collection + '#' + doc._id);
							} else {
								next();
							}
						})
						.end(function(err) {
							if (err) {
								callback(err);
							} else if (failedPopulations.length) {
								console.log('SILL MORE POPULATIONS TO RUN', failedPopulations);
								setTimeout(function() {
									console.log('FIXME: Defered runnable');
									//tryPopulate(callback, failedPopulations);
								});
							} else {
								callback(null, doc);
							}
						});
				};
				tryPopulate(callback, populations, strict);
				return doc;
			},

			/**
			* Retrieves all 'leaf' elements matching a schema path
			* Since any segment of the path could be a nested object, array or sub-document collection this function is likely to return multiple elements
			* For the nearest approximation of how this function operates think of it like performing the jQuery expression: `$('p').each(function() { ... })`
			* @param {string} schemaPath The schema path to iterate down
			* @param {boolean} [strict=false] Optional indicator that an error should be thrown if a path cannot be traversed
			* @return {array} Array of all found leaf nodes
			*/
			getNodesBySchemaPath: function(schemaPath, strict) {
				var doc = this;
				var examineStack = [{
					node: doc,
					docPath: '',
					schemaPath: '',
				}];

				var segments = schemaPath.split('.');
				segments.every(function(pathSegment, pathSegmentIndex) {
					return examineStack.every(function(esDoc, esDocIndex) {
						if (esDoc === false) { // Skip this subdoc
							return true;
						} else if (_.isUndefined(esDoc.node[pathSegment]) && pathSegmentIndex == segments.length -1) {
							examineStack[esDocIndex] = {
								node: esDoc.node[pathSegment],
								docPath: esDoc.docPath + '.' + pathSegment,
								schemaPath: esDoc.schemaPath + '.' + pathSegment,
							};
							return true;
						} else if (_.isUndefined(esDoc.node[pathSegment])) {
							// If we are trying to recurse into a path segment AND we are not at the leaf of the path (as undefined leaves are ok) - raise an error
							if (strict) throw new Error('Cannot traverse into path: "' + (esDoc.docPath + '.' + pathSegment).substr(1) + '" for doc ' + doc.$collection + '#' + doc._id);
							examineStack[esDocIndex] = false;
							return false;
						} else if (_.isArray(esDoc.node[pathSegment])) { // Found an array - remove this doc and append each document we need to examine at the next stage
							esDoc.node[pathSegment].forEach(function(d,i) {
								// Do this in a forEach to break appart the weird DocumentArray structure we get back from Mongoose
								examineStack.push({
									node: d,
									docPath: esDoc.docPath + '.' + pathSegment + '.' + i,
									schemaPath: esDoc.schemaPath + '.' + pathSegment,
								})
							});
							examineStack[esDocIndex] = false;
							return true;
						} else if (_.has(esDoc.node, pathSegment)) { // Traverse into object - replace this nodeerence with the new pointer
							examineStack[esDocIndex] = {
								node: esDoc.node[pathSegment],
								docPath: esDoc.docPath + '.' + pathSegment,
								schemaPath: esDoc.schemaPath + '.' + pathSegment,
							};
							return true;
						}
					});
				});

				return _(examineStack)
					.filter()
					.filter(function(node) {
						return !! node.docPath;
					})
					.map(function(node) {
						node.docPath = node.docPath.substr(1);
						node.schemaPath = node.schemaPath.substr(1);
						return node;
					})
					.value();
			},

			/**
			* Return an array of all OID leaf nodes within the document
			* This function combines the behaviour of monoxide.utilities.extractFKs with monoxide.monoxideDocument.getNodesBySchemaPath)
			* @return {array} An array of all leaf nodes
			*/
			getOIDs: function() {
				var doc = this;
				var stack = [];

				_.forEach(model.$oids, function(fkType, schemaPath) {
					if (fkType.type == 'subDocument') return; // Skip sub-documents (as they are stored against the parent anyway)

					stack = stack.concat(doc.getNodesBySchemaPath(schemaPath)
						.map(function(node) {
							node.fkType = fkType.type;
							return node;
						})
					);
				});
				return stack;
			},

			$applySchema: true,
		};

		proto.delete = proto.remove;

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

		_.extend(doc, data);

		// Apply schema
		if (doc.$applySchema) {
			_.forEach(model.$mongooseModel.schema.paths, function(pathSpec, path) {
				var docValue = _.get(doc, path, undefined);
				if (_.isUndefined(docValue)) {
					if (pathSpec.defaultValue) { // Item is blank but SHOULD have a default
						_.set(doc, path, _.isFunction(pathSpec.defaultValue) ? pathSpec.defaultValue() : pathSpec.defaultValue);
					} else {
						_.set(doc, path, undefined);
					}
				}
			});
		}

		// Sanitize data to remove all ObjectID crap
		doc.getOIDs().forEach(function(node) {
			if (node.fkType == 'objectId') {
				var singleOid = _.get(doc, node.docPath);
				if (self.utilities.isObjectID(singleOid))
					_.set(doc, node.docPath, singleOid.toString());
			} else if (node.fkType == 'objectIdArray') {
				var oidArray = _.get(doc, node.docPath);
				if (self.utilities.isObjectID(oidArray)) {
					_.set(doc, node.docPath, oidArray.toString());
				} else if (_.isObject(oidArray) && oidArray._id && self.utilities.isObjectID(oidArray._id)) {
					// FIXME: Rather crappy sub-document flattening for now
					// This needs to actually scope into the sub-object schema and flatten each ID and not just the _id element

					oidArray._id = oidArray._id.toString();
				}
			}
		});


		// Break object into component parts and apply the '$clean' marker to arrays and objects
		Object.defineProperty(doc, '$originalValues', {
			enumerable: false,
			value: {},
		});

		if (!setup.$dirty) {
			traverse(doc).forEach(function(v) {
				// If its an object (or array) glue the `$clean` property to it to detect writes
				if (_.isObject(v)) {
					Object.defineProperty(v, '$clean', {
						enumerable: false,
						value: true,
					});
				} else if (!_.isPlainObject(v)) { // For everything else - stash the original value in this.parent.$originalValues
					doc.$originalValues[this.path.join('.')] = self.utilities.isObjectID(v) ? v.toString() : v;
				}
			});
		}

		// Apply population data
		doc.getOIDs().forEach(function(node) {
			doc.$populated[node.docPath] = self.utilities.isObjectID(node.docPath);
			if (!setup.$dirty) doc.$originalValues[node.docPath] = _.get(doc, node.docPath);
		});

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
		if (!argy.isType(model, 'string') || !argy.isType(spec, 'object')) throw new Error('Schema construction requires a model ID + schema object');

		var schema = new mongoose.Schema(_.deepMapValues(spec, function(value, path) {
			// Rewrite .type leafs {{{
			if (_.endsWith(path, '.type')) { // Ignore not type rewrites
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
			// }}}
			// Rewrite .ref leafs {{{
			} else if (_.endsWith(path, '.ref')) {
				if (!_.isString(value)) return value; // Leave complex objects alone
				return value.toLowerCase();
			// }}}
			// Leave everything else unaltered {{{
			} else { // Do nothing
				return value;
			}
			// }}}
		}));

		// Add to model storage
		self.models[model] = new self.monoxideModel({
			$collection: model,
			$mongoose: mongoose.model(model.toLowerCase(), schema), // FIXME: When we implement our own schema def system we can remove the toLowerCase() component that Mongoose insists on using. We can also remove all of the other toLowerCase() calls when we're trying to find the Mongoose schema
		});

		return self.models[model];
	};
	// }}}

	// .aggregate([q], callback) {{{
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
	* @param {function} callback(err, result) the callback to call on completion or error
	*
	* @return {Object} This chainable object
	*/
	self.aggregate = argy('string|object function', function MonoxideAggregate(q, callback) {
		if (argy.isType(q, 'string')) q = {$collection: q};

		async()
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for save operation');
				if (!q.$stages || !_.isArray(q.$stages)) return next('$stages must be specified as an array');
				if (!q.$collection) return next('$collection must be specified for save operation');
				if (!self.models[q.$collection]) return next('Model not initalized');
				next();
			})
			// }}}
			// Execute and capture return {{{
			.then('result', function(next) {
				self.models[q.$collection].$mongoModel.aggregate(q.$stages, next);
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
	});
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
		meta: false,
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
	* See monoxide.express.defaults() to change the default settings for this function globally
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
	* @param {boolean|monoxide.express.middlewareCallback} [settings.meta=false] Allow retrival of meta information
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
	self.express.middleware = argy('string object', function(model, options) {
		var settings = _.defaults({}, options, self.express._defaults);
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.middleware(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			req.monoxide = { // Setup object to pass params to callback functions
				collection: settings.collection,
			};

			// Count {{{
			if (settings.count && req.method == 'GET' && req.params.id && req.params.id == 'count' && !_.isBoolean(settings.count)) {
				self.utilities.runMiddleware(req, res, settings.count, function() {
					self.express.count(settings)(req, res, next);
				}, settings);
			} else if (settings.count && req.method == 'GET' && req.params.id && req.params.id == 'count') {
				self.express.count(settings)(req, res, next);
			// }}}
			// Meta {{{
			} else if (settings.meta && req.method == 'GET' && req.params.id && req.params.id == 'meta' && !_.isBoolean(settings.meta)) {
				self.utilities.runMiddleware(req, res, settings.meta, function() {
					self.express.meta(settings)(req, res, next);
				}, settings);
			} else if (settings.meta && req.method == 'GET' && req.params.id && req.params.id == 'meta') {
				self.express.meta(settings)(req, res, next);
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
	});
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
	* @param {string} [settings.queryAllowed=Object] Optional specification on what types of values should be permitted for query fields (keys can be: 'scalar', 'scalarCSV', 'array')
	* @param {array|string|regexp} [settings.omitFields] Run all results though monoxideDocument.omit() before returning to remove the stated fields
	* @param {function} [settings.map] Run the document though this map function before returning
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to serve widgets
	* app.get('/api/widgets/:id?', monoxide.express.get('widgets'));
	*/
	self.express.get = argy('[string] [object]', function MonoxideExpressGet(model, options) {
		var settings = _.defaults({}, options, {
			queryRemaps: { // Remap incomming values on left to keys on right
				populate: '$populate',
				select: '$select',
			},
			queryAllowed: { // Fields and their allowed contents (post remap)
				'$populate': {scalar: true, scalarCSV: true, array: true},
				'$select': {scalar: true, scalarCSV: true, array: true},
			},
			passThrough: false, // If true this module will behave as middleware gluing req.document as the return, if false it will handle the resturn values via `res` itself
			omitFields: [/^_(?!id|_v)/], // Omit all fields prefixed with '_' that are not '_id' or '__v'
		});
		if (model) settings.collection = model;

		if (!settings.collection) throw new Error('No collection specified for monoxide.express.get(). Specify as a string or {collection: String}');
		// }}}

		return function(req, res, next) {
			if (!req.params.id) return res.send('No ID specified').status(404).end();
			var q = self.utilities.rewriteQuery(req.query, settings);
			q.$collection = settings.collection;
			q.$data = settings.$data;
			q.$id = req.params.id;

			self.get(q, function(err, doc) {
				// Apply omitFields {{{
				if (!_.isEmpty(settings.omitFields) && _.isObject(doc)) {
					doc.omit(settings.omitFields);
				}
				// }}}
				// Apply map {{{
				if (_.isObject(doc) && _.isFunction(settings.map)) {
					doc = [doc].map(settings.map)[0];
				}
				// }}}
				if (settings.passThrough) { // Act as middleware
					req.document = doc;
					next(err, doc);
				} else if (err) { // Act as endpoint and there was an error
					if (err == 'Not found') return res.status(404).end();
					res.status(400).end();
				} else { // Act as endpoint and result is ok
					res.send(doc).end();
				}
			});
		};
	});
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
	* @param {string} [settings.queryRemaps=Object] Object of keys that should be translated from the incomming req.query into their Monoxide equivelents (e.g. `{populate: '$populate'`})
	* @param {string} [settings.queryAllowed=Object] Optional specification on what types of values should be permitted for query fields (keys can be: 'scalar', 'scalarCSV', 'array')
	* @param {boolean} [settings.shorthandArrays=true] Remap simple arrays (e.g. `key=val1&key=val2` into `key:{$in:[val1,val2]}`) automatically
	* @param {array|string|regexp} [settings.omitFields] Run all results though monoxideDocument.omit() before returning to remove the stated fields
	* @param {function} [settings.map] Run all documents though this map function before returning
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to serve widgets
	* app.get('/api/widgets', monoxide.express.query('widgets'));
	*/
	self.express.query = argy('[string] [object]', function MonoxideExpressQuery(model, options) {
		var settings = _.defaults({}, options, {
			shorthandArrays: true,
			queryRemaps: { // Remap incomming values on left to keys on right
				'limit': '$limit',
				'populate': '$populate',
				'select': '$select',
				'skip': '$skip',
				'sort': '$sort',
			},
			queryAllowed: { // Fields and their allowed contents (post remap)
				'$limit': {scalar: true},
				'$populate': {scalar: true, scalarCSV: true, array: true},
				'$select': {scalar: true, scalarCSV: true, array: true},
				'$skip': {scalar: true},
				'$sort': {scalar: true},
			},
			passThrough: false, // If true this module will behave as middleware gluing req.document as the return, if false it will handle the resturn values via `res` itself
			omitFields: [/^_(?!id|_v)/], // Omit all fields prefixed with '_' that are not '_id' or '__v'
		});
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.query(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			var q = self.utilities.rewriteQuery(req.query, settings);
			q.$collection = settings.collection;
			q.$data = settings.$data;

			if (settings.shorthandArrays) {
				q = _.mapValues(q, function(val, key) {
					if (!settings.queryAllowed[key] && _.isArray(val)) return val = {$in: val}
					return val;
				});
			}

			self.query(q, function(err, rows) {
				// Apply omitFields {{{
				if (!err && !_.isEmpty(settings.omitFields)) {
					rows.forEach(function(row) {
						row.omit(settings.omitFields);
					});
				}
				// }}}
				// Apply map {{{
				if (!err && _.isFunction(settings.map)) {
					rows = rows.map(settings.map);
				}
				// }}}
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
	});
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
	self.express.count = argy('[string] [object]', function MonoxideExpressCount(model, options) {
		var settings = _.defaults({}, options, {
			passThrough: false, // If true this module will behave as middleware gluing req.document as the return, if false it will handle the resturn values via `res` itself
		});
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.count(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			var q = self.utilities.rewriteQuery(req.query, settings);
			q.$collection = settings.collection;
			q.$count = true;
			q.$data = settings.$data;

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
	});
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
	self.express.save = argy('[string] [object]', function MonoxideExpressSave(model, options) {
		var settings = _.defaults({}, options, {
			passThrough: false, // If true this module will behave as middleware, if false it will handle the resturn values via `res` itself
		});
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.save(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			var q = _.clone(req.body);

			q.$collection = settings.collection;
			q.$data = settings.$data;

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
	});
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
	self.express.create = argy('[string] [object]', function MonoxideExpressCreate(model, options) {
		var settings = _.defaults({}, options, {
			passThrough: false, // If true this module will behave as middleware, if false it will handle the resturn values via `res` itself
		});

		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.create(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			var q = _.clone(req.body);

			q.$collection = settings.collection;
			q.$data = settings.$data;

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
	});
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
	self.express.delete = argy('[string] [object]', function MonoxideExpressDelete(model, options) {
		var settings = _.defaults({}, options, {
			collection: null, // The collection to operate on
			passThrough: false, // If true this module will behave as middleware, if false it will handle the resturn values via `res` itself
		});
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.delete(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			var q = _.clone(req.body);

			q.$collection = settings.collection;
			q.$data = settings.$data;

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
	});
	// }}}

	// .express.meta(settings) {{{
	/**
	* Return an Express middleware binding for meta information about a schema
	* Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router
	*
	* @name monoxide.express.meta
	*
	* @param {string} [model] The model name to bind to (this can also be specified as settings.collection)
	* @param {Object} [settings] Middleware settings
	* @param {string} [settings.collection] The model name to bind to
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method provide meta information
	* app.delete('/api/widgets/meta', monoxide.express.meta('widgets'));
	*/
	self.express.meta = argy('[string] [object]', function MonoxideExpressMeta(model, options) {
		var settings = _.defaults({}, options, {
			collection: null, // The collection to operate on
			passThrough: false, // If true this module will behave as middleware, if false it will handle the resturn values via `res` itself
			queryRemaps: { // Remap incomming values on left to keys on right
				'collectionEnums': '$collectionEnums',
				'prototype': '$prototype',
			},
			queryAllowed: { // Fields and their allowed contents (post remap)
				'$collectionEnums': {boolean: true},
				'$prototype': {boolean: true},
			},
		});
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.meta(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			var q = self.utilities.rewriteQuery(req.query, settings);
			q.$collection = settings.collection;
			q.$data = settings.$data;

			if (req.params.id) q.$id = req.params.id;

			self.meta(q, function(err, rows) {
				if (settings.passThrough) { // Act as middleware
					next(err, rows);
				} else if (err) { // Act as endpoint and there was an error
					res.status(400).end();
				} else { // Act as endpoint and result is ok
					res.send(rows).end();
				}
			});
		};
	});
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
	* @param {Object} schema The schema object to examine (usually monoxide.models[model].$mongooseModel.schema)
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
	* This has one additional check which will return undefined if the value passed in is falsy
	* @name monoxide.utilities.objectID
	* @param {string} str The string to convert into an ObjectID
	* @return {Object} A MongoDB-Core compatible ObjectID object instance
	*/
	self.utilities.objectID = function(str) {
		if (!str) return undefined;
		if (_.isObject(str) && str._id) return new mongoose.Types.ObjectId(str._id); // Is a sub-document - extract its _id and use that
		return new mongoose.Types.ObjectId(str);
	};
	// }}}

	// .utilities.isObjectID(string) {{{
	/**
	* Return if the input is a valid MongoDB-Core compatible ObjectID object
	* This is mainly used within functions that need to check that a given variable is a Mongo OID
	* @name monoxide.utilities.isObjectID
	* @param {mixed} subject The item to examine
	* @return {boolean} Whether the subject is a MongoDB-Core compatible ObjectID object instance
	*/
	self.utilities.isObjectID = function(subject) {
		return (subject instanceof mongoose.Types.ObjectId);
	};

	/**
	* Alias of isObjectID
	* @see monoxide.utilities.isObjectId
	*/
	self.utilities.isObjectId = self.utilities.isObjectID;
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

	// .utilities.rewriteQuery(query, settings) {{{
	/**
	* Returns a rewritten version of an incomming query that obeys various rules
	* This usually accepts req.query as a parameter and a complex settings object as a secondary
	* This function is used internally by middleware functions to clean up the incomming query
	*
	* @name monoxide.utilities.rewriteQuery
	* @see monoxide.middleware
	*
	* @param {Object} query The user-provided query object
	* @param {Object} settings The settings object to apply (see middleware functions)
	* @return {Object} The rewritten query object
	*/
	self.utilities.rewriteQuery = function(query, settings) {
		return _(query)
			.mapKeys(function(val, key) {
				if (_.has(settings.queryRemaps, key)) return settings.queryRemaps[key];
				return key;
			})
			.mapValues(function(val, key) {
				if (settings.queryAllowed && settings.queryAllowed[key]) {
					var allowed = settings.queryAllowed[key];
					if (!_.isString(val) && !allowed.scalar) {
						return null;
					} else if (allowed.boolean) {
						return (val == 'true' || val == '1');
					} else if (_.isString(val) && allowed.scalarCSV) {
						return val.split(/\s*,\s*/);
					} else if (_.isArray(val) && allowed.array) {
						return val;
					} else {
						return val;
					}
				}
				return val;
			})
			.value();
	};

	return self;
}

util.inherits(Monoxide, events.EventEmitter);

module.exports = new Monoxide();
