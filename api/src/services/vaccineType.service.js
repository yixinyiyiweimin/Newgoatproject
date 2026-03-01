const { createRefDataService } = require('./referenceData.service');

module.exports = createRefDataService({
  tableName: 'admin_ref.vaccine_type',
  idColumn: 'vaccine_type_id',
  entityName: 'vaccine_type',
  columns: ['name', 'interval_days'],
  inUseQuery: 'SELECT 1 FROM farm.vaccination WHERE vaccine_type_id = $1 LIMIT 1',
  inUseMessage: 'Cannot delete: vaccine type is used in vaccination records',
});
