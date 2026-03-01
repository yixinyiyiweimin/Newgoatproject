const { createRefDataService } = require('./referenceData.service');

module.exports = createRefDataService({
  tableName: 'admin_ref.breeding_type',
  idColumn: 'breeding_type_id',
  entityName: 'breeding_type',
  columns: ['name'],
  inUseQuery: 'SELECT 1 FROM farm.breeding_program WHERE breeding_type_id = $1 LIMIT 1',
  inUseMessage: 'Cannot delete: breeding type is used in breeding programs',
});
