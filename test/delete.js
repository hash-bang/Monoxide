var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Monoxide - delete', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	var widgets;
	it('should get a list of existing widgets', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.array;
			expect(res).to.have.length(3);
			widgets = res;
			finish();
		});
	});

	it('should delete a single item', function(finish) {
		monoxide.delete({
			$collection: 'widgets',
			$id: widgets[0]._id,
		}, function(err) {
			expect(err).to.be.not.ok;
			widgets.shift();
			finish();
		});
	});

	it('should delete a single item (via model)', function(finish) {
		widgets[0].remove(function(err, doc) {
			expect(err).to.be.not.ok;
			widgets.shift();
			finish();
		});
	});

	it('should delete a multiple items', function(finish) {
		monoxide.delete({
			$collection: 'widgets',
			$multiple: true,
		}, function(err) {
			expect(err).to.be.not.ok;
			finish();
		});
	});

	it('should delete a multiple items (via model)', function(finish) {
		monoxide.models.widgets.remove({}, function(err) {
			expect(err).to.be.not.ok;
			finish();
		});
	});
});
