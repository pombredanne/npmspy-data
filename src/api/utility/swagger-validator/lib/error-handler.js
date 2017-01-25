import uuid from 'uuid';

export default function errorHandler(err, req, res, next) {
	if (res.headersSent) {
		next(err);
	} else {
		if (Array.isArray(err)) {
			let errors = [];
			let code = 200;

			err.forEach(error => {
				if (error.route && error.notFound) {

					const e = {
						id: uuid.v4(),
						code: 'ROUTE_NOT_FOUND',
						status: '404',
						title: 'Route not found',
						details: `Route '${req.method} ${error.route}' could not be found.  Refer to docs for a complete list of routes.`
					};

					errors.push(e);
					code = Math.max(404, code);
				} else if (error.parameter && error.notFound) {

					const e = {
						id: uuid.v4(),
						code: 'MISSING_PARAMETER',
						status: '400',
						title: 'Missing required parameter',
						details: `Required parameter '${error.parameter}' could not be found in ${error.location}.`,
						source: {
							parameter: error.parameter
						}
					};

					errors.push(e);
					code = Math.max(400, code);
				} else if (error.parameter && Array.isArray(error.errors)) {
					error.errors.forEach(validationError => {
						const instanceName = validationError.property.replace('instance', error.parameter);
						const instanceType = instanceName === error.parameter ? 'Parameter' : 'Property';
						const instanceValueDisplay = typeof (validationError.instance) === 'undefined' ? ' ' : ` (${validationError.instance}) `;

						const e = {
							id: uuid.v4(),
							code: 'BAD_REQUEST',
							status: '400',
							title: 'Request value is invalid',
							details: `${instanceType} '${instanceName}'${instanceValueDisplay}${validationError.message}.`,
							source: {
								// TODO: return valid JSON Path for body parameters
								// SEE: http://jsonapi.org/format/#errors
								parameter: error.parameter
							}
						};

						errors.push(e);
					});
					code = Math.max(400, code);
				}
			});
			res.status(code).send({ errors });
		} else {
			next(err);
		}
	}
}
