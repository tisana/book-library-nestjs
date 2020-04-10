import { Document } from 'mongoose';

export interface Book extends Document {
  readonly title: string;
  readonly author: string;
  readonly isbn: string;
  readonly quantity: number;
}
