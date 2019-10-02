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
	var o = this;
	o.mongoose = mongoose;
	o.models = {};
	o.connection;
	o.settings = {
		removeAll: true, // Allow db.model.delete() calls with no arguments
		versionIncErr: /^MongoError: Cannot apply \$inc to a value of non-numeric type. {.+} has the field '__v' of non-numeric type null$/i, // RegExp error detector used to detect $inc problems when trying to increment `__v` in update operations
	};

	// .connect {{{
	/**
	* Connect to a Mongo database
	* @param {string} uri The URL of the database to connect to
	* @param {Object} [options] Additional options to pass to Mongoose
	* @param {function} [callback] Optional callback when connected, if omitted this function is syncronous
	* @return {monoxide} The Monoxide chainable object
	*/
	o.connect = argy('string [object] [function]', function(uri, options, callback) {
		mongoose.set('useFindAndModify', false);
		mongoose.set('useCreateIndex', true);
		mongoose.connect(uri, _.assign({
			promiseLibrary: global.Promise,
			useNewUrlParser: true,
		}, options || {}), function(err) {
			if (err) {
				if (_.isFunction(callback)) callback(err);
			} else {
				o.connection = mongoose.connection;
				if (_.isFunction(callback)) callback();
			}
		})

		return o;
	});
	// }}}

	// .disconnect {{{
	/**
	* Disconnect from an active connection
	* @return {monoxide} The Monoxide chainable object
	*/
	o.disconnect = function(callback) {
		mongoose.disconnect(callback);

		return o;
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
	o.get = argy('[object|string|number] [string|number|object] function', function(q, id, callback) {
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
		return o.internal.query(q, callback);
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
	* @param {boolean} [q.$count=false] Only count the results - do not return them. If enabled a number of returned with the result
	* @param {boolean} [q.$countExact=false] Return EXACT match count rather than a quick guess
	* @param {boolean} [q.$countSkipAggregate=false] When an empty query is present, dont try and accelerate the counting via aggregation (much much faster) - see https://jira.mongodb.org/browse/SERVER-3645
	* @param {object|function} [q.$data] Set the user-defined data object, if this is a function the callback result is used
	* @param {boolean} [q.$decorate=true] Add all Monoxide methods, functions and meta properties
	* @param {string} [q.$want='array'] How to return data contents. ENUM: 'array', 'cursor'
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
	o.query = argy('[string|object] function', function MonoxideQuery(q, callback) {
		if (argy.isType(q, 'string')) q = {$collection: q};

		_.defaults(q || {}, {
			$cacheFKs: true, // Cache model Foreign Keys (used for populates) or compute them every time
			$want: 'array',
			$applySchema: true, // Apply the schema on retrieval - this slows ths record retrieval but means any alterations to the schema are applied to each retrieved record
			$errNotFound: true, // During $id / $one operations raise an error if the record is not found
		});
		if (!_.isEmpty(q.$select)) q.$applySchema = false; // Turn off schema application when using $select as we wont be grabbing the full object

		async()
			.set('metaFields', [
				'$collection', '$data', '$dirty', '$id', '$select', '$sort', '$populate', '$one', '$limit', '$skip',
				'$count', '$countExact', '$countSkipAggregate',
				'$want', '$cacheFKs', '$applySchema', '$decorate', '$plain',
				'$errNotFound',
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for get operation');
				if (!q.$collection) return next('$collection must be specified for get operation');
				if (!o.models[q.$collection]) return next('Model not initalized: "' + q.$collection + '"');
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
				//console.log('POSTPOPFIELDS', o.filterPostPopulate);

				if (q.$count) {
					if (q.$countExact) {
						next(null, o.models[q.$collection].$mongooseModel.estimatedDocumentCount(fields));
					} else if (!q.$countSkipAggregate && _.isEmpty(fields)) {
						q.$want = 'raw'; // Signal that we've already run the query here
						o.models[q.$collection].aggregate([ {$collStats: {count: {}} } ], function(err, res) {
							if (err) return next(err);
							if (!_.has(res, '0.count')) return next('Illegal aggregation return');
							next(null, res[0].count);
						});
					} else if (q.$count) {
						next(null, o.models[q.$collection].$mongooseModel.countDocuments(fields));
					}
				} else if (q.$one) {
					next(null, o.models[q.$collection].$mongooseModel.findOne(fields));
				} else {
					next(null, o.models[q.$collection].$mongooseModel.find(fields));
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
				o.models[q.$collection].fire('query', next, q);
			})
			// }}}
			// Execute and capture return {{{
			.then('result', function(next) {
				switch (q.$want) {
					case 'array':
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
						break;
					case 'cursor':
						next(null, this.query.cursor());
						break;
					case 'raw': // Used by some upstream options like counting to signal that the query has already run and the result should be passed through
						next(null, this.query);
						break;
					default:
						next('Unknown $want type');
				}
			})
			// }}}
			// Convert Mongoose Documents into Monoxide Documents {{{
			.then('result', function(next) {
				// Not wanting an array of data? - pass though the result
				if (q.$want != 'array') return next(null, this.result);

				if (this.result === undefined) {
					next(null, undefined);
				} else if (q.$one) {
					if (q.$decorate) return next(null, this.result.toObject());
					next(null, new o.monoxideDocument({
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
						return new o.monoxideDocument({
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
				// Not wanting an array of data? - pass though the result
				if (q.$want != 'array') return next(null, this.result);

				if (!q.$populate || !q.$populate.length || q.$count || q.$decorate === false || q.$plain === false || this.result === undefined) return next(); // Skip
				async()
					.forEach(_.castArray(this.result), (next, doc) => {
						async()
							.forEach(q.$populate, (next, pop) => {
								var path = _.isString(pop) ? pop : pop.path;
								if (!o.utilities.isObjectId(_.get(doc, path))) return next(); // Already populated

								doc.populate(path, next);
							})
							.end(next);
					})
					.end(next);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					debug('get() error', err);
					return callback(err);
				} else if (q.$count) {
					callback(null, this.result);
				} else {
					callback(null, this.result);
				}
			});
			// }}}
		return o;
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
	o.count = argy('[string|object] function', function MonoxideCount(q, callback) {
		if (argy.isType(q, 'string')) q = {$collection: q};

		// Glue count functionality to query
		q.$count = true;

		return o.internal.query(q, callback);
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
	* @param {boolean} [q.$version=true] Increment the `__v` property when updating
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
	o.save = argy('object [function]', function(q, callback) {
		_.defaults(q || {}, {
			$refetch: true, // Fetch and return the record when updated (false returns null)
			$errNoUpdate: false,
			$errBlankUpdate: false,
			$returnUpdated: true,
			$version: true,
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
				'$version',
				'$returnUpdated',
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for save operation');
				if (!q.$collection) return next('$collection must be specified for save operation');
				if (!q.$id) return next('ID not specified');
				if (!o.models[q.$collection]) return next('Model not initalized');
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
				o.models[q.$collection].fire('save', next, q);
			})
			// }}}
			// Peform the update {{{
			.then('newRec', function(next) {
				var patch = _.omit(q, this.metaFields);
				if (_.isEmpty(patch)) {
					if (q.$errBlankUpdate) return next('Nothing to update');
					if (q.$refetch) {
						return o.internal.get({$collection: q.$collection, $id: q.$id}, next);
					} else {
						return next(null, {});
					}
				}

				_.forEach(o.models[q.$collection].$oids, function(fkType, schemaPath) {
					if (!_.has(patch, schemaPath)) return; // Not patching this field anyway

					switch(fkType.type) {
						case 'objectId': // Convert the field to an OID if it isn't already
							if (_.has(q, schemaPath)) {
								var newVal = _.get(q, schemaPath);
								if (!o.utilities.isObjectID(newVal))
									_.set(patch, schemaPath, o.utilities.objectID(newVal));
							}
							break;
						case 'objectIdArray': // Convert each item to an OID if it isn't already
							if (_.has(q, schemaPath)) {
								var gotOIDs = _.get(q, schemaPath);
								if (_.isArray(gotOIDs)) {
									_.set(patch, schemaPath, gotOIDs.map(function(i, idx) {
										return (!o.utilities.isObjectID(newVal))
											? o.utilities.objectID(i)
											: i;
									}));
								} else {
									throw new Error('Expected ' + schemaPath + ' to contain an array of OIDs but got ' + (typeof gotOIDs));
								}
							}
							break;
					}
				});

				try {
					var updateQuery = { _id: o.utilities.objectID(q.$id) };
				} catch (e) {
					return next('Unable to allocate ID "' + q.$id + '" for save operation');
				}

				var updatePayload = {$set: patch};
				var updateOptions = { returnOriginal: !q.$returnUpdated };
				var updateCallback = function(err, res) {
					if (q.$version && err && o.settings.versionIncErr.test(err.toString())) { // Error while setting `__v`
						// Remove __v as an increment operator + retry the operation
						// It would be good if $inc could assume `0` when null, but Mongo doesn't support that
						updatePayload.$set.__v = 1;
						delete updatePayload.$inc;
						o.models[q.$collection].$mongoModel.findOneAndUpdate(updateQuery, updatePayload, updateOptions, updateCallback);
					} else if (err) {
						next(err);
					} else {
						// This would only really happen if the record has gone away since we started updating
						if (q.$errNoUpdate && !res.ok) return next('No documents updated');

						if (!q.$refetch) return next(null, null);
						next(null, new o.monoxideDocument({$collection: q.$collection}, res.value));
					}
				};

				if (q.$version) {
					updatePayload.$inc = {'__v': 1};
					delete updatePayload.$set.__v; // Remove user updates of __v
				}

				// Actually perform the action
				o.models[q.$collection].$mongoModel.findOneAndUpdate(
					updateQuery, // What we are writing to
					updatePayload, // What we are saving
					updateOptions, // Options passed to Mongo
					updateCallback
				);
			})
			// }}}
			// Fire the 'postSave' hook {{{
			.then(function(next) {
				o.models[q.$collection].fire('postSave', next, q, this.newRec);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					debug('save() error', err);
					if (_.isFunction(callback)) callback(err);
				} else {
					if (_.isFunction(callback)) callback(null, this.newRec);
				}
			});
			// }}}

			return o;
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
	o.update = argy('object|string [object] [function]', function MonoxideUpdate(q, qUpdate, callback) {
		var o = this;
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
				if (!o.models[q.$collection]) return next('Model not initalized');
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
				o.models[q.$collection].fire('update', next, q);
			})
			// }}}
			// Peform the update {{{
			.then('rawResponse', function(next) {
				o.models[q.$collection].$mongooseModel.updateMany(_.omit(q, this.metaFields), _.omit(qUpdate, this.metaFields), {multi: true}, next);
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					debug('update() error', err);
					if (callback) callback(err);
				} else {
					if (callback) callback(null, this.newRec);
				}
			});
			// }}}

			return o;
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
	* @param {boolean} [q.$version=true] Set the `__v` field to 0 when creating the document
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
	o.create = argy('object [function]', function MonoxideQuery(q, callback) {
		_.defaults(q || {}, {
			$refetch: true, // Fetch and return the record when created (false returns null)
			$version: true,
		});

		async()
			.set('metaFields', [
				'$collection', // Collection to query to find the original record
				'$data', // Meta user-defined data
				'$refetch',
				'$version',
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for save operation');
				if (!q.$collection) return next('$collection must be specified for save operation');
				if (!o.models[q.$collection]) return next('Model not initalized');
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
				_.forEach(o.models[q.$collection].$oids, function(fkType, schemaPath) {
					switch(fkType.type) {
						case 'objectId': // Convert the field to an OID if it isn't already
							if (_.has(q, schemaPath)) {
								var newVal = _.get(q, schemaPath);
								if (!o.utilities.isObjectID(newVal))
									_.set(q, schemaPath, o.utilities.objectID(newVal));
							}
							break;
						case 'objectIdArray': // Convert each item to an OID if it isn't already
							if (_.has(q, schemaPath)) {
								var gotOIDs = _.get(q, schemaPath);
								if (_.isArray(gotOIDs)) {
									_.set(q, schemaPath, gotOIDs.map(function(i, idx) {
										return (!o.utilities.isObjectID(newVal))
											? o.utilities.objectID(i)
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
			// Add version information if $version==true {{{
			.then(function(next) {
				if (!q.$version) return next();
				q.__v = 0;
				next();
			})
			// }}}
			// Create record {{{
			.then('createDoc', function(next) { // Compute the document we will create
				next(null, new o.monoxideDocument({
					$collection: q.$collection,
					$dirty: true, // Mark all fields as modified (and not bother to compute the clean markers)
				}, _.omit(q, this.metaFields)));
			})
			.then(function(next) {
				o.models[q.$collection].fire('create', next, this.createDoc);
			})
			.then('rawResponse', function(next) {
				o.models[q.$collection].$mongoModel.insertOne(this.createDoc.toMongoObject(), next);
			})
			.then(function(next) {
				o.models[q.$collection].fire('postCreate', next, q, this.createDoc);
			})
			// }}}
			// Refetch record {{{
			.then('newRec', function(next) {
				if (!q.$refetch) return next(null, null);
				o.internal.query({
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
					debug('create() error', err);
					if (_.isFunction(callback)) callback(err);
				} else {
					if (_.isFunction(callback)) callback(null, this.newRec);
				}
			});
			// }}}

			return o;
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
	o.delete = o.remove = argy('object [function]', function MonoxideQuery(q, callback) {
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

				if (!o.settings.removeAll && !q.$id && _.isEmpty(_.omit(q, this.metaFields))) { // Apply extra checks to make sure we are not nuking everything if we're not allowed
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
					o.internal.query(_.merge(_.omit(q, this.metaFields), {$collection: q.$collection, $select: 'id'}), function(err, rows) {
						async()
							.forEach(rows, function(next, row) {
								o.internal.delete({$collection: q.$collection, $id: row._id}, next);
							})
							.end(next);
					});
				} else { // Single item delete
					// Check that the hook returns ok
					o.models[q.$collection].fire('delete', function(err) {
						// Now actually delete the item
						o.models[q.$collection].$mongoModel.deleteOne({_id: o.utilities.objectID(q.$id)}, function(err, res) {
							if (err) return next(err);
							if (q.$errNotFound && !res.result.ok) return next('Not found');
							// Delete was sucessful - call event then move next
							o.models[q.$collection].fire('postDelete', next, {_id: q.$id});
						});
					}, {_id: q.$id});
				}
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					debug('delete() error', err);
					if (callback) callback(err);
				} else {
					if (callback) callback(null, this.newRec);
				}
			});
			// }}}

			return o;
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
	* @param {boolean} [q.$arrayDefault=false] Set array items to a default of '[]' in the prototype if no other default is specified
	* @param {boolean} [q.$collectionEnums=false] Provide all enums as a collection object instead of an array
	* @param {boolean} [q.$filterPrivate=true] Ignore all private fields
	* @param {boolean} [q.$prototype=false] Provide the $prototype meta object
	* @param {boolean} [q.$indexes=false] Include whether a field is indexed
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
	o.meta = argy('[object] function', function MonoxideMeta(q, callback) {
		_.defaults(q || {}, {
			$arrayDefault: false,
			$filterPrivate: true,
			$prototype: false,
			$indexes: false,
		});

		async()
			.set('metaFields', [
				'$collection', // Collection to query to find the original record
				'$data', // Meta user-defined data
				'$arrayDefault', // Set a default empty array for array types
				'$filterPrivate', // Filter out /^_/ fields
				'$collectionEnums', // Convert enums into a collection (with `id` + `title` fields per object)
				'$prototype',
				'$indexes',
			])
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for meta operation');
				if (!q.$collection) return next('$collection must be specified for meta operation');
				if (!o.models[q.$collection]) return next('Cannot find collection to extract its meta information: ' + q.$collection);
				next();
			})
			// }}}
			// Retrieve the meta information {{{
			.then('meta', function(next) {
				var meta = {
					_id: {type: 'objectid', index: true}, // FIXME: Is it always the case that a doc has an ID?
				};

				var scanNode = function(node, prefix) {
					if (!prefix) prefix = '';

					var sortedPaths = _(node)
						.map((v,k) => v)
						.sortBy('path')
						.value();

					_.forEach(sortedPaths, function(path) {
						var id = prefix + path.path;

						if (q.$filterPrivate && _.last(path.path.split('.')).startsWith('_')) return; // Skip private fields

						var info = {};
						switch (path.instance.toLowerCase()) {
							case 'string':
								info.type = 'string';
								if (path.enumValues && path.enumValues.length) {
									if (q.$collectionEnums) {
										info.enum = path.enumValues.map(e => ({
											id: e,
											title: _.startCase(e),
										}));
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
								if (_.has(path, 'schema.paths')) scanNode(path.schema.paths, id + '.');
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
						if (!_.isUndefined(path.defaultValue)) info.default = argy.isType(path.defaultValue, 'scalar') ? path.defaultValue : '[DYNAMIC]';

						if (q.$indexes && path._index) info.index = true;

						meta[id] = info;
					});
				};

				scanNode(o.models[q.$collection].$mongooseModel.schema.paths);

				next(null, meta);
			})
			// }}}
			// Construct the prototype if $prototype=true {{{
			.then(function(next) {
				if (!q.$prototype) return next();

				var meta = this.meta;
				var prototype = this.meta.$prototype = {};

				_.forEach(this.meta, function(v, k) {
					var parentPath = k.split('.').slice(0, -1).join('.');
					if (parentPath && meta[parentPath] && meta[parentPath].type == 'array') return; // Dont set the prototype if the parent is an array (parent defaults to empty array anyway)

					if (q.$arrayDefault && v.type == 'array') {
						v.default = [];
					} else if (!_.has(v, 'default')) { // Ignore items with no defaults
						return;
					} else if (v.default == '[DYNAMIC]') { // Ignore dynamic values
						return;
					}

					_.set(prototype, k, v.default);
				});

				next();
			})
			// }}}
			// End {{{
			.end(function(err) {
				if (err) {
					debug('meta() error', err);
					if (callback) callback(err);
				} else {
					if (callback) callback(null, this.meta);
				}
			});
			// }}}

			return o;
	});
	// }}}

	// .runCommand(command, [callback]) {{{
	/**
	* Run an internal MongoDB command and fire an optional callback on the result
	*
	* @name monoxide.meta
	*
	* @param {Object} cmd The command to process
	* @param {function} [callback(err,result)] Optional callback to call on completion or error
	* @return {Object} This chainable object
	* @example
	*/
	o.runCommand = argy('object [function]', function MonoxideRunCommand(cmd, callback) {
		o.connection.db.command(cmd, callback);
		return o;
	});
	// }}}

	// .queryBuilder() - query builder {{{
	/**
	* Returns data from a Monoxide model
	* @class
	* @name monoxide.queryBuilder
	* @return {monoxide.queryBuilder}
	* @fires queryBuilder Fired as (callback, qb) when a new queryBuilder object is created
	*/
	o.queryBuilder = function monoxideQueryBuilder() {
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
		qb.sort = argy('string|array|undefined [function]', function(q, callback) {
			argy(arguments)
				.ifForm('', function() {})
				.ifForm('undefined', function() {})
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
		* @param {number|string} q Limit records to this number (it will be parsed to an Int)
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.limit = argy('[falsy|string|number] [function]', function(q, callback) {
			if (!q) {
				delete qb.query.$limit;
			} else if (argy.isType(q, 'string')) {
				qb.query.$limit = parseInt(q);
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
		* @param {number} q Skip this number of records (it will be parsed to an Int)
		* @param {function} [callback] Optional callback. If present this is the equivelent of calling exec()
		* @return {monoxide.queryBuilder} This chainable object
		*/
		qb.skip = argy('[falsy|string|number] [function]', function(q, callback) {
			if (!q) {
				delete qb.query.$skip;
			} else if (argy.isType(q, 'string')) {
				qb.query.$skip = parseInt(q);
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
		qb.populate = argy('[string|array] [function]', function(q, callback) {
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
			return o.internal.query(qb.query, callback);
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

		// qb.promise() {{{
		/**
		* Convenience function to execute the query and return a promise with the result
		* @name monoxide.queryBuilder.promise
		* @memberof monoxide.queryBuilder
		* @return {Mongoose.queryBuilder} This chainable object
		*/
		qb.promise = function(callback) {
			return new Promise(function(resolve, reject) {
				o.internal.query(qb.query, function(err, result) {
					if (err) {
						reject(err);
					} else {
						resolve(result);
					}
				});
			});
		};

		// Wrap all promise functions in a convenience wrapper
		['then', 'catch', 'finally'].forEach(f => {
			qb[f] = function() {
				var p = qb.promise();
				return p[f].apply(p, arguments);
			};
		});
		// }}}

		// qb.cursor() {{{
		/**
		* Convenience function to return the generated cursor back from a queryBuilder object
		* @name monoxide.queryBuilder.cursor
		* @memberof monoxide.queryBuilder
		* @param {function} callback(err, cursor)
		* @return {Mongoose.queryBuilder} This chainable object
		*/
		qb.cursor = function(callback) {
			qb.query.$want = 'cursor';
			return o.internal.query(qb.query, callback);
		};
		// }}}

		o.fireImmediate('queryBuilder', qb);

		return qb;
	};
	util.inherits(o.queryBuilder, Promise); // Look like we're inheriting from Promise to keep dumb promise detection scripts happy
	// }}}

	// .monoxideModel([options]) - monoxide model instance {{{
	/**
	* @class
	*/
	o.monoxideModel = argy('string|object', function monoxideModel(settings) {
		var mm = this;

		if (argy.isType(settings, 'string')) settings = {$collection: settings};

		// Sanity checks {{{
		if (!settings.$collection) throw new Error('new MonoxideModel({$collection: <name>}) requires at least \'$collection\' to be specified');
		if (!o.connection) throw new Error('Trying to create a MonoxideModel before a connection has been established');
		if (!o.connection.db) throw new Error('Connection does not look like a MongoDB-Core object');
		// }}}

		/**
		* The raw MongoDB-Core model
		* @var {Object}
		*/
		mm.$mongoModel = o.connection.db.collection(settings.$collection.toLowerCase());
		if (!mm.$mongoModel) throw new Error('Model not found in MongoDB-Core - did you forget to call monoxide.schema(\'name\', <schema>) first?');

		/**
		* The raw Mongoose model
		* @depreciated This will eventually go away and be replaced with raw `mm.$mongoModel` calls
		* @var {Object}
		*/
		mm.$mongooseModel = o.connection.base.models[settings.$collection.toLowerCase()];

		/**
		* Holder for all OID information
		* This can either be the `._id` of the object, sub-documents, array pointers or object pointers
		* @see monoxide.utilities.extractFKs
		* @var {Object}
		*/
		mm.$oids = _.has(mm, '$mongooseModel.schema') ? o.utilities.extractFKs(mm.$mongooseModel.schema) : {};

		/**
		* Optional model schema
		* NOTE: This is the user defined schema as-is NOT the computed $monogooseModel.schema
		* @var {Object}
		*/
		mm.$schema = settings.$schema;

		mm.$collection = settings.$collection;
		mm.$methods = {};
		mm.$virtuals = {};
		mm.$hooks = {};
		mm.$data = {};


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
			return (new o.queryBuilder())
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
			return (new o.queryBuilder())
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

			return (new o.queryBuilder())
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

			return (new o.queryBuilder())
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
			o.internal.create(q, callback);
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
			o.internal.update(q, qUpdate, callback);
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
		mm.remove = argy('[object] [function]', function(q, callback) {
			return o.internal.delete(_.merge({}, q, {$collection: mm.$collection, $multiple: true}), callback);
		});


		/**
		* Alias of remove()
		* @see monoxide.remove()
		*/
		mm.delete = mm.remove;


		/**
		* Run an aggregation pipeline on a model
		* @param {array} q The aggregation pipeline to process
		* @param {Object} [options] Additional options to pass to the aggreation function
		* @param {function} callback Callback to fire as (err, data)
		* @return {Object} This chainable object
		*/
		mm.aggregate = argy('array [object] function', function(q, options, callback) {
			o.internal.aggregate(
				_.assign({
					$collection: mm.$collection,
					$stages: q,
				}, options)
			, callback)

			return mm;
		});


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
		* @param {string} eventName The event ID to hook against
		* @param {function} callback The callback to run when hooked, NOTE: Any falsy callbacks are ignored
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.hook = function(eventName, callback) {
			if (!callback) return mm; // Ignore flasy callbacks
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
		* Execute all hooks attached to a model
		* This function fires all hooks in parallel and expects all to resolve correctly via callback
		* NOTE: Hooks are always fired with the callback as the first argument
		* @param {string} name The name of the hook to invoke
		* @param {function} callback The callback to invoke on success
		* @param {...*} parameters Any other parameters to be passed to each hook
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.fire = function(name, callback) {
			if ( // There is at least one event handler attached
				(mm.$hooks[name] && mm.$hooks[name].length)
				|| (o.$hooks[name] && o.$hooks[name].length)
			) {
				var eventArgs = _.values(arguments);
				eventArgs.splice(1, 1); // Remove the 'callback' arg as events cant respond to it anyway
				mm.emit.apply(mm, eventArgs);
			} else {
				return callback();
			}

			// Calculate the args array we will pass to each hook
			var hookArgs = _.values(arguments);
			hookArgs.shift(); // We will set args[0] to the callback in each case anyway so we only need to shift 1

			var eventArgs = _.values(arguments);
			eventArgs.splice(1, 1); // Remove the 'callback' arg as events cant respond to it anyway

			async()
				// Fire hooks attached to this model + global hooks {{{
				.forEach([]
					.concat(o.$hooks[name], mm.$hooks[name])
					.filter(f => !!f) // Actually is a function?
				, function(next, hookFunc) {
					hookArgs[0] = next;
					hookFunc.apply(mm, hookArgs);
				})
				// }}}
				.end(callback);

			return mm;
		};


		/**
		* Return the meta structure for a specific model
		* @param {Object} Options to return when computing the meta object. See the main meta() function for details
		* @param {function} callback The callback to call with (err, layout)
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		* @see monoxide.meta()
		*/
		mm.meta = argy('[object] function', function(options, callback) {
			var settings = options || {};
			settings.$collection = mm.$collection;
			o.internal.meta(settings, callback);
			return mm;
		});

		/**
		* Run a third party plugin against a model
		* This function is really just a shorthand way to pass a Monoxide model into a function
		* @param {function|string|array} plugins The plugin(s) to run. Each function is run as (model, callback), strings are assumed to be file paths to JS files if they contain at least one '/' or `.` otherwise they are loaded from the `plugins` directory
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.use = function(plugins, callback) {
			if (!plugins) return callback(); // Do nothing if given falsy

			async()
				.forEach(_.castArray(plugins), function(next, plugin) {
					if (_.isString(plugin)) {
						var pluginModule = /[\/\.]/.test(plugin) // Contains at least one slash or dot?
							? require(plugin)
							: require(__dirname + '/plugins/' + plugin)
						pluginModule.call(mm, mm, next);
					} else if (_.isFunction(plugin)) {
						plugin.call(mm, mm, next);
					} else {
						next('Unsupported plugin format');
					}
				})
				.end(callback);

			return mm;
		};

		/**
		* Return an array of all distinct field values
		* @param {string} field The field to return the values of
		* @param {function} plugin The plugin to run. This gets the arguments (values)
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.distinct = function(field, callback) {
			o.internal.runCommand({
				distinct: mm.$collection,
				key: field,
			}, function(err, res) {
				if (err) return callback(err);
				callback(null, res.values);
			});
			return mm;
		};


		/**
		* Set a simple data key
		* This is usually used to store suplemental information about models
		* @param {Object|string} key The key to set or a full object of keys
		* @param {*} value If `key` is a string the value is the value stored
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.set = function(key, value) {
			if (argy.isType(key, 'object')) {
				_.assign(mm.$data, key);
			} else if (argy.isType(key, 'string')) {
				mm.$data[key] = value;
			} else {
				throw new Error('Unsupported type storage during set');
			}
			return mm;
		};


		/*
		* Gets a simple data key or returns a fallback
		* @param {string} key The data key to retrieve
		* @param {*} [fallback] The fallback to return if the key is not present
		*/
		mm.get = function(key, fallback) {
			return (argy.isType(mm.$data[key], 'undefined') ? fallback : mm.$data[key]);
		};


		/**
		* Ensure various indexes exist on startup
		* @param {string|array|Object} indexes Either a single named field index, an array of indexes to form a combined field or a complex field definition where each value should be `1 || -1`
		* @param {function} [cb] Optional callback
		* @returns {MonoxideModel} Chainable monoxide model
		*/
		mm.index = function(indexes, cb) {
			if (_.isArray(indexes)) {
				indexes = _(indexes)
					.mapKeys(v => v)
					.mapValues(v => 1)
					.value();
			} else if (_.isString(indexes)) {
				indexes = {[indexes]: 1};
			} else if (_.isPlainObject(indexes)) {
				// Do no mutation
			} else {
				throw new Error('Invalid index definition');
			}

			mm.$mongooseModel.ensureIndexes(indexes, cb);

			return mm;
		};


		/**
		* Retrieve the list of actual on-the-database indexes
		* @param {function} callback Callback to fire as (err, indexes)
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.getIndexes = function(callback) {
			mm.$mongoModel.indexes(function(err, res) {
				if (err && err.message == 'no collection') {
					callback(null, []); // Collection doesn't exist yet - ignore and return that it has no indexes
				} else {
					callback(err, res);
				}
			});

			return mm;
		};


		/**
		* Return the list of indexes requested by the schema
		* @param {function} callback Callback to fire as (err, indexes)
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.getSchemaIndexes = function(callback) {
			mm.meta({$indexes: true}, function(err, res) {
				if (err) return callback(err);
				callback(null, _(res)
					.map(function(v, k) {
						return _.assign(v, {id: k});
					})
					.filter(function(v) {
						return !!v.index;
					})
					.map(function(v) {
						var o = {name: v.id == '_id' ? '_id_' : v.id, key: {}};
						o.key[v.id] = 1;
						return o;
					})
					.value()
				);
			});

			return mm;
		};


		/**
		* Check this model by a defined list of indexes
		* The return is a duplicate of the input indexes with an additional `status` property which can equal to 'ok' or 'missing'
		* @param {array} [wantIndexes] The indexes to examine against. If omitted the results of model.getSchemaIndexes() is used
		* @param {array} [actualIndexes] The current state of the model to compare against. If omitted the results of model.getIndexes() is used
		* @param {function} callback The callback to call as (err, indexes)
		* @return {monoxide.monoxideModel} The chainable monoxideModel
		*/
		mm.checkIndexes = argy('[array] [array] function', function(wantIndexes, actualIndexes, callback) {
			async()
				// Either use provided indexes or determine them {{{
				.parallel({
					wantIndexes: function(next) {
						if (wantIndexes) return next(null, wantIndexes);
						mm.getSchemaIndexes(next);
					},
					actualIndexes: function(next) {
						if (actualIndexes) return next(null, actualIndexes);
						mm.getIndexes(next);
					},
				})
				// }}}
				// Compare indexes against whats declared {{{
				.map('indexReport', 'wantIndexes', function(next, index) {
					var foundIndex = this.actualIndexes.find(i => _.isEqual(i.key, index.key));
					if (foundIndex) {
						index.status = 'ok';
					} else {
						index.status = 'missing';
					}

					next(null, index);
				})
				// }}}
				// End {{{
				.end(function(err) {
					if (err) return callback(err);
					callback(null, this.indexReport);
				});
				// }}}
		});


		return mm;
	});
	util.inherits(o.monoxideModel, events.EventEmitter);

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
	* @emits documentCreate Emitted as (doc) when a new document instance is created
	*/
	o.monoxideDocument = function monoxideDocument(setup, data) {
		if (setup.$decorate === false) return data;
		setup.$dirty = !!setup.$dirty;

		var model = o.models[setup.$collection];

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

				o.internal.save(patch, function(err, newRec) {
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
				o.internal.delete({
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

							if (!o.utilities.isObjectID(oidLeaf)) {
								if (_.has(oidLeaf, '_id')) { // Already populated?
									_.set(outDoc, node.docPath, o.utilities.objectID(oidLeaf._id));
								} else if (_.isString(oidLeaf)) { // Convert to an OID
									_.set(outDoc, node.docPath, o.utilities.objectID(oidLeaf));
								}
							}
							break;
						case 'objectIdArray':
							var oidLeaf = _.get(doc, node.schemaPath);
							_.set(outDoc, node.schemaPath, oidLeaf.map(function(leaf) {
								return o.utilities.isObjectID(leaf) ? leaf : o.utilities.objectID(leaf);
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
					if (o.utilities.isObjectID(v)) {
						if (doc.$populated[pathJoined]) { // Has been populated
							// FIXME; What happens if a populated document changes
							throw new Error('Changing populated document objects is not yet supported');
							return false;
						} else { // Has not been populated
							if (doc.$originalValues[pathJoined]) { // Compare against the string value
								return doc.$originalValues[pathJoined] != v.toString();
							} else if (doc.$originalValues[pathJoined + '.id'] && doc.$originalValues[pathJoined + '._bsontype']) { // Known but its stored as a Mongo OID - look into its values to determine its real comparitor string
								// When the lookup is a raw OID we need to pass the binary junk into the objectID THEN get its string value before we can compare it to the one we last saw when we fetched the object
								return o.utilities.objectID(doc.$originalValues[pathJoined + '.id']).toString() != v.toString(); // Compare against the string value
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
						} else if (o.utilities.isObjectID(v)) { // Leaf is an object ID
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
										population.ref = _.get(model, '$mongooseModel.schema.paths.' + node.schemaPath.split('.').join('.schema.paths.') + '.options.ref');
										if (!population.ref) throw new Error('Cannot determine collection to use for schemaPath ' + node.schemaPath + '! Specify this is in model with {ref: <collection>}');
									}

									if (_.isObject(node.node) && node.node._id) { // Object is already populated
										willPopulate++; // Say we're going to resolve this anyway even though we have nothing to do - prevents an issue where the error catcher reports it as a null operation (willPopulate==0)
									} else if (!node.node) {
										// Node is falsy - nothing to populate here
									} else {
										populator.defer(function(next) {
											o.internal.query({
												$errNotFound: false,
												$collection: population.ref,
												$id: o.utilities.isObjectID(node.node) ? node.node.toString() : node.node,
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
						var segmentValue = _.get(esDoc, ['node', pathSegment]);
						if (esDoc === false) { // Skip this subdoc
							return true;
						} else if (!esDoc.node) {
							return true;
						} else if (_.isUndefined(segmentValue) && pathSegmentIndex == segments.length -1) {
							examineStack[esDocIndex] = {
								node: esDoc.node[pathSegment],
								docPath: esDoc.docPath + '.' + pathSegment,
								schemaPath: esDoc.schemaPath + '.' + pathSegment,
							};
							return true;
						} else if (_.isUndefined(segmentValue)) {
							// If we are trying to recurse into a path segment AND we are not at the leaf of the path (as undefined leaves are ok) - raise an error
							if (strict) throw new Error('Cannot traverse into path: "' + (esDoc.docPath + '.' + pathSegment).substr(1) + '" for doc ' + doc.$collection + '#' + doc._id);
							examineStack[esDocIndex] = false;
							return false;
						} else if (_.isArray(segmentValue)) { // Found an array - remove this doc and append each document we need to examine at the next stage
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
			var applyDefaults = function(spec, doc) {
				_.forEach(spec, function(pathSpec, path) {
					var docValue = _.get(doc, path);
					if (pathSpec.instance == 'Array' && _.has(pathSpec, 'options.type') && docValue) { // Collection sub-structure
						docValue.forEach(subDoc => applyDefaults(pathSpec.options.type[0], subDoc));
					} else if (_.isUndefined(docValue)) { // Scalar
						if (pathSpec.defaultValue) { // Item is blank but SHOULD have a default
							_.set(doc, path, _.isFunction(pathSpec.defaultValue) ? pathSpec.defaultValue() : pathSpec.defaultValue);
						} else if (pathSpec.default) { // Mongoose spec default
							_.set(doc, path, _.isFunction(pathSpec.default) ? pathSpec.default() : pathSpec.default);
						} else {
							_.set(doc, path, undefined);
						}
					}
				});
			};
			applyDefaults(model.$mongooseModel.schema.paths, doc);
		}

		// Sanitize data to remove all ObjectID crap
		doc.getOIDs().forEach(function(node) {
			if (node.fkType == 'objectId') {
				var singleOid = _.get(doc, node.docPath);
				if (o.utilities.isObjectID(singleOid))
					_.set(doc, node.docPath, singleOid.toString());
			} else if (node.fkType == 'objectIdArray') {
				var oidArray = _.get(doc, node.docPath);
				if (o.utilities.isObjectID(oidArray)) {
					_.set(doc, node.docPath, oidArray.toString());
				} else if (_.isObject(oidArray) && oidArray._id && o.utilities.isObjectID(oidArray._id)) {
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
					doc.$originalValues[this.path.join('.')] = o.utilities.isObjectID(v) ? v.toString() : v;
				}
			});
		}

		// Apply population data
		doc.getOIDs().forEach(function(node) {
			doc.$populated[node.docPath] = o.utilities.isObjectID(node.docPath);
			if (!setup.$dirty) doc.$originalValues[node.docPath] = _.get(doc, node.docPath);
		});


		o.emit('documentCreate', doc);

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
	o.model = function(model) {
		return o.models[model];
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
	* @emits modelCreate Called as (model, instance) when a model gets created
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
	o.schema = function(model, spec) {
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
		o.models[model] = new o.monoxideModel({
			$collection: model,
			$mongoose: mongoose.model(model.toLowerCase(), schema), // FIXME: When we implement our own schema def system we can remove the toLowerCase() component that Mongoose insists on using. We can also remove all of the other toLowerCase() calls when we're trying to find the Mongoose schema
			$schema: schema.obj,
		});

		o.emit('modelCreate', model, o.models[model]);

		return o.models[model];
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
	* @param {boolean} [q.$slurp=true] Attempt to read all results into an array rather than return a cursor
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
	* @param {string} [q.$want='array'] How to return data contents. ENUM: 'array', 'cursor'. The iterator plugin must be loaded for 'cursor' support
	*
	* @param {function} callback(err, result) the callback to call on completion or error
	*
	* @return {Object} This chainable object
	*/
	o.aggregate = argy('string|object function', function MonoxideAggregate(q, callback) {
		if (argy.isType(q, 'string')) q = {$collection: q};

		async()
			// Sanity checks {{{
			.then(function(next) {
				if (!q || _.isEmpty(q)) return next('No query given for save operation');
				if (!q.$stages || !_.isArray(q.$stages)) return next('$stages must be specified as an array');
				if (!q.$collection) return next('$collection must be specified for save operation');
				if (!o.models[q.$collection]) return next('Model not initalized');
				next();
			})
			// }}}
			// Execute and capture return {{{
			.then('result', function(next) {
				if (!q.$want || q.$want == 'array') {
					o.models[q.$collection].$mongoModel.aggregate(q.$stages, next);
				} else {
					o.fireImmediate('aggregateCursor', q, next);
				}
			})
			// }}}
			// Slurp the cursor? {{{
			.then('result', function(next) {
				if ((!q.$want || q.$want == 'array') && (q.$slurp || _.isUndefined(q.$slurp))) {
					o.utilities.slurpCursor(this.result, next);
				} else {
					next(null, this.result);
				}
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
		return o;
	});
	// }}}

	// .use([plugins...], [callback]) {{{
	/**
	* Run a third party plugin against the entire Monoxide structure
	* Really this function just registers all given modules against monoxide then fires the callback when done
	* Each plugin is called as `(callback, monoxide)`
	* @param {function|string|array} plugins The plugin(s) to run. Each function is run as (model, callback), strings are assumed to be file paths to JS files if they contain at least one '/' or `.` otherwise they are loaded from the `plugins` directory
	* @param {function} [callback] Optional callback to fire when all plugin have registered
	* @return {monoxide.monoxide} The chainable object
	*/
	o.use = function(plugins, callback) {
		if (!plugins) return callback(); // Do nothing if given falsy

		async()
			.forEach(_.castArray(plugins), function(next, plugin) {
				if (o.used.some(i => i === plugin)) {
					debug('Plugin already loaded, ignoring');
					next();
				} else if (_.isString(plugin)) {
					var pluginModule = /[\/\.]/.test(plugin) // Contains at least one slash or dot?
						? require(plugin)
						: require(__dirname + '/plugins/' + plugin)
					pluginModule.call(o, next, o);
					o.used.push(pluginModule);
				} else if (_.isFunction(plugin)) {
					plugin.call(o, next, o);
					o.used.push(plugin);
				} else {
					next('Unsupported plugin format');
				}
			})
			.end(callback);

		return o;
	};

	/**
	* Storage for modules we have already loaded
	* @var {Array <function>} All plugins (as funtions) we have previously loaded
	*/
	o.used = [];
	// }}}

	// .hook(hookName, callback) {{{

	/**
	* Holder for global hooks
	* @var {array <function>}
	*/
	o.$hooks = {};


	/**
	* Attach a hook to a global event
	* A hook is exactly the same as a eventEmitter.on() event but must return a callback
	* Multiple hooks can be attached and all will be called in parallel on certain events such as 'save'
	* All hooks must return non-errors to proceed with the operation
	* @param {string} eventName The event ID to hook against
	* @param {function} callback The callback to run when hooked, NOTE: Any falsy callbacks are ignored
	* @return {monoxide} The chainable monoxide
	*/
	o.hook = function(eventName, callback) {
		if (!callback) return mm; // Ignore flasy callbacks
		if (!o.$hooks[eventName]) o.$hooks[eventName] = [];
		o.$hooks[eventName].push(callback);
		return o;
	};


	/**
	* Execute global level hooks
	* NOTE: This will only fire hooks attached via monoxide.hook() and not individual model hooks
	* NOTE: Hooks are always fired with the callback as the first argument
	* @param {string} name The name of the hook to invoke
	* @param {function} callback The callback to invoke on success
	* @param {...*} parameters Any other parameters to be passed to each hook
	* @return {monoxide} The chainable monoxide
	*/
	o.fire = function(name, callback) {
		if (o.$hooks[name] && o.$hooks[name].length) { // There is at least one event handler attached
			var eventArgs = _.values(arguments);
			eventArgs.splice(1, 1); // Remove the 'callback' arg as events cant respond to it anyway
			o.emit.apply(o, eventArgs);
		} else {
			return callback();
		}

		// Calculate the args array we will pass to each hook
		var hookArgs = _.values(arguments);
		hookArgs.shift(); // We will set args[0] to the callback in each case anyway so we only need to shift 1

		async()
			// Fire hooks attached to this model + global hooks {{{
			.forEach(
				o.$hooks[name]
				.filter(f => !!f) // Actually is a function?
			, function(next, hookFunc) {
				hookArgs[0] = next;
				hookFunc.apply(o, hookArgs);
			})
			// }}}
			.end(callback);

		return o;
	};



	/**
	* Similar to fire() expect that execution is immediate
	* This should only be used by sync functions that require immediate action such as object mutators
	* NOTE: Because of the nature of this function a callback CANNOT be accepted when finished - the function is assumed done when it returns
	* @param {string} name The name of the hook to invoke
	* @param {...*} parameters Any other parameters to be passed to each hook
	* @return {monoxide} The chainable monoxide
	* @see fire()
	*/
	o.fireImmediate = function(name, callback) {
		if (!o.$hooks[name] || !o.$hooks[name].length) return o; // No hooks to run anyway

		for (var i of o.$hooks[name]) {
			let hookArgs = _.values(arguments);
			hookArgs.shift();
			i.apply(o, hookArgs);
		}

		return o;
	};
	// }}}

	// .utilities structure {{{
	o.utilities = {};

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
	o.utilities.extractFKs = function(schema, prefix, base) {
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
				_.forEach(o.utilities.extractFKs(path.schema, prefix + id + '.', base), function(val, key) {
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
	o.utilities.objectID = function(str) {
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
	o.utilities.isObjectID = function(subject) {
		return (subject instanceof mongoose.Types.ObjectId);
	};

	/**
	* Alias of isObjectID
	* @see monoxide.utilities.isObjectId
	*/
	o.utilities.isObjectId = o.utilities.isObjectID;
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
	o.utilities.runMiddleware = function(req, res, middleware, callback, obj) {
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
			return o.utilities.runMiddleware(req, res, _.get(obj, middleware), callback, obj); // Defer to the pointer
		}

		async()
			.limit(1)
			.forEach(runnable, function(nextMiddleware, middlewareFunc, index) {
				middlewareFunc.apply(thisContext, [req, res, nextMiddleware]);
			})
			.end(function(err) {
				if (err) {
					o.express.sendError(res, 403, err);
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
	o.utilities.diff = function(originalDoc, newDoc) {
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
	o.utilities.rewriteQuery = function(query, settings) {
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
					} else if (_.isString(val) && allowed.number) {
						return parseInt(val);
					} else {
						return val;
					}
				}
				return val;
			})
			.value();
	};
	// }}}

	// .utilities.slurpCursor(cursor, cb) {{{
	/**
	* Asyncronously calls a cursor until it is exhausted
	*
	* @name monoxide.utilities.slurpCursor
	*
	* @param {Cursor} cursor A mongo compatible cursor object
	* @param {function} cb The callback to call as (err, result) when complete
	*/
	o.utilities.slurpCursor = function(cursor, cb) {
		var res = [];

		var cursorReady = function(err, result) {
			if (result === null) { // Cursor is exhausted
				cb(null, res);
			} else {
				res.push(result);
				setTimeout(function() { // Queue fetcher in timeout so we don't stack overflow
					cursor.next(cursorReady);
				});
			}
		};

		cursor.next(cursorReady);
	};
	// }}}
	// }}}

	// Create internals mapping {{{
	o.internal = o; // Mapping for the original function handlers (e.g. get() before any mutations)
	// }}}

	return o;
}

util.inherits(Monoxide, events.EventEmitter);

module.exports = new Monoxide();
