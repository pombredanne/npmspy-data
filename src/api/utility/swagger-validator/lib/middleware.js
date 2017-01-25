import validator from './validator';

export default function (options) {
	options = options || {};

	return function (req, res, next) {
		var x = validator.validate(req, options.swaggerDefinition, options.exceptions);

		if (x) {
			next(x);
		} else {
			next();
		}
	};
}
