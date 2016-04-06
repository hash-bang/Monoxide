var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.aggregate()', function() {
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
			expect(res).to.be.an.array;
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
			expect(res).to.be.an.array;
			expect(res).to.have.length(2);

			expect(res[0]).to.have.property('name', 'Widget crash');
			expect(res[1]).to.have.property('name', 'Widget whollop');
			finish();
		});
	});
});
