'use strict';

const assert = require('chai').assert;
const expect = require('chai').expect;

const sut = require('../lib/express-utility');

describe('express-utility', function () {
	describe('doesRouteMatch(pattern, route)', function () {
		describe('pattern without route parameters', function () {
			it('matches route', function () {
				// Arrange
				const pattern = '/asdf/asdf';
				const route = '/asdf/asdf';
				const expected = true;

				// Act
				const result = sut.doesRouteMatch(pattern, route);

				// Assert
				assert.equal(expected, result);
			});

			it('does not match route', function () {
				// Arrange
				const pattern = '/asdf/asdf';
				const route = '/querty/asdf';
				const expected = false;

				// Act
				const result = sut.doesRouteMatch(pattern, route);

				// Assert
				assert.equal(expected, result);
			});
		});

		describe('pattern with single route parameter', function () {
			const pattern = '/asdf/{param}';

			it('matches route', function () {
				// Arrange
				const route = '/asdf/asdf';
				const expected = true;

				// Act
				const result = sut.doesRouteMatch(pattern, route);

				// Assert
				assert.equal(expected, result);
			});

			it('does not match route', function () {
				// Arrange
				const route = '/qwerty/asdf';
				const expected = false;

				// Act
				const result = sut.doesRouteMatch(pattern, route);

				// Assert
				assert.equal(expected, result);
			});

			it('has fewer segments than route', function () {
				// Arrange
				const route = '/asdf/value/extra';
				const expected = false;

				// Act
				const result = sut.doesRouteMatch(pattern, route);

				// Assert
				assert.equal(expected, result);
			});

			it('has more segments than route', function () {
				// Arrange
				const pattern = '/asdf/{id}';
				const route = '/asdf';
				const expected = false;

				// Act
				const result = sut.doesRouteMatch(pattern, route);

				// Assert
				assert.equal(expected, result);
			});
		});

		describe('pattern with multiple route parameters', function () {
			const pattern = '/asdf/{param1}/qwerty/{param2}';

			it('matches route', function () {
				// Arrange
				const route = '/asdf/value1/qwerty/value2';
				const expected = true;

				// Act
				const result = sut.doesRouteMatch(pattern, route);

				// Assert
				assert.equal(expected, result);
			});

			it('does not match route', function () {
				// Arrange
				const route = '/qwerty/value1/qwerty/value2';
				const expected = false;

				// Act
				const result = sut.doesRouteMatch(pattern, route);

				// Assert
				assert.equal(expected, result);
			});

			it('has fewer segments than route', function () {
				// Arrange
				const route = '/asdf/value1/qwerty/value2/extra';
				const expected = false;

				// Act
				const result = sut.doesRouteMatch(pattern, route);

				// Assert
				assert.equal(expected, result);
			});

			it('has more segments than route', function () {
				// Arrange
				const route = '/asdf/value1/qwerty';
				const expected = false;

				// Act
				const result = sut.doesRouteMatch(pattern, route);

				// Assert
				assert.equal(expected, result);
			});
		});
	});

	describe('getBaseRoute(url)', function () {
		it('returns whole url when query is not present', function () {
			// Arrange
			const url = '/asdf/qwerty';
			const expected = '/asdf/qwerty';

			// Act
			const result = sut.getBaseRoute(url);

			// Assert
			assert.equal(expected, result);
		});

		it('Does not return trailing slash when query is not present', function () {
			// Arrange
			const url = '/asdf/qwerty/';
			const expected = '/asdf/qwerty';

			// Act
			const result = sut.getBaseRoute(url);

			// Assert
			assert.equal(expected, result);
		});

		it('returns everything prior to query', function () {
			// Arrange
			const url = '/asdf/qwerty?param=value';
			const expected = '/asdf/qwerty';

			// Act
			const result = sut.getBaseRoute(url);

			// Assert
			assert.equal(expected, result);

		});

		it('returns everything but trailing slash prior to query', function () {
			// Arrange
			const url = '/asdf/qwerty/?param=value';
			const expected = '/asdf/qwerty';

			// Act
			const result = sut.getBaseRoute(url);

			// Assert
			assert.equal(expected, result);

		});
	});

	describe('getRouteParams(pattern, route)', function () {
		it('has no route parameters', function () {
			// Arrange
			const pattern = '/asdf/asdf';
			const route = '/asdf/asdf';
			const expected = {};

			// Act
			const result = sut.getRouteParams(pattern, route);

			// Assert
			expect(result).to.deep.equal(expected);
		});

		it('has a single route parameter', function () {
			// Arrange
			const pattern = '/asdf/{param}';
			const route = '/asdf/value';
			const expected = { param: 'value' };

			// Act
			const result = sut.getRouteParams(pattern, route);

			// Assert
			expect(result).to.deep.equal(expected);
		});

		it('has multiple route parameters', function () {
			// Arrange
			const pattern = '/asdf/{param1}/qwerty/{param2}';
			const route = '/asdf/value1/qwerty/value2';
			const expected = { param1: 'value1', param2: 'value2' };

			// Act
			const result = sut.getRouteParams(pattern, route);

			// Assert
			expect(result).to.deep.equal(expected);
		});
	});

	describe('getValueFromPath(request, paramName, routePattern)', function () {
		it('gets value', function () {
			// Arrange
			const request = {
				url: '/asdf/value1/qwerty/value2?query=notnull'
			};
			const paramName = 'param1';
			const routePattern = '/asdf/{param1}/qwerty/{param2}';
			const expected = 'value1';

			// Act
			const result = sut.getValueFromPath(request, paramName, routePattern);

			// Assert
			assert.equal(expected, result);
		});

		it('does not find missing value', function () {
			// Arrange
			const request = {
				url: '/asdf/value1/qwerty/value2?query=notnull'
			};
			const paramName = 'notAValidParamName';
			const routePattern = '/asdf/{param1}/qwerty/{param2}';

			// Act
			const result = sut.getValueFromPath(request, paramName, routePattern);

			// Assert
			assert.notOk(result);
		});
	});

	describe('getValueFromQuery(request, paramName)', function () {
		it('does not have a query string', function () {
			// Arrange
			const request = {};
			const paramName = 'anything';

			// Act
			const result = sut.getValueFromQuery(request, paramName);

			// Assert
			assert.notOk(result);
		});

		it('gets value', function () {
			// Arrange
			const request = {
				query: {
					param1: 'value1',
					param2: 'value2'
				}
			};
			const paramName = 'param1';
			const expected = 'value1';

			// Act
			const result = sut.getValueFromQuery(request, paramName);

			// Assert
			assert.equal(expected, result);
		});

		it('does not find missing value', function () {
			// Arrange
			const request = {
				query: {
					param1: 'value1',
					param2: 'value2'
				}
			};
			const paramName = 'notAValidParamName';

			// Act
			const result = sut.getValueFromQuery(request, paramName);

			// Assert
			assert.notOk(result);
		});
	});

	describe('getValueFromBody(request, paramName)', function () {
		it('does not have a body', function () {
			// Arrange
			const request = {};
			const paramName = 'anything';

			// Act
			const result = sut.getValueFromBody(request, paramName);

			// Assert
			assert.notOk(result);
		});

		it('gets value', function () {
			// Arrange
			const request = {
				body: {
					param1: 'value1',
					param2: 'value2'
				}
			};
			const paramName = 'param1';
			const expected = 'value1';

			// Act
			const result = sut.getValueFromBody(request, paramName);

			// Assert
			assert.equal(expected, result);
		});

		it('does not find missing value', function () {
			// Arrange
			const request = {
				body: {
					param1: 'value1',
					param2: 'value2'
				}
			};
			const paramName = 'notAValidParamName';

			// Act
			const result = sut.getValueFromBody(request, paramName);

			// Assert
			assert.notOk(result);
		});
	});

	describe('getRouteInfo(url, method, swaggerDefinition)', function () {
		it('finds route info', function () {
			// Arrange
			const url = '/asdf/value1';
			const method = 'get';

			const expectedPattern = '/asdf/{param1}';
			const expectedDefinition = {
				someprop: 'value',
				otherprop: 'other value'
			};

			const swaggerDefinition = {
				paths: {
					[expectedPattern]: {
						[method]: expectedDefinition
					}
				}
			};

			// Act
			const result = sut.getRouteInfo(url, method, swaggerDefinition);

			// Assert
			assert.ok(result);
			assert.equal(expectedPattern, result.pattern);
			assert.equal(expectedDefinition, result.definition);
		});
	});
});
