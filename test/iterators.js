var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.query.iterator()', function() {
	before('load iterator plugin', done => monoxide.use('iterators', done));
	before(testSetup.init);
	after(testSetup.teardown);

	it('should create a simple user iterator', function() {
		var io = require('../plugins/iterators').iteratorObject;
		expect(monoxide.models.users.find().iterator()).to.be.an.instanceOf(io);
	});

	it('should be able to recurse the iterator in a forEach', function(done) {
		var names = [];

		monoxide.models.users
			.find()
			.iterator()
			.forEach(function(next, item) {
				names.push(item.name);
				next();
			})
			.exec((err, items) => {
				expect(err).to.not.be.ok;
				expect(items).to.be.an('array');
				expect(items).to.have.length(2);
				done();
			})
	});


	it('should be able to recurse the iterator in a forEach and mutate the data (via cursor)', function(done) {
		monoxide.models.users
			.find()
			.iterator()
			.forEach(function(next, doc) {
				doc.name = 'FAKE';
				next();
			})
			.exec((err, items) => {
				expect(err).to.not.be.ok;
				expect(items).to.be.an('array');
				expect(items).to.have.length(2);
				expect(items).to.satisfy(a => a.every(i => expect(i).to.have.property('name', 'FAKE')));
				done();
			})
	});


	it('should be able to recurse the iterator in a forEach and mutate the data (via result data)', function(done) {
		monoxide.models.users
			.find()
			.iterator()
			.filter(next => next(null, true)) // Accept all data - collapses the cursor into a data object
			.forEach(function(next, item) {
				item.name = 'FAKE';
				next();
			})
			.exec((err, items) => {
				expect(err).to.not.be.ok;
				expect(items).to.be.an('array');
				expect(items).to.have.length(2);
				expect(items).to.satisfy(a => a.every(i => expect(i).to.have.property('name')));
				done();
			})
	});


	it('should be able to recurse the iterator via map()', function(done) {
		monoxide.models.users
			.find()
			.iterator()
			.map((next, item) => next(null, {_id: item._id, name: item.name}))
			.exec(function(err, items) {
				expect(err).to.not.be.ok;
				expect(items).to.be.an('array');
				expect(items).to.have.length(2);
				expect(items).to.satisfy(a => a.every(i => i._id && i.name));
				done();
			})
	});


	it('should be able to filter results via filter()', function(done) {
		monoxide.models.users
			.find()
			.iterator()
			.filter((next, item) => next(null, item.name.startsWith('Joe')))
			.exec(function(err, items) {
				expect(err).to.not.be.ok;
				expect(items).to.be.an('array');
				expect(items).to.have.length(1);
				expect(items[0]).to.have.property('name', 'Joe Random');
				done();
			})
	});


	it('should be able to filter() then map()', function(done) {
		monoxide.models.users
			.find()
			.iterator()
			.filter((next, item) => next(null, item.name.startsWith('Joe')))
			.map((next, item) => next(null, {name: item.name}))
			.exec(function(err, items) {
				expect(err).to.not.be.ok;
				expect(items).to.be.an('array');
				expect(items).to.have.length(1);
				expect(items).to.be.deep.equal([{name: 'Joe Random'}]);
				done();
			})
	});


	it('should be able to map(), forEach(), filter() in combination', function(done) {
		var names = [];

		monoxide.models.users
			.find()
			.iterator()
			.filter((next, item) => next(null, item.name.startsWith('Joe')))
			.map((next, item) => next(null, ({name: item.name})))
			.forEach((next, item) => {
				names.push(item);
				next();
			})
			.exec(function(err, items) {
				expect(err).to.not.be.ok;
				expect(items).to.be.an('array');
				expect(items).to.have.length(1);
				expect(items[0]).to.have.property('name', 'Joe Random');
				expect(names).to.be.deep.equal([{name: 'Joe Random'}]);
				done();
			})
	});


	it('should support lazy initialization - omitting the .iterator() call', ()=> {
		var io = require('../plugins/iterators').iteratorObject;
		expect(monoxide.models.users.find().filter()).to.be.an.instanceOf(io);
		expect(monoxide.models.users.find().forEach()).to.be.an.instanceOf(io);
		expect(monoxide.models.users.find().map()).to.be.an.instanceOf(io);
	});


	it('should be able to map() without the .iterator() call', function(done) {
		var names = [];

		monoxide.models.users
			.find()
			.map((next, item) => next(null, ({name: item.name})))
			.exec(function(err, items) {
				expect(err).to.not.be.ok;
				expect(items).to.be.an('array');
				expect(items).to.have.length(2);
				done();
			})
	});
});
