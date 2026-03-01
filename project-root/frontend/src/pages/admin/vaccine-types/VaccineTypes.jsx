import AdminCrudTable from '../../../components/AdminCrudTable'
import { vaccineTypeApi } from '../../../utils/api'

function VaccineTypes() {
  return (
    <AdminCrudTable
      title="Vaccine Types"
      columns={[
        { key: 'name', label: 'Vaccine Name' },
        { key: 'interval_days', label: 'Interval (Days)' },
      ]}
      formFields={[
        { key: 'name', label: 'Vaccine Name', type: 'text', required: true, placeholder: 'e.g., CD&T' },
        { key: 'interval_days', label: 'Interval (Days)', type: 'number', required: true, placeholder: 'e.g., 180' },
      ]}
      api={vaccineTypeApi}
      idField="vaccine_type_id"
      componentIds={{
        addButton: 'A-VAX-001',
        table: 'A-VAX-002',
        searchBar: 'A-VAX-003',
        editButton: 'A-VAX-004',
        deleteButton: 'A-VAX-005',
        modal: 'A-VAX-006',
        inputs: { name: 'A-VAX-007', interval_days: 'A-VAX-008' },
        saveButton: 'A-VAX-009',
        cancelButton: 'A-VAX-010',
      }}
      pagePath="/admin/vaccine-types"
      urId="2.1.3"
      showCreatedAt
    />
  )
}

export default VaccineTypes
