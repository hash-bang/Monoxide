var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Monoxide - utility.diff', function() {
	before(testSetup.init);
	after(testSetup.teardown);
	
	it('should detect the difference between two objects', function() {
		var patch = monoxide.utilities.diff({
			_id: 'abcdef',
			name: 'Foo',
			age: 15,
			widgets: [1,2,3],
			dooDads: ['a', 'b', 'c'],
			fooBars: {
				bazzes: {
					quz: 123,
				},
			},
		}, {
			_id: 'abcdef',
			name: 'Bar',
			age: 15,
			widgets: [4],
			fooBars: {
				bazzes: {
					quz: 777,
					quz2: 567,
				},
			},
		});

		expect(patch).to.not.have.property('_id');
		expect(patch).to.have.property('name', 'Bar');
		expect(patch).to.not.have.property('age');
		expect(patch).to.have.property('widgets');
		expect(patch.widgets).to.be.an.array;
		expect(patch.widgets).to.have.length(1);
		expect(patch.widgets[0]).to.be.equal(4);
		expect(patch).to.have.property('dooDads', undefined);
		expect(patch).to.have.property('fooBars');
		expect(patch.fooBars).to.have.property('bazzes');
		expect(patch.fooBars.bazzes).to.have.property('quz', 777);
		expect(patch.fooBars.bazzes).to.have.property('quz2', 567);
	});


	it('should diff existing user documents', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, users) {
			expect(err).to.be.not.ok;
			expect(users).to.be.an.array;
			expect(users).to.have.length(2);

			var originalUser = _.clone(users[0]);
			var newUser = users[0];

			newUser.role = 'admin';

			var patch = monoxide.utilities.diff(originalUser, newUser);

			expect(patch).to.not.have.property('_id');
			expect(patch).to.have.property('role', 'admin');
			expect(_(patch).keys().sort().value()).to.deep.equal(['role']);

			finish();
		});
	});
});
