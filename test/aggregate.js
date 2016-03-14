var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Monoxide + Aggregation pipeline', function() {
	before(testSetup.init);

	it('should support a simple aggregation', function(finish) {
		monoxide.aggregate({
			$collection: 'widgets',
			$project: {_id: true, title: true},
		}, function(err, res) {
			console.log('GOT BACK', err, res);
			expect(err).to.be.not.ok;
			expect(res).to.be.an.array;
			expect(res).to.have.length(3);
			finish();
		});
	});
});
