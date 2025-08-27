var _  = require('lodash');
var argy = require('argy');
var debug = require('debug')('monoxide:rest');

module.exports = function(finish, o) {
	/**
	* @static monoxide.express
	*/
	o.express = {};
	o.express._defaults = {
		count: true,
		get: true,
		query: true,
		search: true,
		create: false,
		save: false,
		delete: false,
		meta: false,
	};


	/**
	* Function to use when sending an error to the browser
	* NOTE: This function will first look for a res.sendError(code, text) function and use that if it finds one. Otherwise it will default to res.status(code).send(text).end()
	* @param {Object} res The response object
	* @param {number} code A valida HTTP return code
	* @param {*} [err] Optional error text / error object to report
	*/
	o.express.sendError = function(res, code, err) {
		if (res.sendError && err) {
			debug('sendError', code, err);
			res.sendError(code, err);
		} else {
			debug('sendStatus', code);
			res.sendStatus(code);
		}
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
	o.express.defaults = function(settings) {
		_.merge(o.express._defaults, settings);
		return o;
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
	* @param {boolean|monoxide.express.middlewareCallback} [settings.search=true] Allow record fuzzy searching via the GET method (disabled if `model.search()` method not present)
	* @param {boolean|monoxide.express.middlewareCallback} [settings.create=false] Allow the creation of records via the POST method
	* @param {boolean|monoxide.express.middlewareCallback} [settings.save=false] Allow saving of records via the POST method
	* @param {boolean|monoxide.express.middlewareCallback} [settings.delete=false] Allow deleting of records via the DELETE method
	* @param {boolean|monoxide.express.middlewareCallback} [settings.meta=false] Allow retrival of meta information
	* @param {function} [settings.data] Data population callback. This gets executed at the start of each query, its return value is used as `$data` for subsequent queries
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
	o.express.middleware = argy('string object', function(model, options) {
		var settings = _.defaults({}, options, o.express._defaults);
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.middleware(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			req.monoxide = { // Setup object to pass params to callback functions
				collection: settings.collection,
			};

			if (settings.data) { // if settings.data is passsed, run it and use its response
				settings.$data = settings.data(req, res);
			}

			// Search {{{
			if (settings.search && req.method == 'GET' && req.query.q && !_.isBoolean(settings.search) && (!req.params.id || req.params.id == 'count')) {
				debug('search middleware detected');
				o.utilities.runMiddleware(req, res, settings.search, function() {
					o.express.search(settings)(req, res, next);
				}, settings);
			} else if (settings.search && req.method == 'GET' && req.query.q && (!req.params.id || req.params.id == 'count')) {
				debug('search detected');
				o.express.search(settings)(req, res, next);
			// }}}
			// Count {{{
			} else if (settings.count && req.method == 'GET' && req.params.id && req.params.id == 'count' && !_.isBoolean(settings.count)) {
				debug('count middleware detected');
				o.utilities.runMiddleware(req, res, settings.count, function() {
					o.express.count(settings)(req, res, next);
				}, settings);
			} else if (settings.count && req.method == 'GET' && req.params.id && req.params.id == 'count') {
				debug('count detected');
				o.express.count(settings)(req, res, next);
			// }}}
			// Meta {{{
			} else if (settings.meta && req.method == 'GET' && req.params.id && req.params.id == 'meta' && !_.isBoolean(settings.meta)) {
				debug('meta middleware detected');
				o.utilities.runMiddleware(req, res, settings.meta, function() {
					o.express.meta(settings)(req, res, next);
				}, settings);
			} else if (settings.meta && req.method == 'GET' && req.params.id && req.params.id == 'meta') {
				debug('meta detected');
				o.express.meta(settings)(req, res, next);
			// }}}
			// Get {{{
			} else if (settings.get && req.method == 'GET' && req.params.id && !_.isBoolean(settings.get)) {
				debug('get middleware detected');
				req.monoxide.id = req.params.id;
				o.utilities.runMiddleware(req, res, settings.get, function() {
					o.express.get(settings)(req, res, next);
				}, settings);
			} else if (settings.get && req.method == 'GET' && req.params.id) {
				debug('get detected');
				o.express.get(settings)(req, res, next);
			// }}}
			// Query {{{
			} else if (settings.query && req.method == 'GET' && !_.isBoolean(settings.query)) {
				debug('query middleware detected');
				o.utilities.runMiddleware(req, res, settings.query, function() {
					o.express.query(settings)(req, res, next);
				}, settings);
			} else if (settings.query && req.method == 'GET') {
				debug('query detected');
				o.express.query(settings)(req, res, next);
			// }}}
			// Save {{{
			} else if (settings.save && req.method == 'POST' && req.params.id && !_.isBoolean(settings.save)) {
				debug('save middleware detected');
				req.monoxide.id = req.params.id;
				o.utilities.runMiddleware(req, res, settings.save, function() {
					o.express.save(settings)(req, res, next);
				}, settings);
			} else if (settings.save && req.method == 'POST' && req.params.id) {
				debug('save detected');
				o.express.save(settings)(req, res, next);
			// }}}
			// Create {{{
			} else if (settings.create && req.method == 'POST' && !_.isBoolean(settings.create)) {
				debug('create middleware detected');
				req.monoxide.id = req.params.id;
				o.utilities.runMiddleware(req, res, settings.create, function() {
					o.express.create(settings)(req, res, next);
				}, settings);
			} else if (settings.create && req.method == 'POST') {
				debug('create detected');
				o.express.create(settings)(req, res, next);
			// }}}
			// Delete {{{
			} else if (settings.delete && req.method == 'DELETE' && !_.isBoolean(settings.delete)) {
				debug('delete middleware detected');
				req.monoxide.id = req.params.id;
				o.utilities.runMiddleware(req, res, settings.delete, function() {
					o.express.delete(settings)(req, res, next);
				}, settings);
			} else if (settings.delete && req.method == 'DELETE') {
				debug('delete detected');
				o.express.delete(settings)(req, res, next);
			// }}}
			// Unknown {{{
			} else {
				res.sendStatus(404);
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
	* @param {string} [settings.queryRemaps] Object of keys that should be translated from the incoming req.query into their Monoxide equivelents (e.g. `{populate: '$populate'`})
	* @param {string} [settings.queryAllowed=Object] Optional specification on what types of values should be permitted for query fields (keys can be: 'scalar', 'scalarCSV', 'array')
	* @param {array|string|regexp} [settings.omitFields] Run all results though monoxideDocument.omit() before returning to remove the stated fields
	* @param {function} [settings.map] Run the document though this map function before returning
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to serve widgets
	* app.get('/api/widgets/:id?', monoxide.express.get('widgets'));
	*/
	o.express.get = argy('[string] [object]', function MonoxideExpressGet(model, options) {
		debug('get %s/%s', model, options && options.collection);
		var settings = _.defaults({}, options, {
			queryRemaps: { // Remap incoming values on left to keys on right
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

		return function(req, res, next) {
			if (!req.params.id) return o.express.sendError(res, 404, 'No ID specified');
			var q = o.utilities.rewriteQuery(req.query, settings);
			q.$collection = settings.collection;
			q.$data = settings.$data;
			q.$id = req.params.id;

			o.get(q, function(err, doc) {
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
					if (err == 'Not found') return o.express.sendError(res, 404);
					o.express.sendError(res, 400, err);
				} else { // Act as endpoint and result is ok
					res.send(doc);
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
	* @param {string} [settings.queryRemaps=Object] Object of keys that should be translated from the incoming req.query into their Monoxide equivelents (e.g. `{populate: '$populate'`})
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
	o.express.query = argy('[string] [object]', function MonoxideExpressQuery(model, options) {
		debug('query %s/%s', model, options && options.collection);
		var settings = _.defaults({}, options, {
			shorthandArrays: true,
			queryRemaps: { // Remap incoming values on left to keys on right
				'limit': '$limit',
				'populate': '$populate',
				'select': '$select',
				'skip': '$skip',
				'sort': '$sort',
				'q': '$text',
			},
			queryAllowed: { // Fields and their allowed contents (post remap)
				'$limit': {number: true},
				'$populate': {scalar: true, scalarCSV: true, array: true},
				'$select': {scalar: true, scalarCSV: true, array: true},
				'$skip': {number: true},
				'$sort': {scalar: true},
				'$text': {scalar: true, format: v => ({$search: v})},
			},
			passThrough: false, // If true this module will behave as middleware gluing req.document as the return, if false it will handle the resturn values via `res` itself
			omitFields: [/^_(?!id|_v)/], // Omit all fields prefixed with '_' that are not '_id' or '__v'
		});
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.query(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			var q = o.utilities.rewriteQuery(req.query, settings);
			q.$collection = settings.collection;
			q.$data = settings.$data;

			if (settings.shorthandArrays) {
				q = _.mapValues(q, function(val, key) {
					if (!settings.queryAllowed[key] && !key.startsWith('$') && _.isArray(val)) return val = {$in: val}
					return val;
				});
			}

			o.query(q, function(err, rows) {
				if (!err) { // Apply post operations
					// Apply omitFields {{{
					if (!_.isEmpty(settings.omitFields)) {
						rows.forEach(function(row) {
							row.omit(settings.omitFields);
						});
					}
					// }}}
					// Apply map {{{
					if (_.isFunction(settings.map)) {
						rows = rows.map(settings.map);
					}
					// }}}
				}

				if (settings.passThrough) { // Act as middleware
					req.document = rows;
					next(err, rows);
				} else if (err) { // Act as endpoint and there was an error
					o.express.sendError(res, 400);
				} else { // Act as endpoint and result is ok
					res.send(rows);
				}
			});
		};
	});
	// }}}

	// .express.search(settings) {{{
	/**
	* Return an Express middleware binding for multiple record retrieval operations with fuzzy search
	* Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router
	*
	* @name monoxide.express.query
	*
	* @param {string} [model] The model name to bind to (this can also be specified as settings.collection)
	* @param {Object} [settings] Middleware settings
	* @param {string} [settings.collection] The model name to bind to
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to serve widgets
	* app.get('/api/widgets?q=something', monoxide.express.search('widgets'));
	*/
	o.express.search = argy('[string] [object]', function MonoxideExpressQuery(model, options) {
		debug('search %s/%s', model, options && options.collection);
		var settings = _.defaults({}, options, {
			collection: undefined,
		});
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.query(). Specify as a string or {collection: String}');
		if (!o.models[settings.collection].search) throw new Error('Attempted to search collection "'+settings.collection+'" but no search() method is present on the model');

		return function(req, res, next) {
			o.models[settings.collection].search(req.query.q, {
				filter: _.omit(req.query, ['populate', 'limit', 'q', 'select', 'sort', 'skip']), // Remove search query + meta fields from output
				populate: req.query.populate,
				limit: req.query.limit,
				skip: req.query.skip,
				sort: req.query.sort || '_score',
				select: req.query.select,
				count: req.params.id && req.params.id == 'count',
			})
				.then(docs => res.send(
					req.params.id && req.params.id == 'count' // Count mode? Wrap in a dummy object to match usual ReST output when counting
					? {count: docs}
					: docs
				))
				.catch(e => o.express.sendError(res, 400, e))
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
	o.express.count = argy('[string] [object]', function MonoxideExpressCount(model, options) {
		debug('count %s/%s', model, options && options.collection);
		var settings = _.defaults({}, options, {
			passThrough: false, // If true this module will behave as middleware gluing req.document as the return, if false it will handle the resturn values via `res` itself
			queryRemaps: { // Remap incoming values on left to keys on right
				'q': '$text',
				'sort': '',
				'limit': '',
				'skip': '',
				'select': '',
				'populate': '',
			},
			queryAllowed: { // Fields and their allowed contents (post remap)
				'$text': {scalar: true, format: v => ({$search: v})},
			},
		});
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.count(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			var q = o.utilities.rewriteQuery(req.query, settings);
			q.$collection = settings.collection;
			q.$count = true;
			q.$data = settings.$data;

			o.query(q, function(err, count) {
				if (settings.passThrough) { // Act as middleware
					req.document = count;
					next(err, {count: count});
				} else if (err) { // Act as endpoint and there was an error
					o.express.sendError(res, 400);
				} else { // Act as endpoint and result is ok
					res.send({count: count});
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
	* @param {Boolean} [settings.passThrough=false] Behave as middleware or send a response
	* @param {Array} [settings.publicErrors=["invalid ObjectId","ValidationError"]] List of error strings which will be returned with response
	* @returns {function} callback(req, res, next) Express compatible middleware function
	*
	* @example
	* // Bind an express method to save widgets
	* app.post('/api/widgets/:id', monoxide.express.save('widgets'));
	*/
	o.express.save = argy('[string] [object]', function MonoxideExpressSave(model, options) {
		debug('save %s/%s', model, options && options.collection);
		var settings = _.defaults({}, options, {
			passThrough: false, // If true this module will behave as middleware, if false it will handle the return values via `res` itself
			publicErrors: [
				'invalid ObjectId',
				'ValidationError',
			],
		});
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.save(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			var q = _.clone(req.body);

			q.$collection = settings.collection;
			q.$data = settings.$data;

			if (req.params.id) q.$id = req.params.id;

			o.save(q, function(err, rows) {
				if (settings.passThrough) { // Act as middleware
					next(err, rows);
				} else if (err) { // Act as endpoint and there was an error
					if (settings.publicErrors.some(d => err.toString().includes(d)))
						return o.express.sendError(res, 400, err.toString());
					o.express.sendError(res, 400);
				} else { // Act as endpoint and result is ok
					res.send(rows);
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
	o.express.create = argy('[string] [object]', function MonoxideExpressCreate(model, options) {
		debug('create %s/%s', model, options && options.collection);
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

			o.create(q, function(err, rows) {
				if (settings.passThrough) { // Act as middleware
					next(err, rows);
				} else if (err) { // Act as endpoint and there was an error
					if (err.toString().includes('invalid ObjectId')) return o.express.sendError(res, 400, err.toString());
					o.express.sendError(res, 400);
				} else { // Act as endpoint and result is ok
					res.send(rows);
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
	o.express.delete = argy('[string] [object]', function MonoxideExpressDelete(model, options) {
		debug('delete %s/%s', model, options && options.collection);
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

			o.delete(q, function(err, rows) {
				if (settings.passThrough) { // Act as middleware
					next(err, rows);
				} else if (err) { // Act as endpoint and there was an error
					if (err.toString().includes('invalid ObjectId')) return o.express.sendError(res, 400, err.toString());
					o.express.sendError(res, 400);
				} else { // Act as endpoint and result is ok
					res.send(rows);
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
	o.express.meta = argy('[string] [object]', function MonoxideExpressMeta(model, options) {
		debug('meta %s/%s', model, options && options.collection);
		var settings = _.defaults({}, options, {
			collection: null, // The collection to operate on
			passThrough: false, // If true this module will behave as middleware, if false it will handle the resturn values via `res` itself
			queryRemaps: { // Remap incoming values on left to keys on right
				'collectionEnums': '$collectionEnums',
				'prototype': '$prototype',
			},
			queryAllowed: { // Fields and their allowed contents (post remap)
				'$collectionEnums': {boolean: true},
				'$prototype': {boolean: true},
			},
			customFields: [],
		});
		if (model) settings.collection = model;
		if (!settings.collection) throw new Error('No collection specified for monoxide.express.meta(). Specify as a string or {collection: String}');

		return function(req, res, next) {
			var q = o.utilities.rewriteQuery(req.query, settings);
			q.$collection = settings.collection;
			q.$data = settings.$data;
			q.$indexes = true;
			q.$custom = settings.customFields;

			if (req.params.id) q.$id = req.params.id;

			o.meta(q, function(err, rows) {
				if (settings.passThrough) { // Act as middleware
					next(err, rows);
				} else if (err) { // Act as endpoint and there was an error
					o.express.sendError(res, 400);
				} else { // Act as endpoint and result is ok
					res.send(rows);
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


	finish();
};
