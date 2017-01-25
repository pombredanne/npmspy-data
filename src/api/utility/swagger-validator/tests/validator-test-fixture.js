'use strict';

const assert = require('chai').assert;
const expect = require('chai').expect;

const sut = require('../lib/validator');

describe('validator', function () {
	describe('validateValue', function () {
		it('handles invalid parameter without dependencies', function () {
			// Arrange
			const value = ['asdf', 'qwerty', 5];
			const expectedErrorCount = 1;

			const parameter = {
				schema: {
					'type': 'array',
					'items': {
						'type': ['string']
					}
				}
			};
			const definitions = null;

			// Act
			const result = sut.validateValue(value, parameter.schema, definitions);

			// Assert
			assert.lengthOf(result.errors, expectedErrorCount);
		});

		it('handles invalid parameter with single-level dependency', function () {
			// Arrange
			const value = ['asdf', 'qwerty', 5];
			const expectedErrorCount = 1;

			const parameter = {
				schema: {
					'$ref': '#/definitions/someObject'
				}
			};
			const definitions = {
				someObject: {
					'type': 'array',
					'items': {
						'type': ['string']
					}
				}
			};

			// Act
			const result = sut.validateValue(value, parameter.schema, definitions);

			// Assert
			assert.lengthOf(result.errors, expectedErrorCount);
		});

		it('handles invalid parameter with multi-level dependency', function () {
			// Arrange
			const value = { prop: ['asdf', 'qwerty', 5] };
			const expectedErrorCount = 1;

			const parameter = {
				schema: {
					'$ref': '#/definitions/parentObject'
				}
			};
			const definitions = {
				parentObject: {
					'type': 'object',
					'properties': {
						'prop': { '$ref': '#/definitions/childObject' }
					}
				},
				childObject: {
					'type': 'array',
					'items': {
						'type': ['string']
					}
				}
			};

			// Act
			const result = sut.validateValue(value, parameter.schema, definitions);

			// Assert
			assert.lengthOf(result.errors, expectedErrorCount);
		});
	});

	describe('cast', function () {
		describe('array', function () {

			it('casts valid pipes array', function () {
				// Arrange
				const value = '1|2|3|4|5';
				const parameterDefinition = {
					type: 'array',
					items: {
						type: 'integer'
					},
					collectionFormat: 'pipes'
				};
				const expectedValue = [1, 2, 3, 4, 5];

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				expect(result).to.include.members(expectedValue);
			});

			it('casts valid csv array', function () {
				// Arrange
				const value = '1,2,3,4,5';
				const parameterDefinition = {
					type: 'array',
					items: {
						type: 'integer'
					},
					collectionFormat: 'csv'
				};
				const expectedValue = [1, 2, 3, 4, 5];

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				expect(result).to.include.members(expectedValue);
			});

			it('casts valid ssv array', function () {
				// Arrange
				const value = '1 2 3 4 5';
				const parameterDefinition = {
					type: 'array',
					items: {
						type: 'integer'
					},
					collectionFormat: 'ssv'
				};
				const expectedValue = [1, 2, 3, 4, 5];

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				expect(result).to.include.members(expectedValue);
			});

			it('casts valid tsv array', function () {
				// Arrange
				const value = '1\t2\t3\t4\t5';
				const parameterDefinition = {
					type: 'array',
					items: {
						type: 'integer'
					},
					collectionFormat: 'tsv'
				};
				const expectedValue = [1, 2, 3, 4, 5];

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				expect(result).to.include.members(expectedValue);
			});

			it('casts valid unspecified array', function () {
				// Arrange
				const value = '1,2,3,4,5';
				const parameterDefinition = {
					type: 'array',
					items: {
						type: 'integer'
					}
				};
				const expectedValue = [1, 2, 3, 4, 5];

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				expect(result).to.include.members(expectedValue);
			});
		});
		describe('boolean', function () {
			const parameterDefinition = { type: 'boolean' };

			it('casts "true"', function () {
				// Arrange
				const value = 'true';
				const expectedValue = true;

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				assert.strictEqual(expectedValue, result);
			});

			it('casts "false"', function () {
				// Arrange
				const value = 'false';
				const expectedValue = false;

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				assert.strictEqual(expectedValue, result);
			});

			it('does not cast string', function () {
				// Arrange
				const value = 'asdf';
				const expectedValue = 'asdf';

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				assert.strictEqual(expectedValue, result);
			});
		});

		describe('integer', function () {
			const parameterDefinition = { type: 'integer' };

			it('casts a valid value', function () {
				// Arrange
				const value = '5';
				const expectedValue = 5;

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				assert.strictEqual(expectedValue, result);
			});

			it('does not cast float', function () {
				// Arrange
				const value = '5.5';
				const expectedValue = '5.5';

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				assert.strictEqual(expectedValue, result);
			});

			it('does not cast string', function () {
				// Arrange
				const value = 'asdf';
				const expectedValue = 'asdf';

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				assert.strictEqual(expectedValue, result);
			});
		});

		describe('number', function () {
			const parameterDefinition = { type: 'number' };

			it('casts a valid value', function () {
				// Arrange
				const value = '5.5';
				const expectedValue = 5.5;

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				assert.strictEqual(expectedValue, result);
			});

			it('does not cast string', function () {
				// Arrange
				const value = 'asdf';
				const expectedValue = 'asdf';

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				assert.strictEqual(expectedValue, result);
			});
		});

		describe('object', function () {
			const parameterDefinition = { type: 'object' };

			it('casts a valid value', function () {
				// Arrange
				const value = '{"key":"value"}';
				const expectedValue = { key: 'value' };

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				expect(result).deep.equal(expectedValue);
			});

			it('does not cast string', function () {
				// Arrange
				const value = 'asdf';
				const expectedValue = 'asdf';

				// Act
				const result = sut.autoCast(value, parameterDefinition);

				// Assert
				assert.strictEqual(expectedValue, result);
			});
		});
	});
});
