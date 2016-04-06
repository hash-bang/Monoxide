var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.update()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('should delete all widgets', function(finish) {
		monoxide.update('widgets', {
			status: 'deleted',
		}, function(err) {

			monoxide.query('widgets', function(err, widgets) {
				expect(err).to.be.not.ok;
				expect(widgets).to.have.length(3);

				expect(widgets).to.be.an.array;
				widgets.forEach(function(u) {
					expect(u).to.have.property('status', 'deleted');
				});

				finish();
			});
		});
	});
});
