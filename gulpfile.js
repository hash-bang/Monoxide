var gulp = require('gulp');
var documentation = require('gulp-documentation');

gulp.task('docs', function() {
	return gulp.src('./index.js')
		.pipe(documentation({format: 'md'}))
		.pipe(gulp.dest('docs'));
});
