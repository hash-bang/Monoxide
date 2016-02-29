var _ = require('lodash');
var argx = require('argx');
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

function MongoloidQuery(q, options, finish) {
	var args = argx(arguments);
	finish = args.pop('function') || function noop() {};
	q = args.pop('object') || {};
	options = args.shift('object') || {};

	var settings = _.defaults(options || {}, {
		cacheFKs: true, // Whether to cache model Foreign Keys (used for populates) or compute them every time
	});

	async()
		.set('metaFields', ['collection', 'sort', 'populate'])
		// Sanity checks {{{
		.then(function(next) {
			if (!q) return next('No query given');
			if (!finish) return next('No callback given');
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
			if (!q.collection) return next('Collection not specified');
			if (!_.has(this.connection, 'base.models.' + q.collection)) return next('Invalid collection');
			next(null, this.connection.base.models[q.collection].schema);
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
			var fields = _(q)
				.omit(this.metaFields) // Remove all meta fields
				// FIXME: Ensure all fields are flat
				.omitBy(function(val, key) { // Remove all fields that will need populating later
					if (_.some(self.modelFKs, function(FK) {
						return _.startsWith(key, fk);
					})) {
						self.filterPostPopulate[key] = val;
						return true;
					} else {
						return false;
					}
				})
				.value();
			next(null, this.connection.base.models[q.collection].find(fields));
		})
		// }}}
		// Apply sorting {{{
		.then(function(next) {
			if (q.sort) this.query.sort(q.sort);
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
			if (err) return finish(err);
			finish(null, this.result);
		});
		// }}}
}

function Mongoloid() {
	this.query = MongoloidQuery;
	return this;
}

util.inherits(Mongoloid, events.EventEmitter);

module.exports = Mongoloid();
