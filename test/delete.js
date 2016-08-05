var expect = require('chai').expect;
var mlog = require('mocha-logger');
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

				mlog.log('deleted ID', widgets[0]._id);

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

				mlog.log('deleted ID', widgets[0]._id);

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
				mlog.log('deleted', count, 'items');
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
				mlog.log('deleted', count, 'items');
				finish();
			});
		});
	});

	it('should delete a multiple items (with empty params)', function() {
		expect(monoxide.models.widgets.remove).to.not.throw;
	});

	it('should refuse to delete all if monoxide.settings.removeAll==false', function(finish) {
		monoxide.settings.removeAll = false;
		monoxide.models.widgets.remove({}, function(err) {
			expect(err).to.be.ok;
			finish();
		});
	});
});
