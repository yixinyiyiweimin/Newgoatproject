import AdminCrudTable from '../../../components/AdminCrudTable'
import { breedingTypeApi } from '../../../utils/api'

function BreedingTypes() {
  return (
    <AdminCrudTable
      title="Breeding Types"
      columns={[
        { key: 'name', label: 'Breeding Type Name' },
      ]}
      formFields={[
        { key: 'name', label: 'Breeding Type Name', type: 'text', required: true, placeholder: 'e.g., Natural Mating' },
      ]}
      api={breedingTypeApi}
      idField="breeding_type_id"
      componentIds={{
        addButton: 'A-BRTYPE-001',
        table: 'A-BRTYPE-002',
        searchBar: 'A-BRTYPE-003',
        editButton: 'A-BRTYPE-003',
        deleteButton: 'A-BRTYPE-004',
        modal: 'A-BRTYPE-005',
        inputs: { name: 'A-BRTYPE-006' },
        saveButton: 'A-BRTYPE-007',
        cancelButton: 'A-BRTYPE-007',
      }}
      pagePath="/admin/breeding-types"
      urId="2.1.4"
      showCreatedAt
    />
  )
}

export default BreedingTypes
