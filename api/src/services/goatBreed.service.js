const { createRefDataService } = require('./referenceData.service');

module.exports = createRefDataService({
  tableName: 'admin_ref.breed_type',
  idColumn: 'breed_id',
  entityName: 'goat_breed',
  columns: ['name'],
  inUseQuery: 'SELECT 1 FROM farm.goat WHERE goat_breed_id = $1 LIMIT 1',
  inUseMessage: 'Cannot delete: breed is assigned to goats',
});
