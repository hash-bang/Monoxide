var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.aggregate()', function() {
	before('load iterator plugin', done => monoxide.use('iterators', done));
	before(testSetup.init);
	after(testSetup.teardown);

	it('should support a simple aggregation', function(finish) {
		monoxide.aggregate({
			$collection: 'widgets',
			$stages: [
				{$project: {_id: true, name: true}},
			],
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an('array');
			expect(res).to.have.length(3);
			finish();
		});
	});

	it('should support a more complex aggregation', function(finish) {
		monoxide.aggregate({
			$collection: 'widgets',
			$stages: [
				{$project: {_id: true, name: true, color: true}},
				{$match: {color: 'blue'}},
				{$sort: {name: 1}},
			],
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an('array');
			expect(res).to.have.length(2);

			expect(res[0]).to.have.property('name', 'Widget crash');
			expect(res[1]).to.have.property('name', 'Widget whollop');
			finish();
		});
	});

	it('should support an aggregation as a cursor', function(finish) {
		var data = [];

		monoxide.aggregate({
			$collection: 'widgets',
			$want: 'cursor',
			$stages: [
				{$project: {_id: true, name: true, color: true}},
				{$match: {color: 'blue'}},
				{$sort: {name: 1}},
			],
		}, function(err, cursor) {
			expect(err).to.be.not.ok;
			cursor
				.map(function(next, item) {
					item.fake = 'FAKE';
					next(null, item);
				})
				.forEach(function(next, item) {
					data.push(item);
					next();
				})
				.exec(function(err) {
					expect(err).to.be.not.ok;
					expect(data).to.be.an('array');
					expect(data).to.have.length(2);

					expect(data[0]).to.have.property('name', 'Widget crash');
					expect(data[0]).to.have.property('fake', 'FAKE');
					expect(data[1]).to.have.property('name', 'Widget whollop');
					expect(data[1]).to.have.property('fake', 'FAKE');
					finish();
				})
		});
	});
});
