var gulp = require('gulp');
var documentation = require('gulp-documentation');

gulp.task('default', ['build']);
gulp.task('build', ['docs']);

gulp.task('docs', ['docs:markdown', 'docs:html']);

gulp.task('docs:markdown', function() {
	return gulp.src('./index.js')
		.pipe(documentation({format: 'md'}))
		.pipe(gulp.dest('.'));
});

gulp.task('docs:html', function() {
	return gulp.src('./index.js')
		.pipe(documentation({format: 'html'}))
		.pipe(gulp.dest('docs'));
});
