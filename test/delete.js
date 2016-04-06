var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.delete() / monoxide.models[].remove() / monoxideDocument.remove()', function() {
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

			monoxide.query({
				$collection: 'widgets',
				$id: widgets[0]._id,
			}, function(err, remaining) {
				expect(err).to.be.ok;
				expect(remaining).to.be.not.ok;

				widgets.shift();
				finish();
			});
		});
	});

	it('should delete a single item (via model)', function(finish) {
		widgets[0].remove(function(err, doc) {
			expect(err).to.be.not.ok;

			monoxide.models.widgets.findOne({_id: widgets[0]._id}, function(err, remaining) {
				expect(err).to.be.ok;
				expect(remaining).to.be.not.ok;

				widgets.shift();
				finish();
			});
		});
	});

	it('should delete a multiple items', function(finish) {
		monoxide.delete({
			$collection: 'widgets',
			$multiple: true,
		}, function(err) {
			expect(err).to.be.not.ok;


			monoxide.models.widgets.count(function(err, count) {
				expect(err).to.be.not.ok;
				expect(count).to.be.equal(0);
				finish();
			});
		});
	});

	it('should delete a multiple items (via model)', function(finish) {
		monoxide.models.widgets.remove({}, function(err) {
			expect(err).to.be.not.ok;

			monoxide.models.widgets.count(function(err, count) {
				expect(err).to.be.not.ok;
				expect(count).to.be.equal(0);
				finish();
			});
		});
	});
});
