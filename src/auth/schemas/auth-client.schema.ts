import { Document, Schema, Types } from 'mongoose';

export const AuthClientModelName = 'AuthClient';

export enum AuthClientType {
  Public = 'public',
  Confidential = 'confidential',
}

export enum AuthClientStatus {
  Active = 'active',
  Inactive = 'inactive',
}

export interface AuthClientDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  clientId: string;
  displayName: string;
  type: AuthClientType;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  allowedScopes: string[];
  status: AuthClientStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const AuthClientSchema = new Schema<AuthClientDocument>(
  {
    clientId: { type: String, required: true, unique: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: Object.values(AuthClientType),
      required: true,
      default: AuthClientType.Public,
    },
    redirectUris: { type: [String], required: true, default: [] },
    postLogoutRedirectUris: { type: [String], required: true, default: [] },
    allowedScopes: { type: [String], required: true, default: [] },
    status: {
      type: String,
      enum: Object.values(AuthClientStatus),
      required: true,
      default: AuthClientStatus.Active,
      index: true,
    },
  },
  { timestamps: true },
);
