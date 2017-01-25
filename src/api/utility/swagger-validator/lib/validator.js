import jsonschema from 'jsonschema';
import * as expressUtility from './express-utility';

export function validate(request, swaggerDefinition, exceptions) {
	const routeInfo = expressUtility.getRouteInfo(request.url, request.method, swaggerDefinition);

	if (routeInfo.definition) {
		if (routeInfo.definition.parameters) {
			let errors;
			request.swagger = {};

			routeInfo.definition.parameters.forEach(parameter => {
				const value = getValue(request, parameter, routeInfo.pattern);

				if (typeof (value) !== 'undefined') {
					request.swagger[parameter.name] = value;
					const result = validateValue(value, parameter.schema || parameter, swaggerDefinition.definitions);

					if (result.errors.length > 0) {
						errors = errors || [];
						errors.push({
							parameter: parameter.name,
							errors: result.errors
						});
					}

				} else if (parameter.required) {
					errors = errors || [];
					errors.push({
						parameter: parameter.name,
						location: parameter.in,
						notFound: true
					});
				}
			});

			return errors;
		} else {
			return;
		}
	} else if (Array.isArray(exceptions) && exceptions.length > 0) {
		for (let i = 0; i < exceptions.length; i++) {
			if ((new RegExp(exceptions[i])).test(expressUtility.getBaseRoute(request.url))) {
				return;
			}
		}
	}

	return [{
		route: request.url,
		notFound: true
	}];
}

function getValue(request, parameterDefinition, routePattern) {
	const paramName = parameterDefinition.name;

	switch (parameterDefinition.in) {
		case 'path':
			return autoCast(expressUtility.getValueFromPath(request, paramName, routePattern), parameterDefinition);
		case 'query':
			return autoCast(expressUtility.getValueFromQuery(request, paramName), parameterDefinition);
		case 'header':
			return autoCast(expressUtility.getValueFromHeaders(request, paramName), parameterDefinition);
		case 'body':
			return expressUtility.getValueFromBody(request, paramName);
		case 'form':
			return expressUtility.getValueFromBody(request, paramName);
	}
}

export function autoCast(value, parameterDefinition) {
	switch (parameterDefinition.type) {
		case 'array': {
			let values;

			switch (parameterDefinition.collectionFormat) {
				case 'ssv':
					values = value.split(' ');
					break;
				case 'tsv':
					values = value.split('\t');
					break;
				case 'pipes':
					values = value.split('|');
					break;
				case 'csv':
				default:
					values = value.split(',');
					break;
			}

			const result = values.map(v => {
				return autoCast(v, parameterDefinition.items);
			});

			return result;
		}
		case 'boolean': {
			return value.toLowerCase() === 'true' || value.toLowerCase() === 'false' ? value.toLowerCase() === 'true' : value;
		}
		case 'integer': {
			const result = Number(value);
			return Number.isInteger(result) ? result : value;
		}
		case 'number': {
			const result = Number(value);
			return Number.isNaN(result) ? value : result;
		}
		case 'null': {
			return value;
		}
		case 'object': {
			try {
				return JSON.parse(value);
			} catch (ex) {
				return value;
			}
		}
		case 'string': {
			return value;
		}
	}
}

export function validateValue(value, parameterSchema, definitions) {
	const validator = new jsonschema.Validator();

	Object.keys(definitions || {}).forEach(key => {
		validator.addSchema(reroot(definitions[key]), `/definitions/${key}`);
	});

	return validator.validate(value, reroot(parameterSchema));
}

function reroot(schema) {
	return JSON.parse(JSON.stringify(schema).replace(/:"#\//, ':"/'));
}

module.exports = {
	validateValue,
	validate,
	autoCast
};
