import { Schema } from 'mongoose';

export interface AuditFields {
  createdBy?: string;
  updatedBy?: string;
}

export const auditFieldsSchemaDefinition = {
  createdBy: {
    type: String,
    required: false,
  },
  updatedBy: {
    type: String,
    required: false,
  },
};

export function applyAuditFields(schema: Schema): Schema {
  schema.add(auditFieldsSchemaDefinition);
  return schema;
}
