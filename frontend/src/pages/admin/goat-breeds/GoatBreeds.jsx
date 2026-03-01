import AdminCrudTable from '../../../components/AdminCrudTable'
import { goatBreedApi } from '../../../utils/api'

function GoatBreeds() {
  return (
    <AdminCrudTable
      title="Goat Breeds"
      columns={[
        { key: 'name', label: 'Breed Name' },
      ]}
      formFields={[
        { key: 'name', label: 'Breed Name', type: 'text', required: true, placeholder: 'e.g., Boer' },
      ]}
      api={goatBreedApi}
      idField="breed_id"
      componentIds={{
        addButton: 'A-GBREED-001',
        table: 'A-GBREED-002',
        searchBar: 'A-GBREED-003',
        editButton: 'A-GBREED-003',
        deleteButton: 'A-GBREED-004',
        modal: 'A-GBREED-005',
        inputs: { name: 'A-GBREED-006' },
        saveButton: 'A-GBREED-007',
        cancelButton: 'A-GBREED-007',
      }}
      pagePath="/admin/goat-breeds"
      urId="2.1.5"
      showCreatedAt
    />
  )
}

export default GoatBreeds
