var _ = require('lodash');
var async = require('async-chainable');


/**
* Create an iterator object
* Either query, cursor or data must be specified for the iterator to work
*
* The iterator objects works by making an operations queue then when we hit .exec() running all items in the queue in an async series.
*
* @param {Object} options Options object used when creating the iterator
* @param {monoxide.queryBuilder} [options.query] The Monoxide queryBuilder object to generate a query from
* @param {Mongoose.QueryCursor} [options.cursor] Cursor object when pulling data
* @param {array} [options.data] Data object to iterate with
* @param {string} [options.method=='cursor'] Method to iterate with
*/
var iteratorObject = function(options) {
	this.settings = _.defaults(options, {
		query: undefined,
		cursor: undefined,
		method: 'cursor',
		data: undefined,
		operations: [],
	});

	this.$operations = {};

	// cursor() - fetch the curor and wait for it to load {{{
	this.cursor = ()=> {
		this.settings.method = 'cursor';
		this.settings.operations.push({func: this.$operations.cursor});
		return this;
	};

	this.$operations.cursor = done => {
		this.settings.query.cursor((err, cursor) => {
			if (err) return done(err);
			this.settings.cursor = cursor;
			done();
		});
	};
	// }}}

	// map() - iterate and replace each data item {{{
	this.map = (cb) => {
		this.settings.operations.push({func: this.$operations.map, args: [cb]});
		return this;
	};

	this.$operations.map = (done, cb) => {
		switch (this.settings.method) {
			case 'cursor': // Page the cursor running the callback until the cursor is exhausted
				this.settings.data = [];
				var runner = ()=> {
					this.settings.cursor.next((err, doc) => {
						if (err) {
							cb(err);
						} else if (doc) { // Found an item - run the callback over it
							cb.call(doc, (err, res) => {
								if (err) return done(err);
								this.settings.data.push(res); // Push the mapped record into the data array
								runner(); // Go fetch the next record
							}, doc);
						} else { // Exhausted all documents
							this.settings.method = 'data';
							done();
						}
					});
				};

				runner();
				break;
			case 'data': // Run async.map over every item in the data array and overwrite the previous array
				async()
					.set('iter', this)
					.set('data', this.settings.data)
					.map('data', 'data', cb)
					.end(function(err) {
						if (err) return done(err);
						this.iter.settings.data = this.data;
						done();
					});
				break;
			default:
				throw new Error('Unsupported map iteration method');
		};
	};
	// }}}

	// forEach() - iterate over all data passing a reference to the original data {{{
	this.forEach = (cb) => {
		this.settings.operations.push({func: this.$operations.forEach, args: [cb]});
		return this;
	};

	this.$operations.forEach = (done, cb) => {
		switch (this.settings.method) {
			case 'cursor': // Page the cursor running the callback until the cursor is exhausted
				this.settings.data = [];
				var runner = ()=> {
					this.settings.cursor.next((err, doc) => {
						if (err) {
							cb(err);
						} else if (doc) { // Found an item - run the callback over it
							cb.call(doc, err => {
								if (err) return done(err);
								this.settings.data.push(doc); // Push the mapped record into the data array
								runner(); // Go fetch the next record
							}, doc);
						} else { // Exhausted all documents
							this.settings.method = 'data';
							done();
						}
					});
				};

				runner();
				break;
			case 'data': // Run async.map over every item in the data array and overwrite the previous array
				async()
					.set('data', this.settings.data)
					.forEach('data', cb)
					.end((err) => {
						if (err) return done(err);
						done();
					});
				break;
			default:
				throw new Error('Unsupported map iteration method');
		};
	};
	// }}}

	// filter() - iterate and optionally filter each item based on a callback response {{{
	this.filter = (cb) => {
		this.settings.operations.push({func: this.$operations.filter, args: [cb]});
		return this;
	};

	this.$operations.filter = (done, cb) => {
		switch (this.settings.method) {
			case 'cursor': // Page the cursor running the callback until the cursor is exhausted
				this.settings.data = [];
				var runner = ()=> {
					this.settings.cursor.next((err, doc) => {
						if (err) {
							cb(err);
						} else if (doc) { // Found an item - run the callback over it
							cb.call(doc, (err, res) => {
								if (err) {
									return done(err);
								} else if (res) { // Keep the record?
									this.settings.data.push(doc); // Push the mapped record into the data array
								}
								runner(); // Go fetch the next record
							}, doc);
						} else { // Exhausted all documents
							this.settings.method = 'data';
							done();
						}
					});
				};

				runner();
				break;
			case 'data': // Run async.map over every item in the data array and overwrite the previous array
				async()
					.set('iter', this)
					.set('data', this.settings.data)
					.forEach('data', function(next, doc) {
						cb.call(doc, (err, res) => {
							if (err) {
								next(err);
							} else if (!res) {
								doc = undefined;
							}
						}, doc);
					})
					.end(function(err) {
						if (err) return done(err);
						this.iter.settings.data = this.data.filter(doc => doc !== undefined);
						done();
					});
				break;
			default:
				throw new Error('Unsupported map iteration method');
		};
	};
	// }}}

	// Exec - actual operation runner {{{
	this.exec = (cb) => {
		var nextOperation = ()=> {
			var op = this.settings.operations.shift();
			if (!op) { // No more operations to execute - return with data
				cb.call(this, null, this.settings.data);
			} else {
				op.func.apply(this, [nextOperation].concat(op.args));
			}
		};
		nextOperation();
	};
	// }}}

	// Object init + error checking {{{
	if (!this.settings.query && !this.settings.cursor && !this.settings.data) throw new Error('Unable to create iterator object without either query, cursor or data specified in options');
	if (!this.settings.cursor && !this.settings.data) { // Dont have a cursor or data - queue a cursor fetch operation
		this.cursor();
	}
	// }}}

	return this;
};


module.exports = function(finish, monoxide) {

	monoxide.hook('queryBuilder', qb => {
		qb.iterator = ()=> {
			return new iteratorObject({query: qb});
		};

		qb.filter = (...args)=> qb
			.iterator()
			.filter(...args);

		qb.map = (...args)=> qb
			.iterator()
			.map(...args);

		qb.forEach = (...args)=> qb
			.iterator()
			.forEach(...args);
	});

	finish();

};

module.exports.iteratorObject = iteratorObject;
