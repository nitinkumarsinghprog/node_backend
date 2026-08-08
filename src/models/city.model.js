import mongoose, { Schema } from "mongoose";

const citySchema = new Schema(
  {
    name: {
      type: String,
      required: true,   
      unique: true,
      lowercase: true,  
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const City = mongoose.model("City", citySchema);