var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide indexes', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	var userIndexes;
	before('get user indexes', function(finish) {
		monoxide.models.users.getIndexes(function(err, res) {
			if (err) return finish(err);
			userIndexes = res;
			finish();
		});
	});

	it('should retrieve the indexes of a Mongo model', function(finish) {
		monoxide.models.users.getIndexes(function(err, res) {
			if (err) return finish(err);
			expect(res).to.be.an.instanceOf(Array);
			expect(res).to.have.length(1);
			expect(res[0]).to.have.property('name', '_id_');
			expect(res[0]).to.have.property('ns');
			expect(res[0].ns).to.match(/\.users$/);
			finish();
		});
	});

	it('should retrieve the ideal indexes of a declared schema', function(finish) {
		monoxide.models.users.getSchemaIndexes(function(err, res) {
			if (err) return finish(err);
			expect(res).to.be.an.instanceOf(Array);
			expect(res).to.have.length(1);
			expect(res[0]).to.have.property('name', '_id_');
			finish();
		});
	});

	it('should check the status of indexes when given an omitted index', function(finish) {
		monoxide.models.users.checkIndexes([ // Glue a fake index to the list we are checking against
			{key: {role: 1}, name: 'role', ns: userIndexes[0].ns.replace('_id', 'role')},
			...userIndexes
		], function(err, res) {
			if (err) return finish(err);
			res = _.sortBy(res, 'name');

			expect(res[0]).to.have.property('name', '_id_');
			expect(res[0]).to.have.property('status', 'ok');

			expect(res[1]).to.have.property('name', 'role');
			expect(res[1]).to.have.property('status', 'missing');

			finish();
		});
	});
});
