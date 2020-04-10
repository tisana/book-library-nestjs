import * as mongoose from 'mongoose';

export const BookSchema = new mongoose.Schema({
  title: String,
  isbn: String,
  author: String,
  quantity: Number,
});
